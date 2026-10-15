-- Stage Flow | Personalização do portfólio simples de músico
-- Execute DEPOIS de musician_portfolios_migration.sql.
-- Compatível com portfólios existentes: mantém URLs, valores e publicação.
-- As RPCs v1 continuam disponíveis para compatibilidade com outros clientes.

alter table public.musician_portfolios
  add column if not exists headline text not null default '',
  add column if not exists theme text not null default 'midnight',
  add column if not exists accent text not null default 'lime',
  add column if not exists layout_style text not null default 'spotlight',
  add column if not exists avatar_url text,
  add column if not exists cover_url text;

-- Restringe as opções que podem se tornar variáveis de estilo na interface.
alter table public.musician_portfolios
  drop constraint if exists musician_portfolios_headline_format,
  drop constraint if exists musician_portfolios_theme_allowed,
  drop constraint if exists musician_portfolios_accent_allowed,
  drop constraint if exists musician_portfolios_layout_allowed,
  drop constraint if exists musician_portfolios_avatar_format,
  drop constraint if exists musician_portfolios_cover_format;

alter table public.musician_portfolios
  add constraint musician_portfolios_headline_format check (char_length(headline) <= 110),
  add constraint musician_portfolios_theme_allowed check (theme in ('midnight', 'ivory', 'stage')),
  add constraint musician_portfolios_accent_allowed check (accent in ('lime', 'violet', 'coral', 'cyan', 'gold')),
  add constraint musician_portfolios_layout_allowed check (layout_style in ('spotlight', 'minimal')),
  add constraint musician_portfolios_avatar_format check (
    avatar_url is null or (char_length(avatar_url) <= 2000 and avatar_url ~* '^https://')
  ),
  add constraint musician_portfolios_cover_format check (
    cover_url is null or (char_length(cover_url) <= 2000 and cover_url ~* '^https://')
  );

-- Bucket público apenas para fotos de perfil/capa destinadas a portfólios
-- publicados. Os caminhos de arquivos são UUIDs imprevisíveis.
-- Não grave documentos pessoais, telefones nem imagens privadas neste bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stage-musician-media',
  'stage-musician-media',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[];

drop policy if exists "stage_musician_upload_own_media" on storage.objects;
create policy "stage_musician_upload_own_media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'stage-musician-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_artist = true
  )
);

-- Propositadamente sem delete/update/list para clientes: cada upload usa
-- nome aleatório novo, evitando sobrescrever imagens de terceiros.

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
    'cover_url', m.cover_url
  )
  from public.profiles p
  left join public.musician_portfolios m on m.profile_id = p.id
  where p.id = auth.uid() and p.is_artist = true
  limit 1;
$$;
revoke all on function public.stage_my_musician_portfolio() from PUBLIC;
grant execute on function public.stage_my_musician_portfolio() to authenticated;

-- Só perfis publicados ficam disponíveis sem autenticação.
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
    'cover_url', m.cover_url
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

-- Salva TODOS os campos num único pedido; não altera assinatura ou direitos
-- comerciais. URL de mídia é verificada contra o bucket e o ID do proprietário.
create or replace function public.stage_save_musician_portfolio_v2(
  p_slug text,
  p_bio text,
  p_city text,
  p_instruments text[],
  p_genres text[],
  p_media_url text,
  p_price_mode text,
  p_reference_fee numeric,
  p_is_published boolean,
  p_headline text,
  p_theme text,
  p_accent text,
  p_layout_style text,
  p_avatar_url text,
  p_cover_url text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_slug text;
  v_media text;
  v_instruments text[];
  v_genres text[];
  v_amount numeric(10,2);
  v_avatar text := nullif(btrim(coalesce(p_avatar_url, '')), '');
  v_cover text := nullif(btrim(coalesce(p_cover_url, '')), '');
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists(select 1 from public.profiles where id = auth.uid() and is_artist = true)
    then return 'artist_required'; end if;

  v_slug := lower(btrim(coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9-]{3,30}$' then return 'invalid_slug'; end if;
  if char_length(coalesce(p_bio, '')) > 700
    or char_length(coalesce(p_city, '')) > 120
    or char_length(coalesce(p_headline, '')) > 110
    then return 'text_too_long'; end if;

  if p_theme not in ('midnight','ivory','stage')
    or p_accent not in ('lime','violet','coral','cyan','gold')
    or p_layout_style not in ('spotlight','minimal')
    or p_theme is null or p_accent is null or p_layout_style is null
    then return 'invalid_style'; end if;

  if coalesce(cardinality(p_instruments), 0) > 10
    or coalesce(cardinality(p_genres), 0) > 10
    then return 'too_many_tags'; end if;
  if exists (
    select 1 from unnest(coalesce(p_instruments, '{}'::text[])) val
    where char_length(btrim(coalesce(val,''))) not between 2 and 45
  ) or exists (
    select 1 from unnest(coalesce(p_genres, '{}'::text[])) val
    where char_length(btrim(coalesce(val,''))) not between 2 and 45
  ) then return 'invalid_tag'; end if;

  v_instruments := array(
    select distinct btrim(val) from unnest(coalesce(p_instruments, '{}'::text[])) val
    where char_length(btrim(val)) between 2 and 45
  );
  v_genres := array(
    select distinct btrim(val) from unnest(coalesce(p_genres, '{}'::text[])) val
    where char_length(btrim(val)) between 2 and 45
  );
  if cardinality(v_instruments) = 0 and coalesce(p_is_published,false)
    then return 'instruments_required'; end if;

  v_media := nullif(btrim(coalesce(p_media_url, '')), '');
  if v_media is not null and (char_length(v_media) > 500 or v_media !~* '^https://')
    then return 'invalid_media'; end if;

  if p_price_mode not in ('consult','from') or p_price_mode is null
    then return 'invalid_price_mode'; end if;
  if p_price_mode = 'from' then
    if p_reference_fee is null or p_reference_fee <= 0 or p_reference_fee > 999999.99
      or round(p_reference_fee, 2) <> p_reference_fee
      then return 'invalid_price'; end if;
    v_amount := p_reference_fee;
  else
    v_amount := null;
  end if;

  -- Aceita HTTPS com caminho público do bucket dentro da pasta do usuário.
  -- O cliente usa o endereço retornado por storage.getPublicUrl().
  if v_avatar is not null and
    (char_length(v_avatar) > 2000 or v_avatar !~* '^https://'
     or position('/storage/v1/object/public/stage-musician-media/' ||
         auth.uid()::text || '/' in v_avatar) = 0)
    then return 'invalid_avatar'; end if;
  if v_cover is not null and
    (char_length(v_cover) > 2000 or v_cover !~* '^https://'
     or position('/storage/v1/object/public/stage-musician-media/' ||
         auth.uid()::text || '/' in v_cover) = 0)
    then return 'invalid_cover'; end if;

  insert into public.musician_portfolios
    (profile_id, slug, bio, city, instruments, genres, media_url,
     price_mode, reference_fee, is_published, headline,
     theme, accent, layout_style, avatar_url, cover_url, updated_at)
  values
    (auth.uid(), v_slug, btrim(coalesce(p_bio,'')),
     btrim(coalesce(p_city,'')), v_instruments, v_genres, v_media,
     p_price_mode, v_amount, coalesce(p_is_published,false),
     btrim(coalesce(p_headline,'')), p_theme, p_accent, p_layout_style,
     v_avatar, v_cover, now())
  on conflict (profile_id) do update
  set slug = excluded.slug,
      bio = excluded.bio,
      city = excluded.city,
      instruments = excluded.instruments,
      genres = excluded.genres,
      media_url = excluded.media_url,
      price_mode = excluded.price_mode,
      reference_fee = excluded.reference_fee,
      is_published = excluded.is_published,
      headline = excluded.headline,
      theme = excluded.theme,
      accent = excluded.accent,
      layout_style = excluded.layout_style,
      avatar_url = excluded.avatar_url,
      cover_url = excluded.cover_url,
      updated_at = now();

  return 'saved';
exception when unique_violation then return 'slug_taken';
end;
$$;
revoke all on function public.stage_save_musician_portfolio_v2(
  text,text,text,text[],text[],text,text,numeric,boolean,
  text,text,text,text,text,text
) from PUBLIC;
grant execute on function public.stage_save_musician_portfolio_v2(
  text,text,text,text[],text[],text,text,numeric,boolean,
  text,text,text,text,text,text
) to authenticated;
