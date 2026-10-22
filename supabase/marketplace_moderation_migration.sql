-- Stage Flow | Moderacao e denuncias do Marketplace (pre-lancamento)
-- Prerequisitos: marketplace_private_launch_migration.sql E
-- marketplace_featured_musicians_migration.sql.
-- NAO publica marketplace; NAO modifica stage_marketplace_control.launched.
-- Ninguem vira moderador automaticamente. O administrador autoriza no SQL Editor.
-- Avaliacao denunciada nao e ocultada automaticamente: requer acao humana.

create table if not exists public.stage_marketplace_moderators (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);

create table if not exists public.stage_marketplace_hidden_musicians (
  musician_id uuid primary key references public.profiles(id) on delete cascade,
  moderator_id uuid not null references public.profiles(id),
  explanation text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.stage_marketplace_hidden_reviews (
  review_id uuid primary key references public.stage_marketplace_reviews(id) on delete cascade,
  moderator_id uuid not null references public.profiles(id),
  explanation text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.stage_marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('musician','review')),
  musician_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid references public.stage_marketplace_reviews(id) on delete set null,
  reason text not null check (reason in
    ('spam','impersonation','inappropriate','misleading','other')),
  details text not null default '' check (char_length(details) <= 900),
  status text not null default 'open' check (status in ('open','dismissed','resolved')),
  moderator_id uuid references public.profiles(id),
  moderator_note text not null default '' check (char_length(moderator_note) <= 500),
  last_action text check(last_action in ('dismiss','hide','restore')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists stage_marketplace_reports_status_idx
  on public.stage_marketplace_reports(status,created_at desc);
create index if not exists stage_marketplace_reports_reporter_recent_idx
  on public.stage_marketplace_reports(reporter_id,created_at desc);
create unique index if not exists stage_marketplace_reports_open_musician_unique
  on public.stage_marketplace_reports(reporter_id,musician_id)
  where target_type='musician' and status='open';
create unique index if not exists stage_marketplace_reports_open_review_unique
  on public.stage_marketplace_reports(reporter_id,review_id)
  where target_type='review' and status='open';

create table if not exists public.stage_marketplace_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.stage_marketplace_reports(id) on delete set null,
  moderator_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('musician','review')),
  target_id uuid not null,
  action text not null check (action in ('dismiss','hide','restore')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists stage_marketplace_audit_recent_idx
  on public.stage_marketplace_moderation_audit(created_at desc);

alter table public.stage_marketplace_moderators enable row level security;
alter table public.stage_marketplace_hidden_musicians enable row level security;
alter table public.stage_marketplace_hidden_reviews enable row level security;
alter table public.stage_marketplace_reports enable row level security;
alter table public.stage_marketplace_moderation_audit enable row level security;
revoke all on public.stage_marketplace_moderators from public,anon,authenticated;
revoke all on public.stage_marketplace_hidden_musicians from public,anon,authenticated;
revoke all on public.stage_marketplace_hidden_reviews from public,anon,authenticated;
revoke all on public.stage_marketplace_reports from public,anon,authenticated;
revoke all on public.stage_marketplace_moderation_audit from public,anon,authenticated;

-- Funcao interna. Sem permissao de execucao pelo cliente.
create or replace function public.stage_marketplace_is_moderator()
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.stage_marketplace_moderators a
    where a.profile_id=auth.uid()
  );
$$;
revoke all on function public.stage_marketplace_is_moderator() from public,anon,authenticated;

-- A interface chama apenas status bool; nenhuma identidade de moderadores e exposta.
create or replace function public.stage_marketplace_moderator_status()
returns boolean language sql stable security definer set search_path=''
as $$
  select public.stage_marketplace_is_moderator();
$$;
revoke all on function public.stage_marketplace_moderator_status() from public,anon,authenticated;
grant execute on function public.stage_marketplace_moderator_status() to authenticated;

-- Denuncias somente por conta logada com acesso ao catalogo.
-- Um relato em aberto por denunciante/alvo e no maximo 5 novos em 24 horas.
-- Uma denuncia nao altera imediatamente a visibilidade do denunciado.
create or replace function public.stage_marketplace_report(
  p_type text, p_target_id uuid, p_reason text, p_details text
)
returns text language plpgsql security definer set search_path=''
as $$
declare
  v_musician_id uuid;
  v_details text:=btrim(coalesce(p_details,''));
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not public.stage_marketplace_gate() then return 'not_released'; end if;
  if p_target_id is null or p_type is null
    or p_type not in ('musician','review')
    or p_reason is null
    or p_reason not in ('spam','impersonation','inappropriate','misleading','other')
    or char_length(v_details)>900
  then return 'invalid'; end if;

  if p_type='musician' then
    select m.profile_id into v_musician_id
    from public.musician_portfolios m
    join public.stage_marketplace_musician_settings s
      on s.musician_id=m.profile_id and s.listed=true
    where m.profile_id=p_target_id and m.is_published=true
      and not exists(
        select 1 from public.stage_marketplace_hidden_musicians x
        where x.musician_id=m.profile_id
      );
  else
    select r.musician_id into v_musician_id
    from public.stage_marketplace_reviews r
    join public.musician_portfolios m
      on m.profile_id=r.musician_id and m.is_published=true
    join public.stage_marketplace_musician_settings s
      on s.musician_id=m.profile_id and s.listed=true
    where r.id=p_target_id
      and not exists(select 1 from public.stage_marketplace_hidden_musicians x
        where x.musician_id=r.musician_id)
      and not exists(select 1 from public.stage_marketplace_hidden_reviews x
        where x.review_id=r.id);
  end if;
  if v_musician_id is null then return 'not_found'; end if;
  if v_musician_id=auth.uid() then return 'own_profile';end if;
  if p_type='review' and exists(
    select 1 from public.stage_marketplace_reviews r
    where r.id=p_target_id and r.organizer_id=auth.uid()
  ) then return 'own_review';end if;

  -- Serializa as novas denuncias do mesmo usuario, inclusive alvos diferentes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text,432107)
  );
  if exists(
    select 1 from public.stage_marketplace_reports r
    where r.reporter_id=auth.uid() and r.status='open'
      and r.target_type=p_type
      and (case when p_type='review'
        then r.review_id=p_target_id
        else r.musician_id=p_target_id end)
  ) then return 'already_reported';end if;

  if (select count(*) from public.stage_marketplace_reports
      where reporter_id=auth.uid()
        and created_at>now()-interval '24 hours')>=5
  then return 'rate_limited';end if;

  insert into public.stage_marketplace_reports
    (reporter_id,target_type,musician_id,review_id,reason,details)
  values(auth.uid(),p_type,v_musician_id,
    case when p_type='review' then p_target_id else null end,
    p_reason,v_details);
  return 'submitted';
exception when unique_violation then return 'already_reported';
end;
$$;
revoke all on function public.stage_marketplace_report(text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.stage_marketplace_report(text,uuid,text,text)
  to authenticated;

-- Consulta das denuncias e de seus estados, exclusiva para moderadores.
-- Nunca fornecer esses dados a outros usuarios por componente ou RPC.
create or replace function public.stage_marketplace_moderation_reports(
  p_filter text default 'open', p_limit integer default 40, p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_list jsonb;v_total bigint;
begin
  if not public.stage_marketplace_is_moderator()
    then return jsonb_build_object('status','forbidden','items','[]'::jsonb,'total',0);end if;
  if p_filter is null or p_filter not in ('open','all','dismissed','resolved')
    or p_limit is null or p_limit<1 or p_limit>100
    or p_offset is null or p_offset<0 or p_offset>10000
  then return jsonb_build_object('status','invalid','items','[]'::jsonb,'total',0);end if;

  with scoped as (
    select r.*, p.display_name as musician_name,
      q.display_name as reporter_name,
      v.comment as review_comment,
      v.rating as review_rating,
      (h.musician_id is not null) as musician_hidden,
      (hr.review_id is not null) as review_hidden
    from public.stage_marketplace_reports r
    join public.profiles p on p.id=r.musician_id
    join public.profiles q on q.id=r.reporter_id
    left join public.stage_marketplace_reviews v on v.id=r.review_id
    left join public.stage_marketplace_hidden_musicians h
      on h.musician_id=r.musician_id
    left join public.stage_marketplace_hidden_reviews hr
      on hr.review_id=r.review_id
    where p_filter='all' or r.status=p_filter
  ), page as (
    select * from scoped
    order by case when status='open' then 0 else 1 end, created_at desc,id desc
    limit p_limit offset p_offset
  )
  select
    (select count(*) from scoped),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'target_type',target_type,'musician_id',musician_id,
      'musician_name',musician_name,'review_id',review_id,
      'review_comment',review_comment,'review_rating',review_rating,
      'reporter_name',reporter_name,'reason',reason,'details',details,
      'status',status,'last_action',last_action,
      'moderator_note',moderator_note,'created_at',created_at,
      'reviewed_at',reviewed_at,'musician_hidden',musician_hidden,
      'review_hidden',review_hidden
    ) order by case when status='open' then 0 else 1 end,created_at desc,id desc)
      from page),'[]'::jsonb)
  into v_total,v_list;
  return jsonb_build_object('status','ok','items',v_list,'total',v_total);
end;
$$;
revoke all on function public.stage_marketplace_moderation_reports(text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.stage_marketplace_moderation_reports(text,integer,integer)
  to authenticated;

-- Decisao explicita e rastreavel: ocultar, restaurar ou descartar.
-- Ocultacao afeta exclusivamente o marketplace, NAO apaga portfolio original.
-- O proprio organizador continua vendo seu historico de convites/negociacoes.
create or replace function public.stage_marketplace_moderate_report(
  p_report_id uuid,p_action text,p_note text
)
returns text language plpgsql security definer set search_path=''
as $$
declare
  v_report public.stage_marketplace_reports%rowtype;
  v_note text:=btrim(coalesce(p_note,''));
  v_target uuid;
begin
  if not public.stage_marketplace_is_moderator() then return 'forbidden';end if;
  if p_report_id is null or p_action is null
    or p_action not in ('hide','restore','dismiss')
    or char_length(v_note)>500 or char_length(v_note)<5
  then return 'invalid';end if;

  select * into v_report
  from public.stage_marketplace_reports
  where id=p_report_id for update;
  if not found then return 'report_not_found';end if;
  v_target := case when v_report.target_type='musician'
    then v_report.musician_id else v_report.review_id end;

  if p_action<>'dismiss' and v_target is null then return 'target_not_found';end if;
  if p_action='hide' then
    if v_report.target_type='musician' then
      insert into public.stage_marketplace_hidden_musicians
        (musician_id,moderator_id,explanation)
      values(v_report.musician_id,auth.uid(),v_note)
      on conflict(musician_id)do update set
        moderator_id=excluded.moderator_id,
        explanation=excluded.explanation,
        created_at=now();
    else
      insert into public.stage_marketplace_hidden_reviews
        (review_id,moderator_id,explanation)
      values(v_report.review_id,auth.uid(),v_note)
      on conflict(review_id)do update set
        moderator_id=excluded.moderator_id,
        explanation=excluded.explanation,
        created_at=now();
    end if;
  elsif p_action='restore' then
    if v_report.target_type='musician' then
      delete from public.stage_marketplace_hidden_musicians
      where musician_id=v_report.musician_id;
    else
      delete from public.stage_marketplace_hidden_reviews
      where review_id=v_report.review_id;
    end if;
  end if;

  update public.stage_marketplace_reports
  set status=case when p_action='dismiss' then 'dismissed' else 'resolved' end,
      moderator_id=auth.uid(),
      moderator_note=v_note,
      last_action=p_action,
      reviewed_at=now()
  where id=p_report_id;

  insert into public.stage_marketplace_moderation_audit(
    report_id,moderator_id,target_type,target_id,action,note
  ) values(p_report_id,auth.uid(),v_report.target_type,
    coalesce(v_target,v_report.musician_id),p_action,v_note);
  return 'saved';
end;
$$;
revoke all on function public.stage_marketplace_moderate_report(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.stage_marketplace_moderate_report(uuid,text,text)
  to authenticated;

-- A aplicacao de ocultacoes aos feeds, ranking, convites e avaliacoes
-- e feita pelas substituicoes de RPCs ao final deste arquivo.


-- Substitui apenas as RPCs que montam a vitrine; nao altera o SQL
-- de lancamento e nao modifica portfólios publicos independentes.
-- Hidden reviews nao participam de medias ou contagens.
create or replace function public.stage_marketplace_search(
  p_query text default '',
  p_city text default '',
  p_instrument text default '',
  p_genre text default '',
  p_max_fee numeric default null,
  p_date date default null,
  p_only_available boolean default false,
  p_only_favorites boolean default false,
  p_sort text default 'recent',
  p_limit integer default 18,
  p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
        v_total integer;
        v_query text:=left(btrim(coalesce(p_query,'')),90);
        v_city text:=left(btrim(coalesce(p_city,'')),90);
        v_instr text:=left(btrim(coalesce(p_instrument,'')),60);
        v_genre text:=left(btrim(coalesce(p_genre,'')),60);
begin
  if not public.stage_marketplace_gate() then
    return jsonb_build_object('status','not_released','items','[]'::jsonb,'total',0);
  end if;
  if p_limit is null or p_limit<1 or p_limit>48 or p_offset is null
    or p_offset<0 or p_offset>10000
    or p_sort not in ('recent','name','experience','rating')
    or (p_max_fee is not null and (p_max_fee<0 or p_max_fee>999999.99))
    or (p_date is not null and (p_date<current_date or p_date>current_date+interval '366 days'))
  then return jsonb_build_object('status','invalid','items','[]'::jsonb,'total',0); end if;
  if p_only_favorites and auth.uid() is null
  then return jsonb_build_object('status','login_required','items','[]'::jsonb,'total',0); end if;

  with eligible as (
    select p.id as musician_id,p.display_name,m.slug,m.headline,m.bio,m.city,
      m.instruments,m.genres,m.avatar_url,m.cover_url,m.media_url,
      m.price_mode,
      case when m.price_mode='from' then m.reference_fee else null end as reference_fee,
      m.experience_years,m.performance_types,m.availability_note,m.updated_at,
      s.availability_mode,s.blocked_dates,
      coalesce(r.rating_avg,0) as rating_avg,coalesce(r.rating_count,0) as rating_count,
      (f.owner_id is not null) as is_favorite
    from public.musician_portfolios m
    join public.profiles p on p.id=m.profile_id
    join public.stage_marketplace_musician_settings s
      on s.musician_id=m.profile_id and s.listed=true
    left join lateral (
      select round(avg(rating)::numeric,1) rating_avg,count(*)::integer rating_count
      from public.stage_marketplace_reviews rr
      where rr.musician_id=m.profile_id
        and not exists(select 1 from public.stage_marketplace_hidden_reviews hr
          where hr.review_id=rr.id)
    ) r on true
    left join public.stage_marketplace_favorites f
      on f.owner_id=auth.uid() and f.musician_id=m.profile_id
    where m.is_published=true and p.is_artist=true
      and not exists(select 1 from public.stage_marketplace_hidden_musicians hm
        where hm.musician_id=m.profile_id)
      and (v_query='' or p.display_name ilike '%'||v_query||'%'
        or m.headline ilike '%'||v_query||'%'
        or exists(select 1 from unnest(m.instruments) a where a ilike '%'||v_query||'%'))
      and (v_city='' or m.city ilike '%'||v_city||'%')
      and (v_instr='' or exists(select 1 from unnest(m.instruments) a
        where a ilike '%'||v_instr||'%'))
      and (v_genre='' or exists(select 1 from unnest(m.genres) a
        where a ilike '%'||v_genre||'%'))
      and (p_max_fee is null or (m.price_mode='from'
        and m.reference_fee<=p_max_fee))
      and (not p_only_favorites or f.owner_id is not null)
      and (not coalesce(p_only_available,false) or
         (s.availability_mode='accepting'
           and (p_date is null or not p_date=any(s.blocked_dates))))
  ), ordered as (
    select * from eligible order by
      case when p_sort='rating' then rating_avg end desc nulls last,
      case when p_sort='rating' then rating_count end desc nulls last,
      case when p_sort='experience' then experience_years end desc nulls last,
      case when p_sort='name' then display_name end asc,
      case when p_sort='recent' then updated_at end desc nulls last,
      display_name asc,musician_id asc
    limit p_limit offset p_offset
  )
  select
    (select count(*) from eligible),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'musician_id',o.musician_id,'name',o.display_name,
        'slug',o.slug,'headline',o.headline,'city',o.city,
        'instruments',o.instruments,'genres',o.genres,
        'avatar_url',o.avatar_url,'cover_url',o.cover_url,
        'price_mode',o.price_mode,'reference_fee',o.reference_fee,
        'experience_years',o.experience_years,'performance_types',o.performance_types,
        'availability_note',o.availability_note,'availability_mode',o.availability_mode,
        'date_blocked',case when p_date is null then false
          else p_date=any(o.blocked_dates) end,
        'rating_avg',o.rating_avg,'rating_count',o.rating_count,
        'is_favorite',o.is_favorite
      ) order by
        case when p_sort='rating' then o.rating_avg end desc nulls last,
        case when p_sort='rating' then o.rating_count end desc nulls last,
        case when p_sort='experience' then o.experience_years end desc nulls last,
        case when p_sort='name' then o.display_name end asc,
        case when p_sort='recent' then o.updated_at end desc nulls last,
        o.display_name asc,o.musician_id asc)
      from ordered o
    ),'[]'::jsonb)
  into v_total,v_items;

  return jsonb_build_object('status','ok','items',v_items,
    'total',v_total,'limit',p_limit,'offset',p_offset);
end;
$$;

create or replace function public.stage_marketplace_featured()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  if not public.stage_marketplace_gate() then
    return jsonb_build_object('status','not_released','items','[]'::jsonb);
  end if;

  with ranked as (
    select
      p.id as musician_id,
      p.display_name as name,
      m.slug,
      m.headline,
      m.city,
      m.instruments,
      m.genres,
      m.avatar_url,
      m.cover_url,
      m.price_mode,
      case when m.price_mode='from' then m.reference_fee else null end as reference_fee,
      m.experience_years,
      m.performance_types,
      m.availability_note,
      s.availability_mode,
      coalesce(r.rating_avg,0) as rating_avg,
      coalesce(r.rating_count,0) as rating_count,
      (f.owner_id is not null) as is_favorite
    from public.musician_portfolios m
    join public.profiles p on p.id=m.profile_id
    join public.stage_marketplace_musician_settings s
      on s.musician_id=m.profile_id
    cross join lateral (
      select
        round(avg(v.rating)::numeric,1) as rating_avg,
        count(*)::integer as rating_count
      from public.stage_marketplace_reviews v
      where v.musician_id=m.profile_id
        and not exists(select 1 from public.stage_marketplace_hidden_reviews hr
          where hr.review_id=v.id)
    ) r
    left join public.stage_marketplace_favorites f
      on f.owner_id=auth.uid() and f.musician_id=m.profile_id
    where m.is_published=true
      and p.is_artist=true
      and not exists(select 1 from public.stage_marketplace_hidden_musicians hm
        where hm.musician_id=m.profile_id)
      and s.listed=true
      and s.availability_mode <> 'unavailable'
      and r.rating_count >= 1
    order by
      r.rating_count desc,
      r.rating_avg desc,
      p.display_name asc,
      p.id asc
    limit 6
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'musician_id', musician_id,
      'name', name,
      'slug',slug,
      'headline',headline,
      'city',city,
      'instruments',instruments,
      'genres',genres,
      'avatar_url',avatar_url,
      'cover_url',cover_url,
      'price_mode',price_mode,
      'reference_fee',reference_fee,
      'experience_years',experience_years,
      'performance_types',performance_types,
      'availability_note',availability_note,
      'availability_mode',availability_mode,
      'date_blocked',false,
      'rating_avg',rating_avg,
      'rating_count',rating_count,
      'is_favorite',is_favorite
    ) order by rating_count desc,rating_avg desc,name asc,musician_id asc
  ),'[]'::jsonb)
  into v_items
  from ranked;

  return jsonb_build_object('status','ok','items',v_items);
end;
$$;

create or replace function public.stage_marketplace_reviews_for_musician(p_musician_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.stage_marketplace_gate() then return '[]'::jsonb;end if;
  if exists(select 1 from public.stage_marketplace_hidden_musicians hm
    where hm.musician_id=p_musician_id) then return '[]'::jsonb;end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',r.id,'organizer_name',p.display_name,
      'rating',r.rating,'comment',r.comment,'created_at',r.created_at
    ) order by r.created_at desc)
    from (
      select * from public.stage_marketplace_reviews
      where musician_id=p_musician_id
        and not exists(select 1 from public.stage_marketplace_hidden_reviews hr
          where hr.review_id=stage_marketplace_reviews.id)
      order by created_at desc limit 30
    ) r join public.profiles p on p.id=r.organizer_id
  ),'[]'::jsonb);
end;
$$;

create or replace function public.stage_marketplace_toggle_favorite(
  p_musician_id uuid,p_favorite boolean
)
returns text language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not public.stage_marketplace_gate() then return 'not_released'; end if;
  if p_musician_id is null or p_musician_id=auth.uid() or p_favorite is null
    then return 'invalid'; end if;
  if not exists(select 1 from public.musician_portfolios m
    join public.stage_marketplace_musician_settings s on s.musician_id=m.profile_id
    where m.profile_id=p_musician_id and m.is_published=true and s.listed=true
      and not exists(select 1 from public.stage_marketplace_hidden_musicians hm
        where hm.musician_id=m.profile_id))
    then return 'not_listed'; end if;
  if p_favorite then
    insert into public.stage_marketplace_favorites(owner_id,musician_id)
    values(auth.uid(),p_musician_id) on conflict do nothing;
  else
    delete from public.stage_marketplace_favorites
      where owner_id=auth.uid() and musician_id=p_musician_id;
  end if;
  return 'saved';
end;
$$;

create or replace function public.stage_marketplace_invite_musician(
  p_event_id uuid,p_musician_id uuid,p_message text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_status text;
        v_message text:=nullif(btrim(coalesce(p_message,'')),'');
begin
  if auth.uid() is null then return jsonb_build_object('status','login_required'); end if;
  if not public.stage_marketplace_gate() then
    return jsonb_build_object('status','not_released'); end if;
  if p_event_id is null or p_musician_id is null or auth.uid()=p_musician_id
    then return jsonb_build_object('status','invalid'); end if;
  if v_message is not null and char_length(v_message)>500
    then return jsonb_build_object('status','invalid_message'); end if;
  if not exists(select 1 from public.events e where e.id=p_event_id
    and e.producer_id=auth.uid() and e.status in ('draft','published')
    and e.starts_at>=now()) then return jsonb_build_object('status','event_not_found');end if;
  if not exists(
    select 1 from public.musician_portfolios m
    join public.stage_marketplace_musician_settings s on s.musician_id=m.profile_id
    where m.profile_id=p_musician_id and m.is_published=true
      and s.listed=true and s.availability_mode<>'unavailable'
  ) then return jsonb_build_object('status','not_listed');end if;
  -- Um dia bloqueado explicitamente pelo musico nao pode ser convidado
  -- via marketplace. Sao Paulo e a timezone padrao inicial do produto;
  -- horarios de eventos em outros fusos devem ser definidos futuramente.
  if exists (
    select 1 from public.events e
    join public.stage_marketplace_musician_settings s
      on s.musician_id=p_musician_id
    where e.id=p_event_id and e.producer_id=auth.uid()
      and (e.starts_at at time zone 'America/Sao_Paulo')::date
        =any(s.blocked_dates)
  ) then return jsonb_build_object('status','date_unavailable');end if;

  if exists(select 1 from public.stage_marketplace_hidden_musicians hm
    where hm.musician_id=p_musician_id
  ) then return jsonb_build_object('status','not_listed');end if;

  insert into public.invitations(event_id,musician_id,message,status)
  values(p_event_id,p_musician_id,v_message,'pending')
  on conflict(event_id,musician_id)do nothing
  returning id into v_id;
  if v_id is null then
    select i.id,i.status::text into v_id,v_status
    from public.invitations i where i.event_id=p_event_id
      and i.musician_id=p_musician_id limit 1;
    return jsonb_build_object('status','already_exists','invitation_id',v_id,
      'invitation_status',v_status);
  end if;
  return jsonb_build_object('status','sent','invitation_id',v_id);
end;
$$;

create or replace function public.stage_marketplace_submit_review(
  p_event_id uuid,p_musician_id uuid,p_rating integer,p_comment text
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_comment text:=btrim(coalesce(p_comment,''));
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not public.stage_marketplace_gate() then return 'not_released'; end if;
  if p_rating is null or p_rating not between 1 and 5
    or char_length(v_comment)>450 then return 'invalid';end if;
  if exists(select 1 from public.stage_marketplace_hidden_musicians hm
    where hm.musician_id=p_musician_id) then return 'not_eligible';end if;
  if p_musician_id=auth.uid() or not exists(
    select 1 from public.events e
    join public.invitations i on i.event_id=e.id
    where e.id=p_event_id and e.producer_id=auth.uid()
      and e.status='completed' and e.starts_at<now()
      and i.musician_id=p_musician_id and i.status='accepted'
  ) then return 'not_eligible';end if;
  if exists(select 1 from public.stage_marketplace_reviews
    where event_id=p_event_id and musician_id=p_musician_id)
    then return 'already_reviewed';end if;
  insert into public.stage_marketplace_reviews(
    organizer_id,musician_id,event_id,rating,comment)
  values(auth.uid(),p_musician_id,p_event_id,p_rating,v_comment);
  return 'saved';
exception when unique_violation then return 'already_reviewed';
end;
$$;
