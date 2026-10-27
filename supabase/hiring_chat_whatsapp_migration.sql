-- Stage Flow · Chat privado de contratação + fila de notificações WhatsApp.
-- Aplicar somente na homologação. Não lança o marketplace público.
begin;
create table if not exists public.stage_hiring_access (
  profile_id uuid primary key references public.profiles(id) on delete cascade
);
create table if not exists public.stage_hiring_control (
  id boolean primary key default true check(id=true),
  released boolean not null default false
);
insert into public.stage_hiring_control(id,released) values(true,false) on conflict(id) do nothing;
create table if not exists public.stage_hiring_threads(
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references public.profiles(id) on delete cascade,
 musician_id uuid not null references public.profiles(id) on delete cascade,
 event_id uuid references public.events(id) on delete set null,
 requested_date date,
 availability text not null default 'awaiting'
  check(availability in ('awaiting','available','unavailable','ask_later')),
 requester_read_at timestamptz not null default now(),
 musician_read_at timestamptz,
 created_at timestamptz not null default now(),
 last_message_at timestamptz not null default now(),
 check(requester_id<>musician_id)
);
create unique index if not exists stage_hiring_pair_date_event_idx
on public.stage_hiring_threads(requester_id,musician_id,requested_date,event_id) nulls not distinct;
create index if not exists stage_hiring_requester_idx on public.stage_hiring_threads(requester_id,last_message_at desc);
create index if not exists stage_hiring_musician_idx on public.stage_hiring_threads(musician_id,last_message_at desc);

create table if not exists public.stage_hiring_messages(
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.stage_hiring_threads(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create index if not exists stage_hiring_messages_page_idx
on public.stage_hiring_messages(thread_id,created_at desc,id desc);

-- Opt-in separado do contato compartilhável: usuário autoriza avisos do próprio chat.
create table if not exists public.stage_hiring_whatsapp_preferences (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 phone_e164 text not null check(phone_e164 ~ '^[1-9][0-9]{9,14}$'),
 opted_in boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.stage_hiring_whatsapp_outbox(
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.stage_hiring_threads(id) on delete cascade,
 message_id uuid not null unique references public.stage_hiring_messages(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'queued'
   check(status in ('queued','sending','sent','failed','expired')),
 attempted integer not null default 0,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '20 minutes'),
 claimed_at timestamptz,
 provider_id text,
 last_error text
);
create index if not exists stage_hiring_outbox_queue_idx
on public.stage_hiring_whatsapp_outbox(status,created_at);
do $$declare tbl text;begin
 foreach tbl in array array['stage_hiring_access','stage_hiring_control','stage_hiring_threads',
   'stage_hiring_messages','stage_hiring_whatsapp_preferences','stage_hiring_whatsapp_outbox'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
 end loop;
end$$;

-- Acesso apenas por usuário autenticado e liberado para teste ou lançamento.
create or replace function public.stage_hiring_can_start(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid()=p_user and exists (
  select 1 from public.stage_hiring_control c
  where c.id=true and (c.released or exists(
    select 1 from public.stage_hiring_access a where a.profile_id=p_user
  ))
 );
$$;
revoke all on function public.stage_hiring_can_start(uuid) from public,anon,authenticated;
grant execute on function public.stage_hiring_can_start(uuid) to authenticated;

create or replace function public.stage_hiring_start(
 p_musician_id uuid,p_date date default null,p_event_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_thread uuid;v_user uuid:=auth.uid();v_date date:=p_date;
begin
 if v_user is null then return jsonb_build_object('status','login_required');end if;
 if not public.stage_hiring_can_start(v_user) then
  return jsonb_build_object('status','not_released');end if;
 if p_musician_id is null or p_musician_id=v_user
   or not exists(select 1 from public.profiles where id=p_musician_id and is_artist=true)
 then return jsonb_build_object('status','invalid_musician');end if;
 if v_date is not null and (v_date<current_date or v_date>current_date+interval '366 days')
 then return jsonb_build_object('status','invalid_date');end if;
 if p_event_id is not null then
   if not exists(select 1 from public.events
     where id=p_event_id and producer_id=v_user and status<>'cancelled')
   then return jsonb_build_object('status','invalid_event');end if;
 end if;
 -- Adiciona limite diário de novas conversas para impedir varredura e spam.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 330924));
 select id into v_thread from public.stage_hiring_threads
 where requester_id=v_user and musician_id=p_musician_id
   and requested_date is not distinct from v_date
   and event_id is not distinct from p_event_id limit 1;
 if v_thread is null then
   if (select count(*) from public.stage_hiring_threads
     where requester_id=v_user and created_at>now()-interval '1 day')>=15
   then return jsonb_build_object('status','daily_limit');end if;
   insert into public.stage_hiring_threads(requester_id,musician_id,requested_date,event_id)
     values(v_user,p_musician_id,v_date,p_event_id) returning id into v_thread;
 end if;
 return jsonb_build_object('status','ok','thread_id',v_thread);
end;
$$;
revoke all on function public.stage_hiring_start(uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.stage_hiring_start(uuid,date,uuid) to authenticated;

create or replace function public.stage_hiring_list()
returns jsonb language sql stable security definer set search_path=''
as $$
 select case when auth.uid() is null then '[]'::jsonb else coalesce(jsonb_agg(
   jsonb_build_object('id',t.id,'requested_date',t.requested_date,
     'event_id',t.event_id,'availability',t.availability,
     'last_message_at',t.last_message_at,'other_id',
     case when t.requester_id=auth.uid() then t.musician_id else t.requester_id end,
     'other_name',coalesce(nullif(p.display_name,''),'Usuário'),
     'acting_as',case when t.requester_id=auth.uid() then 'requester' else 'musician' end,
     'unread', (select count(*) from public.stage_hiring_messages m
       where m.thread_id=t.id and m.sender_id<>auth.uid() and
         m.created_at>coalesce(case when t.requester_id=auth.uid()
           then t.requester_read_at else t.musician_read_at end, t.created_at-interval '1 second')),
     'last_message',(select left(m.body,100) from public.stage_hiring_messages m
       where m.thread_id=t.id order by m.created_at desc,m.id desc limit 1)
   ) order by t.last_message_at desc,t.id
 ),'[]'::jsonb) end
 from (
  select * from public.stage_hiring_threads
  where auth.uid() in (requester_id,musician_id)
  order by last_message_at desc,id limit 80
 ) t
 join public.profiles p on p.id=case when t.requester_id=auth.uid()
   then t.musician_id else t.requester_id end;
$$;
revoke all on function public.stage_hiring_list() from public,anon,authenticated;
grant execute on function public.stage_hiring_list() to authenticated;

create or replace function public.stage_hiring_messages(p_thread_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare v_items jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.stage_hiring_threads t
   where t.id=p_thread_id and auth.uid() in (t.requester_id,t.musician_id))
 then return jsonb_build_object('status','forbidden');end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',m.id,'body',m.body,'is_mine',m.sender_id=auth.uid(),
   'created_at',m.created_at) order by m.created_at,m.id),'[]'::jsonb)
 into v_items from (
   select * from public.stage_hiring_messages where thread_id=p_thread_id
   order by created_at desc,id desc limit 200
 ) m;
 update public.stage_hiring_threads t set
   requester_read_at=case when t.requester_id=auth.uid() then now() else requester_read_at end,
   musician_read_at=case when t.musician_id=auth.uid() then now() else musician_read_at end
 where t.id=p_thread_id;
 return jsonb_build_object('status','ok','messages',v_items);
end;
$$;
revoke all on function public.stage_hiring_messages(uuid) from public,anon,authenticated;
grant execute on function public.stage_hiring_messages(uuid) to authenticated;

create or replace function public.stage_hiring_send(p_thread_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_body text:=btrim(coalesce(p_body,''));v_receiver uuid;v_message uuid;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if char_length(v_body) not between 1 and 1500 or v_body ~ '[[:cntrl:]]'
 then return jsonb_build_object('status','invalid');end if;
 select case when t.requester_id=auth.uid() then t.musician_id else t.requester_id end
 into v_receiver from public.stage_hiring_threads t where t.id=p_thread_id
 and auth.uid() in (t.requester_id,t.musician_id) for update;
 if v_receiver is null then return jsonb_build_object('status','forbidden');end if;
 if (select count(*) from public.stage_hiring_messages
    where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=20
 then return jsonb_build_object('status','rate_limited');end if;
 insert into public.stage_hiring_messages(thread_id,sender_id,body)
 values(p_thread_id,auth.uid(),v_body) returning id into v_message;
 update public.stage_hiring_threads set last_message_at=now() where id=p_thread_id;
 -- Aviso é genérico e só criado com opt-in; evita mandar spam por cada texto.
 if exists(select 1 from public.stage_hiring_whatsapp_preferences
   where profile_id=v_receiver and opted_in=true)
 and not exists(select 1 from public.stage_hiring_whatsapp_outbox o
   where o.thread_id=p_thread_id and o.recipient_id=v_receiver
     and o.created_at>now()-interval '10 minutes'
     and o.status in ('queued','sending','sent')) then
     insert into public.stage_hiring_whatsapp_outbox(thread_id,message_id,recipient_id)
       values(p_thread_id,v_message,v_receiver);
 end if;
 return jsonb_build_object('status','ok','message_id',v_message);
end;
$$;
revoke all on function public.stage_hiring_send(uuid,text) from public,anon,authenticated;
grant execute on function public.stage_hiring_send(uuid,text) to authenticated;

create or replace function public.stage_hiring_availability(p_thread_id uuid,p_response text)
returns text language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or p_response not in ('available','unavailable','ask_later')
 then return 'invalid';end if;
 update public.stage_hiring_threads t set availability=p_response
 where t.id=p_thread_id and t.musician_id=auth.uid();
 if not found then return 'forbidden';end if;
 return 'saved';
end;
$$;
revoke all on function public.stage_hiring_availability(uuid,text) from public,anon,authenticated;
grant execute on function public.stage_hiring_availability(uuid,text) to authenticated;

create or replace function public.stage_hiring_whatsapp_settings(
 p_phone text default null,p_consent boolean default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_phone text;v_row public.stage_hiring_whatsapp_preferences%rowtype;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_consent is not null then
   if p_consent then
     v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
     if char_length(v_phone) in (10,11) then v_phone:='55'||v_phone;end if;
     if v_phone !~ '^[1-9][0-9]{9,14}$' then
       return jsonb_build_object('status','invalid_phone');end if;
     insert into public.stage_hiring_whatsapp_preferences(profile_id,phone_e164,opted_in)
       values(auth.uid(),v_phone,true)
     on conflict(profile_id) do update set phone_e164=excluded.phone_e164,
       opted_in=true,updated_at=now();
   else
     update public.stage_hiring_whatsapp_preferences set opted_in=false,updated_at=now()
     where profile_id=auth.uid();
     -- Revogação imediata também invalida fila não enviada.
     update public.stage_hiring_whatsapp_outbox set status='expired'
     where recipient_id=auth.uid() and status='queued';
   end if;
 end if;
 select * into v_row from public.stage_hiring_whatsapp_preferences where profile_id=auth.uid();
 return jsonb_build_object('status','ok','opted_in',coalesce(v_row.opted_in,false),
  'phone',v_row.phone_e164);
end;
$$;
revoke all on function public.stage_hiring_whatsapp_settings(text,boolean) from public,anon,authenticated;
grant execute on function public.stage_hiring_whatsapp_settings(text,boolean) to authenticated;

-- Cloud API worker uses server-side SERVICE ROLE only.
create or replace function public.stage_hiring_claim_notifications(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_rows jsonb;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then return '[]'::jsonb;end if;
 update public.stage_hiring_whatsapp_outbox o set status='expired'
 where o.status='queued' and o.expires_at<now();
 update public.stage_hiring_whatsapp_outbox o set status=case
   when o.attempted>=3 or o.expires_at<now() then 'failed' else 'queued' end,
   claimed_at=null
 where o.status='sending' and o.claimed_at<now()-interval '3 minutes';
 with claim as (
   select o.id from public.stage_hiring_whatsapp_outbox o
   join public.stage_hiring_whatsapp_preferences p
     on p.profile_id=o.recipient_id and p.opted_in=true
   where o.status='queued' and o.expires_at>=now() and o.attempted<3
   order by o.created_at for update of o skip locked
   limit least(greatest(coalesce(p_limit,10),1),20)
 ), marked as (
   update public.stage_hiring_whatsapp_outbox o
     set status='sending',attempted=attempted+1,claimed_at=now()
   from claim where o.id=claim.id returning o.*
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',m.id,'phone',p.phone_e164
 )),'[]'::jsonb) into v_rows
 from marked m join public.stage_hiring_whatsapp_preferences p
   on p.profile_id=m.recipient_id and p.opted_in=true;
 return coalesce(v_rows,'[]'::jsonb);
end;
$$;
revoke all on function public.stage_hiring_claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.stage_hiring_claim_notifications(integer) to service_role;

create or replace function public.stage_hiring_finish_notification(
 p_id uuid,p_success boolean,p_provider_id text default null,p_error text default null
)
returns text language plpgsql security definer set search_path=''
as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then return 'forbidden';end if;
 update public.stage_hiring_whatsapp_outbox
 set status=case when p_success then 'sent'
   when attempted>=3 or expires_at<now() then 'failed' else 'queued' end,
   provider_id=case when p_success then left(coalesce(p_provider_id,''),120) else null end,
   last_error=case when p_success then null else left(coalesce(p_error,'provider_error'),180) end,
   claimed_at=null
 where id=p_id and status='sending';
 if not found then return 'not_found';end if;
 return 'saved';
end;
$$;
revoke all on function public.stage_hiring_finish_notification(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.stage_hiring_finish_notification(uuid,boolean,text,text) to service_role;
commit;
notify pgrst,'reload schema';
