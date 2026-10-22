-- Stage Flow | SITE PRO v2: GALERIA DE FOTOS E VIDEOS INDEPENDENTES
-- Execute depois de pro_artist_publication_migration.sql (VERSAO CORRIGIDA).
-- Adiciona seções "photos" e "videos" com posicao e visibilidade proprias.
-- Compatibilidade: rascunhos e sites publicados que tinham "portfolio"
-- sao convertidos para "photos","videos" na MESMA POSICAO.
-- Se "portfolio" estava oculto, ambos permanecem ocultos.
-- Preserva temas, fotos, videos e sites ja publicados.
-- Nao publica rascunho e nao altera plano/subdominio/marketplace.
-- Este arquivo pode ser executado novamente sem duplicar seções.

begin;

-- Remova as restricoes antigas ANTES de converter as arrays.
alter table public.stage_premium_site_drafts
  drop constraint if exists stage_premium_draft_order_check,
  drop constraint if exists stage_premium_draft_visible_check;
alter table public.stage_pro_site_publications
  drop constraint if exists stage_pro_public_sections_valid;

-- Expansao preserva a ordenacao atual e os estados de exibicao.
-- Usa string_to_array com elementos fechados e validados por CHECKs.
update public.stage_premium_site_drafts
set section_order=string_to_array(
      replace(array_to_string(section_order,','),'portfolio','photos,videos'),','),
    visible_sections=string_to_array(
      replace(array_to_string(visible_sections,','),'portfolio','photos,videos'),',')
where 'portfolio'=any(section_order) or 'portfolio'=any(visible_sections);

update public.stage_pro_site_publications
set section_order=string_to_array(
      replace(array_to_string(section_order,','),'portfolio','photos,videos'),','),
    visible_sections=string_to_array(
      replace(array_to_string(visible_sections,','),'portfolio','photos,videos'),',')
where 'portfolio'=any(section_order) or 'portfolio'=any(visible_sections);

alter table public.stage_premium_site_drafts
  alter column section_order set default array['about','photos','videos','agenda','contact']::text[],
  alter column visible_sections set default array['about','photos','videos','agenda','contact']::text[];
alter table public.stage_pro_site_publications
  alter column section_order set default array['about','photos','videos','agenda','contact']::text[],
  alter column visible_sections set default array['about','photos','videos','agenda','contact']::text[];

alter table public.stage_premium_site_drafts
  add constraint stage_premium_draft_order_check check(
    cardinality(section_order)=5
    and section_order @> array['about','photos','videos','agenda','contact']::text[]
    and section_order <@ array['about','photos','videos','agenda','contact']::text[]
    and array_position(section_order,null) is null
  ),
  add constraint stage_premium_draft_visible_check check(
    cardinality(visible_sections) between 1 and 5
    and visible_sections <@ array['about','photos','videos','agenda','contact']::text[]
    and array_position(visible_sections,null) is null
  );

alter table public.stage_pro_site_publications
  add constraint stage_pro_public_sections_valid check(
    cardinality(section_order)=5
    and section_order @> array['about','photos','videos','agenda','contact']::text[]
    and section_order <@ array['about','photos','videos','agenda','contact']::text[]
    and array_position(section_order,null) is null
    and cardinality(visible_sections) between 1 and 5
    and visible_sections <@ array['about','photos','videos','agenda','contact']::text[]
    and array_position(visible_sections,null) is null
  );

-- Altera a RPC de leitura e salvamento privados SEM alterar seus argumentos.

create or replace function public.stage_my_premium_site_draft()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then return null; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_artist = true
  ) then return null; end if;

  select jsonb_build_object(
    'theme', d.theme,
    'accent', d.accent,
    'section_order', d.section_order,
    'visible_sections', d.visible_sections,
    'updated_at', d.updated_at
  )
  into v_result
  from public.stage_premium_site_drafts d
  where d.owner_id = auth.uid();

  return coalesce(v_result, jsonb_build_object(
    'theme','midnight',
    'accent','violet',
    'section_order',array['about','photos','videos','agenda','contact']::text[],
    'visible_sections',array['about','photos','videos','agenda','contact']::text[],
    'updated_at',null
  ));
end;
$$;

create or replace function public.stage_save_premium_site_draft(
  p_theme text,
  p_accent text,
  p_section_order text[],
  p_visible_sections text[]
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_allowed text[] := array['about','photos','videos','agenda','contact']::text[];
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_artist = true
  ) then return 'artist_required'; end if;

  if p_theme is null or p_theme not in ('midnight','concert','ivory')
    then return 'invalid_theme'; end if;
  if p_accent is null or p_accent not in ('violet','lime','cyan','gold','coral')
    then return 'invalid_accent'; end if;
  if p_section_order is null
    or cardinality(p_section_order) <> 5
    or p_section_order @> v_allowed is not true
    or p_section_order <@ v_allowed is not true
    or array_position(p_section_order, null) is not null
    then return 'invalid_order'; end if;
  if p_visible_sections is null
    or cardinality(p_visible_sections) not between 1 and 5
    or p_visible_sections <@ v_allowed is not true
    or array_position(p_visible_sections, null) is not null
    or cardinality(p_visible_sections) <> (
      select count(distinct section)::integer
      from unnest(p_visible_sections) section
    )
    then return 'invalid_sections'; end if;

  insert into public.stage_premium_site_drafts
    (owner_id,theme,accent,section_order,visible_sections,updated_at)
  values (
    auth.uid(),p_theme,p_accent,p_section_order,p_visible_sections,now()
  )
  on conflict (owner_id) do update
    set theme = excluded.theme,
        accent = excluded.accent,
        section_order = excluded.section_order,
        visible_sections = excluded.visible_sections,
        updated_at = now();

  return 'saved';
end;
$$;

-- A galeria privada não vira pública: storage libera apenas fotos realmente
-- selecionadas para uma publicação ATIVA e seção Fotos visível.

create or replace function public.stage_pro_site_can_download_media(p_path text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_path is not null and exists(
    select 1
    from public.stage_pro_site_public_media m
    join public.stage_pro_site_publications s on s.owner_id=m.owner_id
    join public.profiles p on p.id=m.owner_id
    where m.media_kind='photo'
      and m.storage_path=p_path
      and s.published=true
      and 'photos'=any(s.visible_sections)
      and p.is_artist=true and p.is_public=true and p.username is not null
      and public.stage_pro_site_is_entitled(p.id)
  );
$$;

-- A consulta pública filtra separadamente cada tipo de mídia segundo a
-- visibilidade do snapshot publicado. Vídeos não abrem acesso a fotos.

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
      from public.stage_pro_site_public_media m
      where m.owner_id=p.id
        and (
          (m.media_kind='photo' and 'photos'=any(s.visible_sections))
          or (m.media_kind='youtube' and 'videos'=any(s.visible_sections))
        )
    ),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ev.id,'title',ev.title,'venue',ev.venue,
        'city',ev.city,'starts_at',ev.starts_at
      ) order by ev.starts_at)
      from (
        select id,title,venue,city,starts_at
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

-- Mantém permissões explícitas das RPCs.
revoke all on function public.stage_my_premium_site_draft()
  from public,anon,authenticated;
grant execute on function public.stage_my_premium_site_draft() to authenticated;

revoke all on function public.stage_save_premium_site_draft(text,text,text[],text[])
  from public,anon,authenticated;
grant execute on function public.stage_save_premium_site_draft(text,text,text[],text[])
  to authenticated;

revoke all on function public.stage_public_pro_artist_site(text)
  from public,anon,authenticated;
grant execute on function public.stage_public_pro_artist_site(text)
  to anon,authenticated;

revoke all on function public.stage_pro_site_can_download_media(text)
  from public,anon,authenticated;
grant execute on function public.stage_pro_site_can_download_media(text)
  to anon,authenticated;

commit;

-- Atualiza o cache de funcoes do Supabase sem exigir alteracao manual.
notify pgrst, 'reload schema';
