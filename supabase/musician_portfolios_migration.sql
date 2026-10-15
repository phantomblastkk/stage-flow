-- Stage Flow • portfólio simples de músico (gratuito e sem subdomínio)
-- O músico decide publicar e escolhe "a partir de R$ X" ou "Sob consulta".
-- Não armazena WhatsApp, e-mail, nem cachês fechados nesta tabela pública.

create table if not exists public.musician_portfolios (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,30}$'),
  bio text not null default '' check (char_length(bio) <= 700),
  city text not null default '' check (char_length(city) <= 120),
  instruments text[] not null default '{}',
  genres text[] not null default '{}',
  media_url text,
  price_mode text not null default 'consult'
    check (price_mode in ('consult', 'from')),
  reference_fee numeric(10,2)
    check (reference_fee is null or reference_fee > 0),
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.musician_portfolios enable row level security;
revoke all on public.musician_portfolios from PUBLIC, anon, authenticated;

-- Perfil completo, apenas para o próprio músico autenticado.
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
    'is_published', coalesce(m.is_published, false)
  )
  from public.profiles p
  left join public.musician_portfolios m on m.profile_id = p.id
  where p.id = auth.uid() and p.is_artist = true
  limit 1;
$$;
revoke all on function public.stage_my_musician_portfolio() from PUBLIC;
grant execute on function public.stage_my_musician_portfolio() to authenticated;

-- Só o próprio artista pode criar/editar seu portfólio.
-- URL pública nunca contém e-mail, telefone ou valores privados dos shows.
create or replace function public.stage_save_musician_portfolio(
  p_slug text,
  p_bio text,
  p_city text,
  p_instruments text[],
  p_genres text[],
  p_media_url text,
  p_price_mode text,
  p_reference_fee numeric,
  p_is_published boolean
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_media text;
  v_instruments text[];
  v_genres text[];
  v_amount numeric(10,2);
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists(select 1 from public.profiles
    where id = auth.uid() and is_artist = true) then return 'artist_required'; end if;

  v_slug := lower(btrim(coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9-]{3,30}$' then return 'invalid_slug'; end if;
  if char_length(coalesce(p_bio, '')) > 700 or char_length(coalesce(p_city, '')) > 120
    then return 'text_too_long'; end if;

  v_instruments := array(
    select btrim(x) from unnest(coalesce(p_instruments, '{}'::text[])) x
    where char_length(btrim(x)) between 2 and 45
  );
  v_genres := array(
    select btrim(x) from unnest(coalesce(p_genres, '{}'::text[])) x
    where char_length(btrim(x)) between 2 and 45
  );
  if array_length(v_instruments, 1) is null and coalesce(p_is_published, false)
    then return 'instruments_required'; end if;
  if cardinality(v_instruments) > 10 or cardinality(v_genres) > 10
    then return 'too_many_tags'; end if;

  v_media := nullif(btrim(coalesce(p_media_url, '')), '');
  if v_media is not null and (char_length(v_media) > 500 or v_media !~* '^https://')
    then return 'invalid_media'; end if;

  if p_price_mode not in ('consult', 'from') or p_price_mode is null
    then return 'invalid_price_mode'; end if;
  if p_price_mode = 'from' then
    if p_reference_fee is null or p_reference_fee <= 0 or p_reference_fee > 999999.99
      or round(p_reference_fee, 2) <> p_reference_fee
      then return 'invalid_price'; end if;
    v_amount := p_reference_fee;
  else
    v_amount := null;
  end if;

  insert into public.musician_portfolios
    (profile_id, slug, bio, city, instruments, genres, media_url,
     price_mode, reference_fee, is_published, updated_at)
  values
    (auth.uid(), v_slug, btrim(coalesce(p_bio, '')),
     btrim(coalesce(p_city, '')), v_instruments, v_genres, v_media,
     p_price_mode, v_amount, coalesce(p_is_published, false), now())
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
      updated_at = now();

  return 'saved';
exception when unique_violation then return 'slug_taken';
end;
$$;
revoke all on function public.stage_save_musician_portfolio(text, text, text, text[], text[], text, text, numeric, boolean) from PUBLIC;
grant execute on function public.stage_save_musician_portfolio(text, text, text, text[], text[], text, text, numeric, boolean) to authenticated;

-- Consulta pública APENAS para portfólios explicitamente publicados.
-- Valor negociado em um evento nunca é exposto aqui.
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
    'reference_fee', case when m.price_mode = 'from' then m.reference_fee else null end
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
