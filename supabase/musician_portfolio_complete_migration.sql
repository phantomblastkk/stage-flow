-- Stage Flow | Portfólio gratuito do músico - informações profissionais v3
-- Execute APÓS musician_portfolios_migration.sql e
-- musician_portfolio_appearance_migration.sql.
-- Migração aditiva: preserva fotos, endereço, publicação e cachê antigo.
-- Não ativa planos, subdomínios ou recursos Premium do cantor.

alter table public.musician_portfolios
  add column if not exists experience_years smallint,
  add column if not exists performance_types text[] not null default '{}'::text[],
  add column if not exists career_highlights text[] not null default '{}'::text[],
  add column if not exists availability_note text not null default '',
  add column if not exists additional_media_urls text[] not null default '{}'::text[],
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists spotify_url text;

alter table public.musician_portfolios
  drop constraint if exists musician_portfolio_years_valid,
  drop constraint if exists musician_portfolio_performance_valid,
  drop constraint if exists musician_portfolio_highlights_valid,
  drop constraint if exists musician_portfolio_availability_valid,
  drop constraint if exists musician_portfolio_additional_media_valid,
  drop constraint if exists musician_portfolio_instagram_valid,
  drop constraint if exists musician_portfolio_youtube_valid,
  drop constraint if exists musician_portfolio_spotify_valid;

alter table public.musician_portfolios
  add constraint musician_portfolio_years_valid
    check (experience_years is null or experience_years between 0 and 60),
  add constraint musician_portfolio_performance_valid
    check (cardinality(performance_types) <= 5
      and array_position(performance_types, null) is null),
  add constraint musician_portfolio_highlights_valid
    check (cardinality(career_highlights) <= 4
      and array_position(career_highlights, null) is null),
  add constraint musician_portfolio_availability_valid
    check (char_length(availability_note) <= 140),
  add constraint musician_portfolio_additional_media_valid
    check (cardinality(additional_media_urls) <= 2
      and array_position(additional_media_urls, null) is null),
  add constraint musician_portfolio_instagram_valid
    check (instagram_url is null or
      (char_length(instagram_url) <= 500
      and instagram_url ~* '^https://(www[.])?instagram[.]com/[^[:space:]]+$')),
  add constraint musician_portfolio_youtube_valid
    check (youtube_url is null or
      (char_length(youtube_url) <= 500
      and youtube_url ~* '^https://(www[.]|m[.])?youtube[.]com/[^[:space:]]+$'
       or youtube_url ~* '^https://youtu[.]be/[^[:space:]]+$')),
  add constraint musician_portfolio_spotify_valid
    check (spotify_url is null or
      (char_length(spotify_url) <= 500
      and spotify_url ~* '^https://open[.]spotify[.]com/[^[:space:]]+$'));

-- Campos opcionais usados no editor privativo.
create or replace function public.stage_my_musician_portfolio()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.display_name,
    'slug', coalesce(m.slug, p.username, ''),
    'bio', coalesce(m.bio, ''),
    'city', coalesce(m.city, p.city, ''),
    'instruments', coalesce(m.instruments, '{}'::text[]),
    'genres', coalesce(m.genres, '{}'::text[]),
    'media_url', m.media_url,
    'price_mode', coalesce(m.price_mode, 'consult'),
    'reference_fee', m.reference_fee,
    'is_published', coalesce(m.is_published, false),
    'headline', coalesce(m.headline, ''),
    'theme', coalesce(m.theme, 'midnight'),
    'accent', coalesce(m.accent, 'lime'),
    'layout_style', coalesce(m.layout_style, 'spotlight'),
    'avatar_url', m.avatar_url,
    'cover_url', m.cover_url,
    'experience_years', m.experience_years,
    'performance_types', coalesce(m.performance_types, '{}'::text[]),
    'career_highlights', coalesce(m.career_highlights, '{}'::text[]),
    'availability_note', coalesce(m.availability_note, ''),
    'additional_media_urls', coalesce(m.additional_media_urls, '{}'::text[]),
    'instagram_url', m.instagram_url,
    'youtube_url', m.youtube_url,
    'spotify_url', m.spotify_url
  )
  from public.profiles p
  left join public.musician_portfolios m on m.profile_id = p.id
  where p.id = auth.uid() and p.is_artist = true
  limit 1;
$$;
revoke all on function public.stage_my_musician_portfolio() from PUBLIC;
grant execute on function public.stage_my_musician_portfolio() to authenticated;

-- Dados públicos APENAS quando o músico publicou o portfólio.
-- Não fornece e-mail, telefone, convites ou cachês privados de eventos.
create or replace function public.stage_public_musician_portfolio(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.display_name,
    'slug', m.slug,
    'bio', m.bio,
    'city', m.city,
    'instruments', m.instruments,
    'genres', m.genres,
    'media_url', m.media_url,
    'price_mode', m.price_mode,
    'reference_fee', case when m.price_mode = 'from' then m.reference_fee else null end,
    'headline', m.headline,
    'theme', m.theme,
    'accent', m.accent,
    'layout_style', m.layout_style,
    'avatar_url', m.avatar_url,
    'cover_url', m.cover_url,
    'experience_years', m.experience_years,
    'performance_types', m.performance_types,
    'career_highlights', m.career_highlights,
    'availability_note', m.availability_note,
    'additional_media_urls', m.additional_media_urls,
    'instagram_url', m.instagram_url,
    'youtube_url', m.youtube_url,
    'spotify_url', m.spotify_url
  )
  from public.musician_portfolios m
  join public.profiles p on p.id = m.profile_id
  where m.slug = lower(p_slug)
    and m.is_published = true
    and p.is_artist = true
  limit 1;
$$;
revoke all on function public.stage_public_musician_portfolio(text) from PUBLIC;
grant execute on function public.stage_public_musician_portfolio(text) to anon, authenticated;

-- A função v3 chama a v2, preservando TODAS as validações de aparência,
-- cachê, slug e ownership existentes. Extras são validados antes de salvar.
create or replace function public.stage_save_musician_portfolio_v3(
  p_slug text, p_bio text, p_city text,
  p_instruments text[], p_genres text[], p_media_url text,
  p_price_mode text, p_reference_fee numeric, p_is_published boolean,
  p_headline text, p_theme text, p_accent text, p_layout_style text,
  p_avatar_url text, p_cover_url text,
  p_experience_years integer, p_performance_types text[],
  p_career_highlights text[], p_availability_note text,
  p_additional_media_urls text[],
  p_instagram_url text, p_youtube_url text, p_spotify_url text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_base_result text;
  v_performance text[];
  v_highlights text[];
  v_extra_media text[];
  v_instagram text := nullif(btrim(coalesce(p_instagram_url,'')), '');
  v_youtube text := nullif(btrim(coalesce(p_youtube_url,'')), '');
  v_spotify text := nullif(btrim(coalesce(p_spotify_url,'')), '');
  v_availability text := btrim(coalesce(p_availability_note,''));
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_artist = true
  ) then return 'artist_required'; end if;

  if p_experience_years is not null
    and p_experience_years not between 0 and 60
  then return 'invalid_experience'; end if;
  if char_length(v_availability) > 140
  then return 'invalid_availability'; end if;

  if coalesce(cardinality(p_performance_types),0) > 5
    or coalesce(cardinality(p_career_highlights),0) > 4
    or coalesce(cardinality(p_additional_media_urls),0) > 2
  then return 'too_many_details'; end if;

  if exists (
    select 1 from unnest(coalesce(p_performance_types,'{}'::text[])) item
    where item is null or char_length(btrim(item)) not between 2 and 45
  ) then return 'invalid_performance'; end if;

  if exists (
    select 1 from unnest(coalesce(p_career_highlights,'{}'::text[])) item
    where item is null or char_length(btrim(item)) not between 4 and 120
  ) then return 'invalid_highlights'; end if;

  if exists (
    select 1 from unnest(coalesce(p_additional_media_urls,'{}'::text[])) item
    where item is null or char_length(btrim(item)) > 500
      or btrim(item) !~* '^https://[^[:space:]]+$'
  ) then return 'invalid_media'; end if;

  if v_instagram is not null and (
    char_length(v_instagram) > 500 or
    v_instagram !~* '^https://(www[.])?instagram[.]com/[^[:space:]]+$'
  ) then return 'invalid_social'; end if;
  if v_youtube is not null and (
    char_length(v_youtube) > 500 or
    (v_youtube !~* '^https://(www[.]|m[.])?youtube[.]com/[^[:space:]]+$'
     and v_youtube !~* '^https://youtu[.]be/[^[:space:]]+$')
  ) then return 'invalid_social'; end if;
  if v_spotify is not null and (
    char_length(v_spotify) > 500 or
    v_spotify !~* '^https://open[.]spotify[.]com/[^[:space:]]+$'
  ) then return 'invalid_social'; end if;

  v_performance := array(
    select distinct btrim(item) from
      unnest(coalesce(p_performance_types,'{}'::text[])) item
  );
  v_highlights := array(
    select btrim(item) from
      unnest(coalesce(p_career_highlights,'{}'::text[])) item
  );
  v_extra_media := array(
    select btrim(item) from
      unnest(coalesce(p_additional_media_urls,'{}'::text[])) item
  );

  v_base_result := public.stage_save_musician_portfolio_v2(
    p_slug,p_bio,p_city,p_instruments,p_genres,p_media_url,
    p_price_mode,p_reference_fee,p_is_published,p_headline,
    p_theme,p_accent,p_layout_style,p_avatar_url,p_cover_url
  );
  if v_base_result <> 'saved' then
    return v_base_result;
  end if;

  update public.musician_portfolios
  set experience_years = p_experience_years::smallint,
      performance_types = v_performance,
      career_highlights = v_highlights,
      availability_note = v_availability,
      additional_media_urls = v_extra_media,
      instagram_url = v_instagram,
      youtube_url = v_youtube,
      spotify_url = v_spotify
  where profile_id = auth.uid();

  return 'saved';
end;
$$;
revoke all on function public.stage_save_musician_portfolio_v3(
  text,text,text,text[],text[],text,text,numeric,boolean,
  text,text,text,text,text,text,integer,text[],text[],text,
  text[],text,text,text
) from PUBLIC;
grant execute on function public.stage_save_musician_portfolio_v3(
  text,text,text,text[],text[],text,text,numeric,boolean,
  text,text,text,text,text,text,integer,text[],text[],text,
  text[],text,text,text
) to authenticated;
