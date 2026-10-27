-- Stage Flow · Programação semanal recorrente (somente QA).
-- Instalar depois de fixed_teams_migration.sql, events_migration.sql.
-- Cada ocorrência gera um EVENTO RASCUNHO independente.
-- Nenhum convite é enviado automaticamente; o proprietário decide por show.
begin;

create table if not exists public.stage_recurring_show_series (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  description text check (description is null or char_length(description)<=500),
  venue text check (venue is null or char_length(venue)<=140),
  city text check (city is null or char_length(city)<=100),
  team_id uuid references public.stage_teams(id) on delete set null,
  weekday smallint not null check (weekday between 1 and 7),
  starts_on date not null,
  ends_on date not null,
  local_start time without time zone not null,
  duration_minutes integer not null default 240 check(duration_minutes between 30 and 720),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint stage_recurring_range check(ends_on>=starts_on and ends_on<=starts_on+180),
  unique(owner_id,title,starts_on,weekday,local_start)
);
create index if not exists stage_recurring_owner_idx
 on public.stage_recurring_show_series(owner_id,created_at desc);

create table if not exists public.stage_recurring_show_occurrences(
  series_id uuid not null references public.stage_recurring_show_series(id) on delete cascade,
  event_id uuid not null unique references public.events(id) on delete cascade,
  occurrence_day date not null,
  created_at timestamptz not null default now(),
  primary key(series_id,occurrence_day)
);
create index if not exists stage_recurring_occurrences_event_idx
 on public.stage_recurring_show_occurrences(event_id);

alter table public.stage_recurring_show_series enable row level security;
alter table public.stage_recurring_show_occurrences enable row level security;
revoke all on public.stage_recurring_show_series from PUBLIC,anon,authenticated;
revoke all on public.stage_recurring_show_occurrences from PUBLIC,anon,authenticated;

-- Os dados da formação são privados do dono. Ocorrências e receita futura
-- continuam usando a tabela events + o financeiro existente por event_id.
create or replace function public.stage_recurring_show_list()
returns jsonb language sql stable security definer set search_path=''
as $$
  select case when auth.uid() is null then '[]'::jsonb else
    coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'title',s.title,'description',s.description,
      'venue',s.venue,'city',s.city,
      'weekday',s.weekday,'starts_on',s.starts_on,'ends_on',s.ends_on,
      'local_start',to_char(s.local_start,'HH24:MI'),
      'duration_minutes',s.duration_minutes,'active',s.active,
      'team_id',s.team_id,'team_name',t.name,
      'team_members',(select count(*) from public.stage_team_members tm
         where tm.team_id=s.team_id),
      'occurrences',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'event_id',o.event_id,'day',o.occurrence_day,
          'title',e.title,'starts_at',e.starts_at,'status',e.status,
          'invites_sent',(select count(*) from public.invitations i
            where i.event_id=e.id)
        ) order by o.occurrence_day asc),'[]'::jsonb)
        from public.stage_recurring_show_occurrences o
        join public.events e on e.id=o.event_id
        where o.series_id=s.id
      )
    ) order by s.created_at desc,s.id),'[]'::jsonb) end
  from (
    select * from public.stage_recurring_show_series
    where owner_id=auth.uid() order by created_at desc limit 100
  ) s
  left join public.stage_teams t on t.id=s.team_id
    and t.owner_id=auth.uid();
$$;
revoke all on function public.stage_recurring_show_list() from public,anon,authenticated;
grant execute on function public.stage_recurring_show_list() to authenticated;

-- Explicit generation: up to 8 dates/call, max 52 per series.
-- Uses a row lock for idempotency across simultaneous button clicks.
create or replace function public.stage_recurring_show_generate(p_series_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_series public.stage_recurring_show_series%rowtype;
  v_day date;
  v_start timestamptz;
  v_event uuid;
  v_created integer:=0;
  v_skipped integer:=0;
  v_existing integer;
  v_today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
  select * into v_series from public.stage_recurring_show_series
    where id=p_series_id and owner_id=auth.uid() for update;
  if not found then return jsonb_build_object('status','not_found');end if;
  if not v_series.active then return jsonb_build_object('status','paused');end if;
  select count(*) into v_existing from public.stage_recurring_show_occurrences
    where series_id=p_series_id;
  if v_existing>=52 then return jsonb_build_object('status','limit_reached','total',v_existing);end if;

  for v_day in
    select g::date from generate_series(
      greatest(v_series.starts_on,v_today),
      v_series.ends_on,interval '1 day') g
    where extract(isodow from g)=v_series.weekday
      and not exists(select 1 from public.stage_recurring_show_occurrences o
        where o.series_id=p_series_id and o.occurrence_day=g::date)
    order by g asc limit least(8,52-v_existing)
  loop
    v_start:=make_timestamptz(
      extract(year from v_day)::int,extract(month from v_day)::int,
      extract(day from v_day)::int,
      extract(hour from v_series.local_start)::int,
      extract(minute from v_series.local_start)::int,0,'America/Sao_Paulo'
    );
    -- Não criar apresentações cuja hora já passou, mesmo que o dia seja hoje.
    if v_start<=now() then continue;end if;
    -- Não replicar evento do mesmo organizador na mesma hora (mesmo que
    -- criado por outro fluxo). O registro existente nunca é sobrescrito.
    if exists(select 1 from public.events e
      where e.producer_id=auth.uid() and e.status<>'cancelled'
        and e.starts_at=v_start) then
      v_skipped:=v_skipped+1;
      continue;
    end if;
    insert into public.events(
      producer_id,title,description,venue,city,starts_at,ends_at,status,show_publicly
    ) values(
      auth.uid(),v_series.title,v_series.description,v_series.venue,
      v_series.city,v_start,v_start+make_interval(mins=>v_series.duration_minutes),
      'draft',false
    ) returning id into v_event;
    insert into public.stage_recurring_show_occurrences(series_id,event_id,occurrence_day)
      values(p_series_id,v_event,v_day);
    v_created:=v_created+1;
  end loop;
  return jsonb_build_object('status','ok','created',v_created,
    'skipped_conflicts',v_skipped,
    'total',v_existing+v_created);
end;
$$;
revoke all on function public.stage_recurring_show_generate(uuid) from public,anon,authenticated;
grant execute on function public.stage_recurring_show_generate(uuid) to authenticated;

create or replace function public.stage_recurring_show_create(
  p_title text,p_description text,p_venue text,p_city text,
  p_team_id uuid,p_weekday smallint,p_starts_on date,p_ends_on date,
  p_start_time text,p_duration integer
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_id uuid;
  v_title text:=btrim(coalesce(p_title,''));
  v_description text:=nullif(btrim(coalesce(p_description,'')),'');
  v_venue text:=nullif(btrim(coalesce(p_venue,'')),'');
  v_city text:=nullif(btrim(coalesce(p_city,'')),'');
  v_time time;
  v_today date:=(now() at time zone 'America/Sao_Paulo')::date;
  v_generated jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid()
    and (p.is_artist or p.is_producer)) then return jsonb_build_object('status','forbidden');end if;
  if char_length(v_title) not between 3 and 140
    or char_length(coalesce(v_description,''))>500
    or char_length(coalesce(v_venue,''))>140
    or char_length(coalesce(v_city,''))>100
    or p_weekday is null or p_weekday not between 1 and 7
    or p_starts_on is null or p_ends_on is null
    or p_starts_on<v_today or p_ends_on<p_starts_on
    or p_ends_on>p_starts_on+180
    or p_duration is null or p_duration not between 30 and 720
    or coalesce(p_start_time,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  then return jsonb_build_object('status','invalid');end if;
  if p_team_id is not null and not exists(select 1 from public.stage_teams t
    where t.id=p_team_id and t.owner_id=auth.uid())
  then return jsonb_build_object('status','team_not_found');end if;
  if (select count(*) from public.stage_recurring_show_series
      where owner_id=auth.uid())>=100 then
    return jsonb_build_object('status','limit_reached');end if;

  v_time:=p_start_time::time;
  insert into public.stage_recurring_show_series(
    owner_id,title,description,venue,city,team_id,weekday,
    starts_on,ends_on,local_start,duration_minutes
  ) values(
    auth.uid(),v_title,v_description,v_venue,v_city,p_team_id,p_weekday,
    p_starts_on,p_ends_on,v_time,p_duration
  ) returning id into v_id;

  -- A criação do modelo e das 8 primeiras datas ocorre na MESMA transação.
  v_generated:=public.stage_recurring_show_generate(v_id);
  if v_generated->>'status'<>'ok' then
    raise exception 'Unexpected generation failure: %',v_generated->>'status';
  end if;
  return jsonb_build_object('status','created','series_id',v_id,
    'created',v_generated->'created',
    'skipped_conflicts',v_generated->'skipped_conflicts');
exception when unique_violation then
  return jsonb_build_object('status','duplicate');
end;
$$;
revoke all on function public.stage_recurring_show_create(
  text,text,text,text,uuid,smallint,date,date,text,integer)
  from public,anon,authenticated;
grant execute on function public.stage_recurring_show_create(
  text,text,text,text,uuid,smallint,date,date,text,integer)
  to authenticated;

-- Desativar série impede gerar NOVOS eventos, mas preserva todos os shows,
-- convites e lançamentos financeiros já cadastrados.
create or replace function public.stage_recurring_show_pause(
  p_id uuid,p_active boolean
)
returns text language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then return 'login_required';end if;
  if p_id is null or p_active is null then return 'invalid';end if;
  update public.stage_recurring_show_series set active=p_active
    where id=p_id and owner_id=auth.uid();
  if not found then return 'not_found';end if;
  return 'saved';
end;
$$;
revoke all on function public.stage_recurring_show_pause(uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.stage_recurring_show_pause(uuid,boolean)
 to authenticated;
commit;
notify pgrst,'reload schema';
