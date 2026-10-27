-- StageFlow | Expanded public musician portfolio, all free, owner-approved publication.
-- Continues to use the already protected v2 saver and its ownership validation.
begin;
alter table public.musician_portfolios
 drop constraint if exists musician_portfolio_performance_valid,
 drop constraint if exists musician_portfolio_highlights_valid,
 drop constraint if exists musician_portfolio_additional_media_valid;
alter table public.musician_portfolios
 add constraint musician_portfolio_performance_valid check (
   cardinality(performance_types)<=8 and array_position(performance_types,null) is null),
 add constraint musician_portfolio_highlights_valid check (
   cardinality(career_highlights)<=6 and array_position(career_highlights,null) is null),
 add constraint musician_portfolio_additional_media_valid check (
   cardinality(additional_media_urls)<=4 and array_position(additional_media_urls,null) is null);

create or replace function public.stage_save_musician_portfolio_v4(
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

  if coalesce(cardinality(p_performance_types),0) > 8
    or coalesce(cardinality(p_career_highlights),0) > 6
    or coalesce(cardinality(p_additional_media_urls),0) > 4
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
revoke all on function public.stage_save_musician_portfolio_v4(
  text,text,text,text[],text[],text,text,numeric,boolean,
  text,text,text,text,text,text,integer,text[],text[],text,
  text[],text,text,text
) from PUBLIC;
grant execute on function public.stage_save_musician_portfolio_v4(
  text,text,text,text[],text[],text,text,numeric,boolean,
  text,text,text,text,text,text,integer,text[],text[],text,
  text[],text,text,text
) to authenticated;

commit;
notify pgrst, 'reload schema';
