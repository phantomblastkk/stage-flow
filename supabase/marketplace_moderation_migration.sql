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
  if p_target_id is null or p_type not in ('musician','review')
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
  if p_filter not in ('open','all','dismissed','resolved')
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
  if p_report_id is null or p_action not in ('hide','restore','dismiss')
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
