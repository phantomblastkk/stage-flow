-- Stage Flow | Flyer por show + exportacao Feed 1080x1350 / Story 1080x1920
-- RODE NO SUPABASE SQL EDITOR APOS as migracoes Pro de publicacao, galeria
-- separada e limite de 3 fotos + 3 videos.
-- Nao altera a cota de fotos/videos do portfolio.
-- Nao publica eventos privados nem torna o bucket publico.

begin;

alter table public.events
  add column if not exists flyer_path text,
  add column if not exists flyer_settings jsonb not null default '{}'::jsonb;

do $ddl$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.events'::regclass
      and conname='stage_show_flyer_path_format'
  ) then
    alter table public.events
      add constraint stage_show_flyer_path_format
      check (flyer_path is null or
        flyer_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$');
  end if;
end;
$ddl$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('stage-show-flyers','stage-show-flyers',false,8388608,
  array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set
  public=false,
  file_size_limit=8388608,
  allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];

-- Autoriza um download publico SOMENTE se o flyer pertence a um evento publico,
-- publicado, do artista com site Pro publicado, visivel e com acesso vigente.
create or replace function public.stage_can_read_show_flyer(p_path text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_path is not null and exists (
    select 1
    from public.events e
    join public.profiles artist on artist.id=e.producer_id
    join public.stage_pro_site_publications published
      on published.owner_id=e.producer_id
    where e.flyer_path=p_path
      and e.status='published'
      and e.show_publicly=true
      and e.starts_at>=now()
      and artist.is_artist=true
      and artist.is_public=true
      and artist.username is not null
      and published.published=true
      and 'agenda'=any(published.visible_sections)
      and public.stage_pro_site_is_entitled(e.producer_id)
  );
$$;
revoke all on function public.stage_can_read_show_flyer(text)
  from public,anon,authenticated;
grant execute on function public.stage_can_read_show_flyer(text)
  to anon,authenticated;

-- Upload de flyer privado por quem criou o proprio evento.
drop policy if exists "stage_show_flyer_insert_own" on storage.objects;
create policy "stage_show_flyer_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id='stage-show-flyers'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
  and split_part(name,'/',1)=(select auth.uid())::text
  and exists (
    select 1 from public.events e
    where e.id::text=split_part(name,'/',2)
      and e.producer_id=(select auth.uid())
  )
);

drop policy if exists "stage_show_flyer_read_own_or_public" on storage.objects;
create policy "stage_show_flyer_read_own_or_public" on storage.objects
for select to authenticated,anon
using (
  bucket_id='stage-show-flyers'
  and (
    split_part(name,'/',1)=(select auth.uid())::text
    or public.stage_can_read_show_flyer(name)
  )
);

drop policy if exists "stage_show_flyer_delete_own" on storage.objects;
create policy "stage_show_flyer_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id='stage-show-flyers'
  and split_part(name,'/',1)=(select auth.uid())::text
);

-- Controle via RPC com lock do evento, sem exigir update direto nas RLS.
-- Preferencias de recorte sao pequenos objetos JSON por formato.
create or replace function public.stage_set_show_flyer(
  p_event_id uuid, p_path text, p_settings jsonb default null
)
returns text
language plpgsql security definer set search_path=''
as $$
declare
  v_owner uuid:=auth.uid();
  v_old text;
  v_path text:=nullif(btrim(coalesce(p_path,'')),'');
begin
  if v_owner is null then return 'login_required';end if;
  if p_event_id is null then return 'invalid_event';end if;

  select flyer_path into v_old
  from public.events
  where id=p_event_id and producer_id=v_owner
  for update;
  if not found then return 'not_found';end if;

  if p_settings is not null then
    if jsonb_typeof(p_settings)<>'object'
      or octet_length(p_settings::text)>1500
      or (p_settings ? 'feed' and jsonb_typeof(p_settings->'feed')<>'object')
      or (p_settings ? 'story' and jsonb_typeof(p_settings->'story')<>'object')
    then return 'invalid_settings';end if;
  end if;

  if v_path is not null then
    if v_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
      or split_part(v_path,'/',1)<>v_owner::text
      or split_part(v_path,'/',2)<>p_event_id::text
    then return 'invalid_flyer';end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id='stage-show-flyers' and o.name=v_path
    ) then return 'upload_missing';end if;
  end if;

  update public.events
  set flyer_path=v_path,
      flyer_settings=case
        when v_path is null then '{}'::jsonb
        when p_settings is not null then p_settings
        else flyer_settings
      end
  where id=p_event_id and producer_id=v_owner;

  return 'saved';
end;
$$;
revoke all on function public.stage_set_show_flyer(uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.stage_set_show_flyer(uuid,text,jsonb)
  to authenticated;

-- Mantem o limite de 3 fotos + 3 videos e acrescenta apenas o flyer
-- de eventos publicos (campos de show nao privados).
create or replace function public.stage_public_pro_artist_site(p_username text)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
  if p_username is null or p_username !~ '^[a-z0-9-]{3,30}$'
  then return null;end if;

  select jsonb_build_object(
    'artist',jsonb_build_object(
      'name',p.display_name,'username',p.username,
      'headline',p.artist_headline,'bio',coalesce(p.bio,''),
      'city',coalesce(p.city,''),
      'instagram_url',p.instagram_url,
      'youtube_url',p.youtube_url,
      'spotify_url',p.spotify_url,
      'avatar_path',p.artist_avatar_path,
      'cover_path',p.artist_cover_path,
      'bookings_enabled',coalesce(p.accept_booking_requests,false)
    ),
    'design',jsonb_build_object(
      'theme',s.theme,'accent',s.accent,
      'section_order',s.section_order,
      'visible_sections',s.visible_sections
    ),
    'media',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.draft_media_id,'media_kind',m.media_kind,
        'title',m.title,'storage_path',m.storage_path,
        'youtube_id',m.youtube_id,'featured',m.featured,
        'display_order',m.display_order
      ) order by m.display_order,m.draft_media_id)
      from (
        select candidate.*,
          row_number() over (
            partition by candidate.media_kind
            order by candidate.featured desc,
              candidate.display_order,candidate.draft_media_id
          ) as media_rank
        from public.stage_pro_site_public_media candidate
        where candidate.owner_id=p.id
      ) m
      where m.media_rank<=3
        and (
          (m.media_kind='photo' and 'photos'=any(s.visible_sections))
          or (m.media_kind='youtube' and 'videos'=any(s.visible_sections))
        )
    ),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ev.id,'title',ev.title,'venue',ev.venue,
        'city',ev.city,'starts_at',ev.starts_at,
        'flyer_path',ev.flyer_path,'flyer_settings',ev.flyer_settings
      ) order by ev.starts_at)
      from (
        select id,title,venue,city,starts_at,flyer_path,flyer_settings
        from public.events
        where producer_id=p.id
          and show_publicly=true and status='published'
          and starts_at>=now()
        order by starts_at asc limit 40
      ) ev
    ),'[]'::jsonb)
  )
  into v_result
  from public.profiles p
  join public.stage_pro_site_publications s
    on s.owner_id=p.id and s.published=true
  where p.username=p_username
    and p.is_artist=true and p.is_public=true
    and public.stage_pro_site_is_entitled(p.id)
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.stage_public_pro_artist_site(text)
  from public,anon,authenticated;
grant execute on function public.stage_public_pro_artist_site(text)
  to anon,authenticated;

commit;
notify pgrst, 'reload schema';
