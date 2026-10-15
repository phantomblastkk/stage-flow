-- Stage Flow | Endereço público gratuito /@ do cantor sem subdomínio.
-- Execute após multi_role_accounts_migration.sql.
-- Não libera recursos premium: subdomínios continuam associados ao
-- campo protegido custom_subdomain_enabled, gerenciado apenas pelo servidor.
-- Compatível com contas já existentes e com o portfólio simples do músico.

-- Nomes das rotas reservadas não podem ser usados como @ artístico.
create or replace function public.stage_protect_reserved_artist_usernames()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.username is not null and lower(new.username) = any(array[
    'admin','api','auth','artista','artistas','cadastro','configuracoes',
    'convite','convites','dashboard','entrar','equipes','eventos',
    'login','logout','marketplace','meu-perfil','meu-perfil-artistico',
    'meu-portfolio','meus-convites','musico','musicos','painel','planos',
    'privacidade','publico','sobre','suporte','termos','www'
  ]) then
    raise exception 'Este nome de usuário está reservado para o Stage Flow.';
  end if;
  return new;
end;
$$;
drop trigger if exists stage_reserved_artist_usernames_trigger on public.profiles;
create trigger stage_reserved_artist_usernames_trigger
before insert or update of username on public.profiles
for each row execute function public.stage_protect_reserved_artist_usernames();

-- Dados públicos minificados: nenhum telefone, e-mail, preço privado,
-- detalhes de plano ou status de assinatura são devolvidos.
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
    'spotify_url', p.spotify_url
  )
  from public.profiles p
  where p.username = lower(p_username)
    and p.is_artist = true
    and p.is_public = true
  limit 1;
$$;
revoke all on function public.stage_public_artist_page(text) from PUBLIC;
grant execute on function public.stage_public_artist_page(text) to anon, authenticated;

-- Shows publicados, somente de um artista que ativou a sua página.
create or replace function public.stage_public_artist_events(p_username text)
returns table (
  title text, venue text, city text, starts_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select e.title, e.venue, e.city, e.starts_at
  from public.events e
  join public.profiles p on p.id = e.producer_id
  where p.username = lower(p_username)
    and p.is_public = true
    and p.is_artist = true
    and e.show_publicly = true
    and e.status = 'published'
    and e.starts_at >= now()
  order by e.starts_at asc
  limit 12;
$$;
revoke all on function public.stage_public_artist_events(text) from PUBLIC;
grant execute on function public.stage_public_artist_events(text) to anon, authenticated;

-- Dados e configuração exclusiva do próprio dono, nunca expose flags pagas
-- fora da sua sessão.
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
    'custom_subdomain_enabled', p.custom_subdomain_enabled
  )
  from public.profiles p
  where p.id = auth.uid() and p.is_artist = true
  limit 1;
$$;
revoke all on function public.stage_my_artist_page() from PUBLIC;
grant execute on function public.stage_my_artist_page() to authenticated;

-- O próprio artista pode editar APENAS conteúdo não privilegiado
-- e decidir se o endereço gratuito está publicado. Nunca muda plano.
create or replace function public.stage_save_artist_page(
  p_bio text,
  p_city text,
  p_instagram_url text,
  p_youtube_url text,
  p_spotify_url text,
  p_is_public boolean
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_ig text := nullif(btrim(coalesce(p_instagram_url,'')), '');
  v_yt text := nullif(btrim(coalesce(p_youtube_url,'')), '');
  v_sp text := nullif(btrim(coalesce(p_spotify_url,'')), '');
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_artist = true
  ) then return 'artist_required'; end if;
  if coalesce(p_is_public, false) and not exists (
    select 1 from public.profiles
    where id = auth.uid() and username is not null
  ) then return 'username_required'; end if;
  if char_length(coalesce(p_bio,'')) > 1000
    or char_length(coalesce(p_city,'')) > 120
    then return 'text_too_long'; end if;
  if (v_ig is not null and (char_length(v_ig) > 500 or v_ig !~* '^https://(www[.])?instagram[.]com/'))
    or (v_yt is not null and (char_length(v_yt) > 500 or v_yt !~* '^https://(www[.])?(youtube[.]com/|youtu[.]be/)'))
    or (v_sp is not null and (char_length(v_sp) > 500 or v_sp !~* '^https://open[.]spotify[.]com/'))
    then return 'invalid_link'; end if;
  update public.profiles
  set bio = btrim(coalesce(p_bio,'')),
      city = btrim(coalesce(p_city,'')),
      instagram_url = v_ig,
      youtube_url = v_yt,
      spotify_url = v_sp,
      is_public = coalesce(p_is_public,false),
      updated_at = now()
  where id = auth.uid() and is_artist = true;
  if not found then return 'not_found'; end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_save_artist_page(text,text,text,text,text,boolean) from PUBLIC;
grant execute on function public.stage_save_artist_page(text,text,text,text,text,boolean) to authenticated;
