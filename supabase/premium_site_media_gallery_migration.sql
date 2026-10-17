-- Stage Flow | Galeria privada do RASCUNHO do site profissional do cantor
-- Execute DEPOIS de multi_role_accounts_migration.sql e premium_site_draft_editor_migration.sql.
-- Não publica fotos ou sites, não altera pagamentos, @, planos nem subdomínios.
-- Bucket PRIVADO: só o dono autenticado pode ler, enviar ou excluir seus arquivos.
-- Execute novamente com segurança sem apagar conteúdo.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stage-premium-drafts', 'stage-premium-drafts', false, 5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[];

drop policy if exists "stage_premium_draft_upload_own" on storage.objects;
create policy "stage_premium_draft_upload_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'stage-premium-drafts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$')
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_artist = true
  )
);
drop policy if exists "stage_premium_draft_read_own" on storage.objects;
create policy "stage_premium_draft_read_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'stage-premium-drafts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "stage_premium_draft_delete_own" on storage.objects;
create policy "stage_premium_draft_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'stage-premium-drafts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create table if not exists public.stage_premium_site_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  media_kind text not null check (media_kind in ('photo','youtube')),
  title text not null default '',
  storage_path text,
  youtube_id text,
  display_order integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  constraint stage_premium_media_title_size check (char_length(title) between 1 and 90),
  constraint stage_premium_media_source_check check (
    (media_kind = 'photo'
      and storage_path is not null
      and youtube_id is null
      and storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$')
    or
    (media_kind = 'youtube'
      and youtube_id ~ '^[a-zA-Z0-9_-]{11}$'
      and storage_path is null)
  )
);

create index if not exists stage_premium_media_owner_order
on public.stage_premium_site_media(owner_id, display_order, created_at, id);

create unique index if not exists stage_premium_media_unique_photo
on public.stage_premium_site_media(owner_id, storage_path)
where storage_path is not null;

create unique index if not exists stage_premium_media_unique_featured
on public.stage_premium_site_media(owner_id) where featured = true;

alter table public.stage_premium_site_media enable row level security;
revoke all on public.stage_premium_site_media from PUBLIC, anon, authenticated;

-- A lista é carregada apenas quando um usuário autenticado é o proprietário.
create or replace function public.stage_my_premium_site_media()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_artist = true
    ) then null
    else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'media_kind', m.media_kind,
          'title', m.title,
          'storage_path', m.storage_path,
          'youtube_id', m.youtube_id,
          'featured', m.featured,
          'display_order', m.display_order
        )
        order by m.display_order, m.created_at, m.id
      )
      from public.stage_premium_site_media m
      where m.owner_id = auth.uid()
    ), '[]'::jsonb)
  end;
$$;
revoke all on function public.stage_my_premium_site_media() from PUBLIC;
grant execute on function public.stage_my_premium_site_media() to authenticated;

-- Segurança e limite de 20 itens por conta: lock transacional pelo dono.
create or replace function public.stage_add_premium_site_media(
  p_kind text, p_title text, p_storage_path text, p_youtube_id text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_title text := btrim(coalesce(p_title,''));
  v_path text := nullif(btrim(coalesce(p_storage_path,'')), '');
  v_video text := nullif(btrim(coalesce(p_youtube_id,'')), '');
  v_total integer;
begin
  if v_owner is null then return 'login_required'; end if;
  if not exists (select 1 from public.profiles
                 where id = v_owner and is_artist = true) then return 'artist_required'; end if;
  if p_kind is null or p_kind not in ('photo','youtube') then return 'invalid_kind'; end if;
  if char_length(v_title) not between 1 and 90 then return 'invalid_title'; end if;

  if p_kind = 'photo' then
    if v_video is not null
      or v_path is null
      or v_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
      or split_part(v_path,'/',1) <> v_owner::text
      then return 'invalid_photo'; end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'stage-premium-drafts' and name = v_path
    ) then return 'upload_missing'; end if;
  else
    if v_path is not null or v_video is null
       or v_video !~ '^[a-zA-Z0-9_-]{11}$'
       then return 'invalid_video'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 253912));
  select count(*) into v_total from public.stage_premium_site_media where owner_id = v_owner;
  if v_total >= 20 then return 'limit_reached'; end if;

  insert into public.stage_premium_site_media
    (owner_id,media_kind,title,storage_path,youtube_id,display_order,featured)
  values
    (v_owner,p_kind,v_title,
     case when p_kind = 'photo' then v_path else null end,
     case when p_kind = 'youtube' then v_video else null end,
     coalesce((select max(display_order) + 1 from public.stage_premium_site_media where owner_id = v_owner),0),
     v_total = 0);
  return 'saved';
exception when unique_violation then return 'duplicate';
end;
$$;
revoke all on function public.stage_add_premium_site_media(text,text,text,text) from PUBLIC;
grant execute on function public.stage_add_premium_site_media(text,text,text,text) to authenticated;

-- Atualiza o título do item pertencente ao próprio artista.
create or replace function public.stage_rename_premium_site_media(p_id uuid, p_title text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title,''));
begin
  if auth.uid() is null then return 'login_required'; end if;
  if char_length(v_title) not between 1 and 90 then return 'invalid_title'; end if;
  update public.stage_premium_site_media
  set title = v_title where id = p_id and owner_id = auth.uid();
  if not found then return 'not_found'; end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_rename_premium_site_media(uuid,text) from PUBLIC;
grant execute on function public.stage_rename_premium_site_media(uuid,text) to authenticated;

-- No máximo um destaque por artista, sem concessão de plano premium.
create or replace function public.stage_feature_premium_site_media(p_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then return 'login_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 253912));
  if not exists (
    select 1 from public.stage_premium_site_media
    where id = p_id and owner_id = v_owner
  ) then return 'not_found'; end if;
  update public.stage_premium_site_media set featured = false
  where owner_id = v_owner and featured = true;
  update public.stage_premium_site_media set featured = true
  where owner_id = v_owner and id = p_id;
  return 'saved';
end;
$$;
revoke all on function public.stage_feature_premium_site_media(uuid) from PUBLIC;
grant execute on function public.stage_feature_premium_site_media(uuid) to authenticated;

-- A lista completa é enviada na nova ordem, sem permitir referências externas.
create or replace function public.stage_reorder_premium_site_media(p_ids uuid[])
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_total integer;
begin
  if v_owner is null then return 'login_required'; end if;
  if p_ids is null or cardinality(p_ids) > 20
    or array_position(p_ids, null) is not null then return 'invalid_order'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 253912));
  select count(*) into v_total from public.stage_premium_site_media where owner_id = v_owner;

  if cardinality(p_ids) <> v_total
    or (select count(distinct id) from unnest(p_ids) id) <> v_total
    or (select count(*) from public.stage_premium_site_media where owner_id = v_owner
        and id = any(p_ids)) <> v_total then return 'invalid_order'; end if;

  update public.stage_premium_site_media m
  set display_order = positioned.ordinality::integer - 1
  from unnest(p_ids) with ordinality positioned(id, ordinality)
  where m.id = positioned.id and m.owner_id = v_owner;
  return 'saved';
end;
$$;
revoke all on function public.stage_reorder_premium_site_media(uuid[]) from PUBLIC;
grant execute on function public.stage_reorder_premium_site_media(uuid[]) to authenticated;

create or replace function public.stage_remove_premium_site_media(p_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_was_featured boolean;
  v_next uuid;
begin
  if v_owner is null then return 'login_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 253912));
  delete from public.stage_premium_site_media
  where owner_id = v_owner and id = p_id returning featured into v_was_featured;
  if not found then return 'not_found'; end if;

  if v_was_featured then
    select id into v_next
    from public.stage_premium_site_media
    where owner_id = v_owner
    order by display_order, created_at, id limit 1;
    if v_next is not null then
      update public.stage_premium_site_media set featured = true
      where owner_id = v_owner and id = v_next;
    end if;
  end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_remove_premium_site_media(uuid) from PUBLIC;
grant execute on function public.stage_remove_premium_site_media(uuid) to authenticated;

-- Nunca expor media desta tabela via RPC pública. Quando o site premium for
-- publicado de verdade, uma nova camada de autorização/publicação será necessária.
