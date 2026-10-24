-- Stage Flow | Calendário privado de disponibilidade e conflitos (QA / develop)
-- Fuso de referência: America/Sao_Paulo. Intervalos na mesma data, sem pernoite.
begin;

create table if not exists public.stage_musician_availability_rules (
 id uuid primary key default gen_random_uuid(),
 musician_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('day','weekly')),
 title text not null default 'Indisponível' check(char_length(btrim(title)) between 1 and 100),
 block_date date, weekday smallint,
 start_minute integer not null default 0 check(start_minute between 0 and 1439),
 end_minute integer not null default 1440 check(end_minute between 1 and 1440),
 valid_from date, valid_until date,
 created_at timestamptz not null default now(),
 check(start_minute<end_minute),
 check((kind='day' and block_date is not null and weekday is null
          and valid_from is null and valid_until is null)
    or (kind='weekly' and block_date is null and weekday between 1 and 7
          and valid_from is not null and valid_until is not null
          and valid_from<=valid_until))
);
create index if not exists stage_musician_availability_owner_idx
 on public.stage_musician_availability_rules(musician_id,kind,block_date,weekday);
alter table public.stage_musician_availability_rules enable row level security;
revoke all on public.stage_musician_availability_rules from public,anon,authenticated;

create or replace function public.stage_musician_schedule_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_data jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'kind',r.kind,'title',r.title,
  'block_date',r.block_date,'weekday',r.weekday,
  'start_minute',r.start_minute,'end_minute',r.end_minute,
  'valid_from',r.valid_from,'valid_until',r.valid_until
 ) order by r.kind,r.block_date,r.weekday,r.start_minute),'[]'::jsonb)
 into v_data
 from (select * from public.stage_musician_availability_rules
   where musician_id=auth.uid() order by created_at desc limit 200) r;
 return jsonb_build_object('status','ok','items',v_data);
end;
$$;
revoke all on function public.stage_musician_schedule_list() from public,anon,authenticated;
grant execute on function public.stage_musician_schedule_list() to authenticated;

create or replace function public.stage_musician_schedule_save(
 p_kind text,p_title text,p_date date,p_weekday smallint,
 p_start integer,p_end integer,p_from date default null,p_until date default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_title text:=btrim(coalesce(p_title,''));
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_kind not in ('day','weekly') or char_length(v_title) not between 1 and 100
  or p_start is null or p_end is null or p_start<0 or p_start>=1440
  or p_end<=p_start or p_end>1440
  or (p_kind='day' and (p_date is null or p_weekday is not null
     or p_from is not null or p_until is not null))
  or (p_kind='weekly' and (p_date is not null or p_weekday not between 1 and 7
     or p_from is null or p_until is null or p_until<p_from))
 then return jsonb_build_object('status','invalid');end if;
 if p_kind='day' and (p_date<current_date-interval '1 day'
    or p_date>current_date+interval '366 days')
  or p_kind='weekly' and (p_from<current_date-interval '1 day'
    or p_until>current_date+interval '366 days'
    or p_until>p_from+interval '366 days')
 then return jsonb_build_object('status','invalid_date');end if;
 if (select count(*) from public.stage_musician_availability_rules
   where musician_id=auth.uid())>=100
 then return jsonb_build_object('status','limit_reached');end if;
 insert into public.stage_musician_availability_rules(
  musician_id,kind,title,block_date,weekday,
  start_minute,end_minute,valid_from,valid_until
 ) values (
  auth.uid(),p_kind,v_title,p_date,p_weekday,p_start,p_end,p_from,p_until
 ) returning id into v_id;
 return jsonb_build_object('status','ok','id',v_id);
end;
$$;
revoke all on function public.stage_musician_schedule_save(
 text,text,date,smallint,integer,integer,date,date) from public,anon,authenticated;
grant execute on function public.stage_musician_schedule_save(
 text,text,date,smallint,integer,integer,date,date) to authenticated;

create or replace function public.stage_musician_schedule_remove(p_id uuid)
returns text language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then return 'login_required';end if;
 delete from public.stage_musician_availability_rules
 where id=p_id and musician_id=auth.uid();
 if not found then return 'not_found';end if;
 return 'removed';
end;
$$;
revoke all on function public.stage_musician_schedule_remove(uuid) from public,anon,authenticated;
grant execute on function public.stage_musician_schedule_remove(uuid) to authenticated;

-- Somente o músico ou membro de uma conversa PRIVADA com ele.
-- Nenhum título, banda ou endereço é exposto ao contratante.
-- e.ends_at opcional => janela conservadora estimada de 4 horas.
create or replace function public.stage_musician_schedule_check(
 p_musician_id uuid,p_start timestamptz,p_end timestamptz,
 p_thread_id uuid default null,p_ignore_event uuid default null
)
returns text language plpgsql stable security definer set search_path=''
as $$
declare
 v_start_day date;
 v_end_day date;
 v_day date;
 v_start_minute integer;
 v_end_minute integer;
 v_blocked boolean:=false;
 v_pending boolean:=false;
 v_legacy_blocked boolean:=false;
begin
 if auth.uid() is null then return 'forbidden';end if;
 if p_musician_id is null or p_start is null or p_end is null
   or p_start>=p_end or p_end>p_start+interval '16 hours'
   or p_start>now()+interval '366 days'
 then return 'invalid';end if;
 if auth.uid()<>p_musician_id and
  (p_thread_id is null or not exists(select 1 from public.stage_hiring_threads t
    where t.id=p_thread_id and t.musician_id=p_musician_id
      and auth.uid() in (t.requester_id,t.musician_id)))
 then return 'forbidden';end if;
 v_start_day:=(p_start at time zone 'America/Sao_Paulo')::date;
 v_end_day:=((p_end-interval '1 microsecond') at time zone 'America/Sao_Paulo')::date;
 for v_day in select generate_series(v_start_day,v_end_day,interval '1 day')::date loop
   v_start_minute:=case when v_day=v_start_day then
     extract(hour from p_start at time zone 'America/Sao_Paulo')::integer*60+
     extract(minute from p_start at time zone 'America/Sao_Paulo')::integer else 0 end;
   v_end_minute:=case when v_day=v_end_day then
     extract(hour from p_end at time zone 'America/Sao_Paulo')::integer*60+
     extract(minute from p_end at time zone 'America/Sao_Paulo')::integer
     else 1440 end;
   if v_day=v_end_day and v_end_minute=0 and v_end_day>v_start_day then
     v_end_minute:=1440;end if;
   if exists(select 1 from public.stage_musician_availability_rules r
      where r.musician_id=p_musician_id
        and ((r.kind='day' and r.block_date=v_day)
          or (r.kind='weekly' and r.weekday=extract(isodow from v_day)::integer
             and v_day between r.valid_from and r.valid_until))
        and r.start_minute<v_end_minute and r.end_minute>v_start_minute)
   then return 'busy';end if;
 end loop;

 -- Convites aceitos incluem shows de outros cantores; data/horário verificadas no banco.
 if exists(select 1 from public.invitations i
  join public.events e on e.id=i.event_id
  where i.musician_id=p_musician_id and i.status='accepted'
    and e.status<>'cancelled' and (p_ignore_event is null or e.id<>p_ignore_event)
    and e.starts_at<p_end
    and coalesce(e.ends_at,e.starts_at+interval '4 hours')>p_start
 ) then return 'busy';end if;

 -- Mostrar apenas alerta de possível conflito para rascunhos de show próprio
 -- ou propostas pendentes; não bloquear automaticamente algo não confirmado.
 if exists(select 1 from public.events e
   where e.producer_id=p_musician_id and e.status<>'cancelled'
   and (p_ignore_event is null or e.id<>p_ignore_event)
   and e.starts_at<p_end
   and coalesce(e.ends_at,e.starts_at+interval '4 hours')>p_start
 ) then v_pending:=true;end if;
 if exists(select 1 from public.stage_hiring_proposals p
   where p.musician_id=p_musician_id and p.status='pending'
     and p.starts_at<p_end and p.starts_at+interval '4 hours'>p_start
 ) then v_pending:=true;end if;

 -- Compatibilidade com bloqueios do marketplace quando a tabela já existir.
 if to_regclass('public.stage_marketplace_musician_settings') is not null then
   execute 'select exists(select 1 from public.stage_marketplace_musician_settings
      where musician_id=$1 and ($2=any(blocked_dates) or
        availability_mode=''unavailable''))'
     into v_legacy_blocked using p_musician_id,v_start_day;
   if v_legacy_blocked then return 'busy';end if;
 end if;
 if v_pending then return 'possible_conflict';end if;
 return 'free';
end;
$$;
revoke all on function public.stage_musician_schedule_check(
 uuid,timestamptz,timestamptz,uuid,uuid) from public,anon,authenticated;
grant execute on function public.stage_musician_schedule_check(
 uuid,timestamptz,timestamptz,uuid,uuid) to authenticated;

commit;
notify pgrst,'reload schema';
