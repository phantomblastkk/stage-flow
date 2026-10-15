-- Stage Flow | Fotos e identidade visual do perfil GRATUITO do cantor.
-- Execute depois de free_artist_pages_migration.sql.
-- NÃO ativa subdomínios nem recursos premium e não altera planos.
-- Usa bucket próprio para que o upload funcione independentemente do músico.

alter table public.profiles
  add column if not exists artist_headline text not null default '',
  add column if not exists artist_accent text not null default 'violet',
  add column if not exists artist_avatar_path text,
  add column if not exists artist_cover_path text;

alter table public.profiles
  drop constraint if exists profiles_artist_headline_length,
  drop constraint if exists profiles_artist_accent_choice,
  drop constraint if exists profiles_artist_avatar_key,
  drop constraint if exists profiles_artist_cover_key;

alter table public.profiles
  add constraint profiles_artist_headline_length
    check (char_length(artist_headline) <= 100),
  add constraint profiles_artist_accent_choice
    check (artist_accent in ('violet', 'lime', 'cyan')),
  add constraint profiles_artist_avatar_key
    check (artist_avatar_path is null or artist_avatar_path ~
      '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'),
  add constraint profiles_artist_cover_key
    check (artist_cover_path is null or artist_cover_path ~
      '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$');

insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stage-artist-public',
  'stage-artist-public',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

-- Só a conta de artista pode enviar imagens para a SUA pasta.
-- Uploads usam UUID aleatório por arquivo. Sem UPDATE/DELETE direto.
drop policy if exists "stage_artist_upload_own_public_photos" on storage.objects;
create policy "stage_artist_upload_own_public_photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'stage-artist-public'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_artist = true
  )
);

-- Todos os dados da rota /@usuario são fornecidos por RPCs públicos
-- que selecionam APENAS as colunas permitidas.
-- Retire a policy legada que permitia consultar TODAS as colunas (incluindo
-- contato pessoal) dos perfis de artistas pagos.
drop policy if exists "Public can view published artist profiles" on public.profiles;

create or replace function public.stage_public_artist_page(p_username text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.display_name,
    'username', p.username,
    'bio', coalesce(p.bio, ''),
    'city', coalesce(p.city, ''),
    'instagram_url', p.instagram_url,
    'youtube_url', p.youtube_url,
    'spotify_url', p.spotify_url,
    'headline', p.artist_headline,
    'accent', p.artist_accent,
    'avatar_path', p.artist_avatar_path,
    'cover_path', p.artist_cover_path
  )
  from public.profiles p
  where p.username = lower(p_username)
    and p.is_artist = true
    and p.is_public = true
  limit 1;
$$;
revoke all on function public.stage_public_artist_page(text) from PUBLIC;
grant execute on function public.stage_public_artist_page(text) to anon, authenticated;

create or replace function public.stage_my_artist_page()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.display_name,
    'username', p.username,
    'bio', coalesce(p.bio, ''),
    'city', coalesce(p.city, ''),
    'instagram_url', p.instagram_url,
    'youtube_url', p.youtube_url,
    'spotify_url', p.spotify_url,
    'is_public', p.is_public,
    'custom_subdomain_enabled', p.custom_subdomain_enabled,
    'headline', p.artist_headline,
    'accent', p.artist_accent,
    'avatar_path', p.artist_avatar_path,
    'cover_path', p.artist_cover_path
  )
  from public.profiles p
  where p.id = auth.uid() and p.is_artist = true
  limit 1;
$$;
revoke all on function public.stage_my_artist_page() from PUBLIC;
grant execute on function public.stage_my_artist_page() to authenticated;

-- v2 usa assinatura nova para manter compatibilidade com chamadas antigas.
create or replace function public.stage_save_artist_page_v2(
  p_bio text,
  p_city text,
  p_instagram_url text,
  p_youtube_url text,
  p_spotify_url text,
  p_is_public boolean,
  p_headline text,
  p_accent text,
  p_avatar_path text,
  p_cover_path text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_ig text := nullif(btrim(coalesce(p_instagram_url,'')), '');
  v_yt text := nullif(btrim(coalesce(p_youtube_url,'')), '');
  v_sp text := nullif(btrim(coalesce(p_spotify_url,'')), '');
  v_avatar text := nullif(btrim(coalesce(p_avatar_path,'')), '');
  v_cover text := nullif(btrim(coalesce(p_cover_path,'')), '');
  v_prefix text;
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists(
    select 1 from public.profiles where id = auth.uid() and is_artist = true
  ) then return 'artist_required'; end if;
  if coalesce(p_is_public, false) and not exists(
    select 1 from public.profiles
    where id = auth.uid() and username is not null
  ) then return 'username_required'; end if;

  if char_length(coalesce(p_bio,'')) > 1000
    or char_length(coalesce(p_city,'')) > 120
    or char_length(coalesce(p_headline,'')) > 100
    then return 'text_too_long'; end if;

  if p_accent is null or p_accent not in ('violet', 'lime', 'cyan')
    then return 'invalid_accent'; end if;

  if (v_ig is not null and
      (char_length(v_ig) > 500 or v_ig !~* '^https://(www[.])?instagram[.]com/'))
    or (v_yt is not null and
      (char_length(v_yt) > 500 or v_yt !~* '^https://(www[.])?(youtube[.]com/|youtu[.]be/)'))
    or (v_sp is not null and
      (char_length(v_sp) > 500 or v_sp !~* '^https://open[.]spotify[.]com/'))
  then return 'invalid_link'; end if;

  v_prefix := auth.uid()::text || '/';

  if v_avatar is not null then
    if left(v_avatar, char_length(v_prefix)) <> v_prefix
      or v_avatar !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
    then return 'invalid_avatar'; end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'stage-artist-public' and name = v_avatar
    ) then return 'invalid_avatar'; end if;
  end if;

  if v_cover is not null then
    if left(v_cover, char_length(v_prefix)) <> v_prefix
      or v_cover !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
    then return 'invalid_cover'; end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'stage-artist-public' and name = v_cover
    ) then return 'invalid_cover'; end if;
  end if;

  update public.profiles
  set bio = btrim(coalesce(p_bio,'')),
      city = btrim(coalesce(p_city,'')),
      instagram_url = v_ig,
      youtube_url = v_yt,
      spotify_url = v_sp,
      artist_headline = btrim(coalesce(p_headline,'')),
      artist_accent = p_accent,
      artist_avatar_path = v_avatar,
      artist_cover_path = v_cover,
      is_public = coalesce(p_is_public,false),
      updated_at = now()
  where id = auth.uid() and is_artist = true;

  if not found then return 'not_found'; end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_save_artist_page_v2(
  text,text,text,text,text,boolean,text,text,text,text
) from PUBLIC;
grant execute on function public.stage_save_artist_page_v2(
  text,text,text,text,text,boolean,text,text,text,text
) to authenticated;
