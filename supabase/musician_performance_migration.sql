-- STAGE FLOW | Desempenho privado do músico
-- Pré-requisitos: portfólio de músico publicado (migrações anteriores),
-- eventos/convites, marketplace_private_launch_migration.sql e
-- marketplace_moderation_migration.sql.
-- Não lança o marketplace nem modifica a flag launched.
-- Métricas agregadas por dia: NÃO armazena IP, navegador, fingerprint,
-- e-mail ou identidade de quem visualizou o portfólio.
-- Contagens aproximadas, sujeitas a tráfego automatizado.
-- Executar SOMENTE este SQL depois das migrações acima.

create table if not exists public.stage_musician_metrics_daily (
  musician_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  portfolio_views bigint not null default 0
    check (portfolio_views >= 0),
  search_impressions bigint not null default 0
    check (search_impressions >= 0),
  featured_impressions bigint not null default 0
    check (featured_impressions >= 0),
  marketplace_profile_opens bigint not null default 0
    check (marketplace_profile_opens >= 0),
  updated_at timestamptz not null default now(),
  primary key(musician_id,day)
);
create index if not exists stage_musician_metrics_day_idx
  on public.stage_musician_metrics_daily(day);

alter table public.stage_musician_metrics_daily enable row level security;
revoke all on public.stage_musician_metrics_daily
  from public,anon,authenticated;

-- Contagem de visita SOMENTE se o portfólio gratuito estiver publicado.
-- Não é executada no editor nem quando o dono abre sua própria página logado.
-- Visitantes não fornecem ou recebem identificadores internos do perfil.
create or replace function public.stage_track_musician_portfolio_view(
  p_slug text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_musician_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_slug is null or char_length(p_slug) not between 3 and 30
    or p_slug !~ '^[a-z0-9-]+$'
  then return 'invalid';end if;

  select m.profile_id into v_musician_id
  from public.musician_portfolios m
  join public.profiles p on p.id=m.profile_id
  where m.slug=p_slug and m.is_published=true and p.is_artist=true;
  if v_musician_id is null then return 'not_found';end if;
  if auth.uid()=v_musician_id then return 'ignored_owner';end if;

  insert into public.stage_musician_metrics_daily
    (musician_id,day,portfolio_views)
  values (v_musician_id,v_today,1)
  on conflict(musician_id,day)do update set
    portfolio_views=public.stage_musician_metrics_daily.portfolio_views+1,
    updated_at=now();

  return 'recorded';
end;
$$;
revoke all on function public.stage_track_musician_portfolio_view(text)
  from public,anon,authenticated;
grant execute on function public.stage_track_musician_portfolio_view(text)
  to anon,authenticated;

-- Contagem de cartões efetivamente retornados ao navegador na busca ou
-- no carrossel e cliques em "Ver portfólio". Não significa visualização
-- humana confirmada; frontend deduplica por navegador/dia/superfície.
-- Somente IDs elegíveis ao marketplace são contabilizados e somente
-- com gate de lançamento / allowlist autorizada.
create or replace function public.stage_track_marketplace_metrics(
  p_musician_ids uuid[],p_surface text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_count integer := 0;
begin
  if not public.stage_marketplace_gate() then
    return jsonb_build_object('status','not_released','recorded',0);
  end if;

  if p_surface is null or p_surface not in
      ('search','featured','profile_open')
    or p_musician_ids is null
    or cardinality(p_musician_ids) not between 1 and 18
    or array_position(p_musician_ids,null) is not null
  then return jsonb_build_object('status','invalid','recorded',0);end if;

  -- Uma linha por ID solicitado, sempre validando elegibilidade.
  with requested as (
    select distinct musician_id
    from unnest(p_musician_ids) as musician_id
  ), eligible as (
    select m.profile_id as musician_id
    from requested req
    join public.musician_portfolios m on m.profile_id=req.musician_id
    join public.profiles p on p.id=m.profile_id
    join public.stage_marketplace_musician_settings s
      on s.musician_id=m.profile_id
    where m.is_published=true and p.is_artist=true
      and s.listed=true
      and not exists(select 1 from public.stage_marketplace_hidden_musicians h
        where h.musician_id=m.profile_id)
      and (auth.uid() is null or auth.uid()<>m.profile_id)
  ), added as (
    insert into public.stage_musician_metrics_daily
      (musician_id,day,search_impressions,featured_impressions,
       marketplace_profile_opens)
    select musician_id,v_today,
      case when p_surface='search' then 1 else 0 end,
      case when p_surface='featured' then 1 else 0 end,
      case when p_surface='profile_open' then 1 else 0 end
    from eligible
    on conflict(musician_id,day)do update set
      search_impressions=public.stage_musician_metrics_daily.search_impressions
        +excluded.search_impressions,
      featured_impressions=public.stage_musician_metrics_daily.featured_impressions
        +excluded.featured_impressions,
      marketplace_profile_opens=public.stage_musician_metrics_daily.marketplace_profile_opens
        +excluded.marketplace_profile_opens,
      updated_at=now()
    returning 1
  )
  select count(*) into v_count from added;

  return jsonb_build_object('status','recorded','recorded',v_count);
end;
$$;
revoke all on function public.stage_track_marketplace_metrics(uuid[],text)
  from public,anon,authenticated;
grant execute on function public.stage_track_marketplace_metrics(uuid[],text)
  to anon,authenticated;

-- Relatório autenticado exclusivo do dono do portfólio.
-- Convites são consultados diretamente da tabela real, sem estimativas
-- nem alteração em suas decisões ou negociações.
create or replace function public.stage_my_musician_performance(
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_start date;
  v_daily jsonb := '[]'::jsonb;
  v_totals jsonb;
  v_published boolean := false;
  v_listed boolean := false;
  v_marketplace_live boolean := false;
  v_name text := '';
  v_slug text;
begin
  if auth.uid() is null then
    return jsonb_build_object('status','login_required');end if;
  if not exists(select 1 from public.profiles
    where id=auth.uid() and is_artist=true)
  then return jsonb_build_object('status','artist_required');end if;
  if p_days is null or p_days not in (7,30,90)
  then return jsonb_build_object('status','invalid_range');end if;

  v_start := v_today - (p_days-1);

  select coalesce(p.display_name,''),m.slug,
    coalesce(m.is_published,false),
    coalesce(s.listed,false)
  into v_name,v_slug,v_published,v_listed
  from public.profiles p
  left join public.musician_portfolios m on m.profile_id=p.id
  left join public.stage_marketplace_musician_settings s
    on s.musician_id=p.id
  where p.id=auth.uid();

  select coalesce(launched,false) into v_marketplace_live
  from public.stage_marketplace_control where id=true;

  with by_day as (
    select series.day::date as day,
      coalesce(m.portfolio_views,0) as portfolio_views,
      coalesce(m.search_impressions,0) as search_impressions,
      coalesce(m.featured_impressions,0) as featured_impressions,
      coalesce(m.marketplace_profile_opens,0) as marketplace_profile_opens,
      coalesce(i.invitations_received,0) as invitations_received
    from generate_series(v_start::timestamp,v_today::timestamp,
      interval '1 day') as series(day)
    left join public.stage_musician_metrics_daily m
      on m.day=series.day::date and m.musician_id=auth.uid()
    left join (
      select (created_at at time zone 'America/Sao_Paulo')::date as day,
        count(*)::bigint as invitations_received
      from public.invitations
      where musician_id=auth.uid()
        and created_at >= (v_start::timestamp at time zone 'America/Sao_Paulo')
      group by (created_at at time zone 'America/Sao_Paulo')::date
    ) i on i.day=series.day::date
  )
  select
    jsonb_build_object(
      'portfolio_views',coalesce(sum(portfolio_views),0),
      'search_impressions',coalesce(sum(search_impressions),0),
      'featured_impressions',coalesce(sum(featured_impressions),0),
      'marketplace_profile_opens',coalesce(sum(marketplace_profile_opens),0),
      'invitations_received',coalesce(sum(invitations_received),0)
    ),
    coalesce(jsonb_agg(
      jsonb_build_object('day',day,
        'portfolio_views',portfolio_views,
        'search_impressions',search_impressions,
        'featured_impressions',featured_impressions,
        'marketplace_profile_opens',marketplace_profile_opens,
        'invitations_received',invitations_received
      ) order by day),'[]'::jsonb)
  into v_totals,v_daily
  from by_day;

  return jsonb_build_object(
    'status','ok',
    'days',p_days,'start_date',v_start,'end_date',v_today,
    'name',v_name,'slug',v_slug,
    'portfolio_published',v_published,
    'listed_in_marketplace',v_listed,
    'marketplace_launched',coalesce(v_marketplace_live,false),
    'totals',v_totals,'daily',v_daily,
    'invitation_status',(
      select jsonb_build_object(
        'accepted',count(*) filter(where status='accepted'),
        'pending',count(*) filter(where status='pending'),
        'declined',count(*) filter(where status='declined'),
        'cancelled',count(*) filter(where status='cancelled')
      ) from public.invitations
      where musician_id=auth.uid()
        and created_at >= (v_start::timestamp at time zone 'America/Sao_Paulo')
        and created_at < ((v_today+1)::timestamp at time zone 'America/Sao_Paulo')
    )
  );
end;
$$;
revoke all on function public.stage_my_musician_performance(integer)
  from public,anon,authenticated;
grant execute on function public.stage_my_musician_performance(integer)
  to authenticated;

-- Três regras importantes:
-- 1. Desempenho só do próprio músico; não há endpoint de ranking individual.
-- 2. Exibições são contagens indicativas; sem rastreamento de visitante pessoal.
-- 3. O marketplace continua bloqueado para o público até ativação explícita.
