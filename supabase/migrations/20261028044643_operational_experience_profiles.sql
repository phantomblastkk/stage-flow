-- Additive only. Apply manually after the current production migration set.
-- auth.users / profiles remain the account identity and existing contracts stay intact.
begin;
create table public.stage_performance_profiles (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('individual','group','producer','venue')),
 musical_type text check(musical_type in ('Cantor','Grupo de Pagode','Banda','Dupla','Trio','DJ','Instrumentista')),
 name text not null check(char_length(btrim(name)) between 2 and 100),
 bio text not null default '' check(char_length(bio)<=2000),
 city text not null default '' check(char_length(city)<=120),
 members text[] not null default '{}' check(cardinality(members)<=30),
 is_public boolean not null default false,
 venue_id uuid references public.venues(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(kind='group' or cardinality(members)=0),
 check(kind in ('individual','group') or musical_type is null)
);
create index stage_performance_profiles_account_idx on public.stage_performance_profiles(account_id,created_at,id);
create index stage_performance_profiles_discovery_idx on public.stage_performance_profiles(kind,city,id) where is_public;
alter table public.stage_performance_profiles enable row level security;
revoke all on public.stage_performance_profiles from public,anon,authenticated;
grant select on public.stage_performance_profiles to authenticated;
create policy performance_owner_read on public.stage_performance_profiles for select to authenticated using(account_id=(select auth.uid()));
-- No direct writes: owner, kind and venue association cannot be reassigned by PostgREST.
create or replace function public.stage_save_performance_profile(
 p_id uuid,p_kind text,p_type text,p_name text,p_bio text,p_city text,p_members text[],p_public boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_venue uuid;v_existing public.stage_performance_profiles;begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_kind is null or p_kind not in ('individual','group','producer','venue') or p_name is null or char_length(btrim(p_name)) not between 2 and 100
  or p_bio is null or char_length(p_bio)>2000 or p_city is null or char_length(p_city)>120 or p_public is null
  or p_members is null or cardinality(p_members)>30 or exists(select 1 from unnest(p_members)m where m is null or char_length(btrim(m)) not between 1 and 100)
  or (p_kind='group' and cardinality(p_members)=0) or (p_kind<>'group' and cardinality(p_members)>0)
  or (p_kind in ('individual','group') and (p_type is null or p_type not in ('Cantor','Grupo de Pagode','Banda','Dupla','Trio','DJ','Instrumentista')))
  or (p_kind in ('producer','venue') and p_type is not null)
 then return jsonb_build_object('status','invalid');end if;
 if p_id is null then
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,91723));
  if (select count(*) from public.stage_performance_profiles where account_id=auth.uid())>=30 then return jsonb_build_object('status','limit_reached');end if;
  if p_kind in ('producer','venue') and not exists(select 1 from public.profiles where id=auth.uid() and is_producer) then return jsonb_build_object('status','producer_required');end if;
  if p_kind='venue' then
   -- This is an ordinary house. Official / partner status and admin ACL never change.
   insert into public.venues(name,submitted_by) values(btrim(p_name),auth.uid()) returning id into v_venue;
  end if;
  insert into public.stage_performance_profiles(account_id,kind,musical_type,name,bio,city,members,is_public,venue_id)
  values(auth.uid(),p_kind,p_type,btrim(p_name),p_bio,btrim(p_city),p_members,p_public,v_venue) returning id into v_id;
 else
  select * into v_existing from public.stage_performance_profiles where id=p_id and account_id=auth.uid() for update;
  if not found then return jsonb_build_object('status','not_found');end if;
  if v_existing.kind<>p_kind then return jsonb_build_object('status','invalid');end if;
  update public.stage_performance_profiles set musical_type=p_type,name=btrim(p_name),bio=p_bio,city=btrim(p_city),members=p_members,is_public=p_public,updated_at=now() where id=p_id and account_id=auth.uid();
  v_id:=p_id;
 end if;
 return jsonb_build_object('status','saved','id',v_id);
end;$$;
revoke all on function public.stage_save_performance_profile(uuid,text,text,text,text,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.stage_save_performance_profile(uuid,text,text,text,text,text,text[],boolean) to authenticated;

-- Deliberate launch gate; public profile creation does not open marketplace access.
create or replace function public.stage_discover_performance_profiles(p_query text default '',p_kind text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if not public.stage_marketplace_gate() then return jsonb_build_object('status','not_released');end if;
 if char_length(coalesce(p_query,''))>100 then return jsonb_build_object('status','invalid');end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_items from (
  select p.id,p.name,p.kind,p.musical_type,p.bio,p.city,p.members
  from public.stage_performance_profiles p where p.is_public and p.kind in ('individual','group') and p.account_id<>auth.uid() and not exists(select 1 from public.stage_marketplace_hidden_musicians hm where hm.musician_id=p.account_id)
   and (p_kind is null or p.kind=p_kind) and (p.name ilike '%'||coalesce(p_query,'')||'%' or p.city ilike '%'||coalesce(p_query,'')||'%')
  order by p.name,p.id limit 30
 )x;
 return jsonb_build_object('status','ok','items',v_items);
end;$$;
revoke all on function public.stage_discover_performance_profiles(text,text) from public,anon,authenticated;
grant execute on function public.stage_discover_performance_profiles(text,text) to authenticated;

-- Snapshot the whole artistic act, never one contract per member.
create table public.stage_invitation_performance_identity (
 invitation_id uuid primary key references public.invitations(id) on delete cascade,
 performance_profile_id uuid not null references public.stage_performance_profiles(id) on delete restrict,
 name text not null, musical_type text, members text[] not null,created_at timestamptz not null default now()
);
alter table public.stage_invitation_performance_identity enable row level security;
revoke all on public.stage_invitation_performance_identity from public,anon,authenticated;
grant select on public.stage_invitation_performance_identity to authenticated;
create schema if not exists stage_performance_private;
revoke all on schema stage_performance_private from public,anon,authenticated;
grant usage on schema stage_performance_private to authenticated;
create or replace function stage_performance_private.can_read_invitation(p_invitation uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.invitations i join public.events e on e.id=i.event_id where i.id=p_invitation and (i.musician_id=auth.uid() or e.producer_id=auth.uid()));
$$;
revoke all on function stage_performance_private.can_read_invitation(uuid) from public,anon,authenticated;
grant execute on function stage_performance_private.can_read_invitation(uuid) to authenticated;
create policy performance_contract_participant on public.stage_invitation_performance_identity for select to authenticated using(stage_performance_private.can_read_invitation(invitation_id));
-- Private, exact interval check shared by preview, send and confirmation.
create or replace function stage_performance_private.availability(p_account uuid,p_start timestamptz,p_end timestamptz)
returns text language plpgsql stable set search_path='' as $$begin
 if p_start is null or p_end is null or p_end<=p_start or p_end>p_start+interval '26 hours' then return 'ask';end if;
 if exists(select 1 from public.invitations i join public.events e on e.id=i.event_id where i.musician_id=p_account and i.status='accepted' and e.status<>'cancelled' and e.starts_at<p_end and coalesce(e.ends_at,e.starts_at+interval '4 hours')>p_start)
  or exists(select 1 from public.events e where e.producer_id=p_account and e.status='published' and e.starts_at<p_end and coalesce(e.ends_at,e.starts_at+interval '4 hours')>p_start)
 then return 'busy';end if;
 if exists(select 1 from public.stage_musician_availability_rules r
  cross join generate_series((p_start at time zone 'America/Sao_Paulo')::date::timestamp,((p_end-interval '1 microsecond') at time zone 'America/Sao_Paulo')::date::timestamp,interval '1 day') d
  where r.musician_id=p_account and ((r.kind='day' and r.block_date=d::date) or (r.kind='weekly' and r.weekday=extract(isodow from d)::integer and d::date between r.valid_from and r.valid_until))
   and (d+make_interval(mins=>r.start_minute)) at time zone 'America/Sao_Paulo'<p_end
   and (d+make_interval(mins=>r.end_minute)) at time zone 'America/Sao_Paulo'>p_start)
 then return 'busy';end if;
 if exists(select 1 from public.events e where e.producer_id=p_account and e.status='draft' and e.starts_at<p_end and coalesce(e.ends_at,e.starts_at+interval '4 hours')>p_start) then return 'ask';end if;
 return 'free';
end;$$;
revoke all on function stage_performance_private.availability(uuid,timestamptz,timestamptz) from public,anon,authenticated;
create or replace function public.stage_invite_performance_profile(p_event_id uuid,p_profile_id uuid,p_fee numeric,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_profile public.stage_performance_profiles;v_event public.events;v_invitation uuid;v_availability text;begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if not public.stage_marketplace_gate() then return jsonb_build_object('status','not_released');end if;
 if p_fee is null or p_fee<=0 or p_fee>999999.99 or p_fee<>round(p_fee,2) or char_length(coalesce(p_message,''))>350 then return jsonb_build_object('status','invalid');end if;
 select * into v_event from public.events where id=p_event_id and producer_id=auth.uid() and status in ('draft','published') and starts_at>now() for update;
 if not found then return jsonb_build_object('status','event_not_found');end if;
 select * into v_profile from public.stage_performance_profiles where id=p_profile_id and is_public and kind in ('individual','group') and account_id<>auth.uid() and not exists(select 1 from public.stage_marketplace_hidden_musicians hm where hm.musician_id=account_id) for share;
 if not found then return jsonb_build_object('status','not_found');end if;
 perform pg_advisory_xact_lock(hashtextextended(v_profile.account_id::text,817234));
 v_availability:=stage_performance_private.availability(v_profile.account_id,v_event.starts_at,coalesce(v_event.ends_at,v_event.starts_at+interval '4 hours'));
 if v_availability='busy' then return jsonb_build_object('status','schedule_conflict');end if;
 if v_availability<>'free' then return jsonb_build_object('status','availability_required');end if;
 insert into public.invitations(event_id,musician_id,message,status)
 values(p_event_id,v_profile.account_id,left('Contratação de '||v_profile.name||' ('||coalesce(v_profile.musical_type,'Artista')||'). '||coalesce(p_message,''),500),'pending')
 on conflict(event_id,musician_id) do nothing returning id into v_invitation;
 if v_invitation is null then return jsonb_build_object('status','existing_invite');end if;
 insert into public.stage_invitation_performance_identity(invitation_id,performance_profile_id,name,musical_type,members) values(v_invitation,v_profile.id,v_profile.name,v_profile.musical_type,v_profile.members);
 insert into public.stage_fee_negotiations(invitation_id,last_amount,last_by,last_note) values(v_invitation,p_fee,auth.uid(),'Cachê total para a apresentação inteira');
 insert into public.stage_fee_offer_history(invitation_id,offered_by,amount,note) values(v_invitation,auth.uid(),p_fee,'Proposta inicial para a apresentação inteira');
 return jsonb_build_object('status','sent','invitation_id',v_invitation);
end;$$;
revoke all on function public.stage_invite_performance_profile(uuid,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.stage_invite_performance_profile(uuid,uuid,numeric,text) to authenticated;

-- Read availability without exposing the leader's identity or other commitments.
create or replace function public.stage_performance_availability(p_event_id uuid,p_profile_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_event public.events;v_account uuid;begin
 if auth.uid() is null or not public.stage_marketplace_gate() then return 'forbidden';end if;
 select * into v_event from public.events where id=p_event_id and producer_id=auth.uid() and status in ('draft','published') and starts_at>now();
 if not found then return 'event_not_found';end if;
 select account_id into v_account from public.stage_performance_profiles where id=p_profile_id and is_public and kind in ('individual','group') and account_id<>auth.uid() and not exists(select 1 from public.stage_marketplace_hidden_musicians hm where hm.musician_id=account_id);
 if not found then return 'not_found';end if;
 return stage_performance_private.availability(v_account,v_event.starts_at,coalesce(v_event.ends_at,v_event.starts_at+interval '4 hours'));
end;$$;
revoke all on function public.stage_performance_availability(uuid,uuid) from public,anon,authenticated;
grant execute on function public.stage_performance_availability(uuid,uuid) to authenticated;

-- Only new artistic-act invitations use this extra confirmation guard.
-- Creation of the finance record is bookkeeping, never a payment.
create or replace function public.stage_performance_confirmation_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_event public.events;begin
 if exists(select 1 from public.stage_invitation_performance_identity where invitation_id=new.id) then
  if new.event_id is distinct from old.event_id or new.musician_id is distinct from old.musician_id then raise exception 'Identidade da contratação imutável';end if;
  if new.status='accepted' and old.status is distinct from new.status then
   perform pg_advisory_xact_lock(hashtextextended(new.musician_id::text,817234));
   select * into v_event from public.events where id=new.event_id;
   if v_event.status='cancelled' or v_event.starts_at<=now() then raise exception 'Evento indisponível';end if;
   if exists(select 1 from public.stage_fee_negotiations where invitation_id=new.id and agreed_amount is null) then raise exception 'Cachê não acordado';end if;
   if stage_performance_private.availability(new.musician_id,v_event.starts_at,coalesce(v_event.ends_at,v_event.starts_at+interval '4 hours'))<>'free' then raise exception 'Conflito de agenda';end if;
   insert into public.stage_show_participation_finance(invitation_id) values(new.id) on conflict(invitation_id) do nothing;
  end if;
 end if;
 return new;
end;$$;
revoke all on function public.stage_performance_confirmation_guard() from public,anon,authenticated;
create trigger stage_performance_confirmation before update of status,event_id,musician_id on public.invitations for each row execute function public.stage_performance_confirmation_guard();

-- Fail the pre-deploy migration if a route would hide an existing public artist.
do $$begin
 if exists(select 1 from public.profiles where username in ('perfil-artistico','perfis','contratar')) then
  raise exception 'Route collision: resolve existing usernames before deploying operational UX';
 end if;
end;$$;
create or replace function public.stage_guard_operational_route_names()
returns trigger language plpgsql set search_path='' as $$begin
 if new.username in ('perfil-artistico','perfis','contratar') then raise exception 'Nome reservado para o StageFlow';end if;
 return new;
end;$$;
revoke all on function public.stage_guard_operational_route_names() from public,anon,authenticated;
create trigger stage_operational_route_names before insert or update of username on public.profiles for each row execute function public.stage_guard_operational_route_names();
commit;
notify pgrst,'reload schema';
