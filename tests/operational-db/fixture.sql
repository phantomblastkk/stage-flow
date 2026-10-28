-- Temporary PostgreSQL service only; synthetic identities, no Supabase credentials.
create role anon nologin;create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create type public.invitation_status as enum('pending','accepted','declined','cancelled');
create table public.profiles(id uuid primary key,display_name text,username text,is_producer boolean default false);
create table public.venues(id uuid primary key default gen_random_uuid(),name text,submitted_by uuid references public.profiles,is_official boolean default false,is_partner boolean default false);
create table public.events(id uuid primary key default gen_random_uuid(),producer_id uuid references public.profiles,title text,starts_at timestamptz,ends_at timestamptz,status text default 'draft');
create table public.invitations(id uuid primary key default gen_random_uuid(),event_id uuid references public.events,musician_id uuid references public.profiles,message text,fee_amount numeric,status public.invitation_status default 'pending',responded_at timestamptz,created_at timestamptz default now(),unique(event_id,musician_id));
create table public.stage_musician_availability_rules(musician_id uuid,kind text,block_date date,weekday int,valid_from date,valid_until date,start_minute integer default 0,end_minute integer default 1440);
create table public.stage_show_participation_finance(invitation_id uuid primary key references public.invitations);
create table public.stage_marketplace_hidden_musicians(musician_id uuid primary key);
create function public.stage_marketplace_gate() returns boolean language sql stable as $$select coalesce(current_setting('fixture.marketplace',true),'')='allowed'$$;
alter table public.profiles enable row level security;alter table public.events enable row level security;alter table public.invitations enable row level security;
revoke all on public.profiles,public.venues,public.events,public.invitations,public.stage_musician_availability_rules,public.stage_show_participation_finance from public,anon,authenticated;
insert into public.profiles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Henrique','henrique',true),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Líder','lider',false),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Outra conta','outra',false);
insert into public.events(id,producer_id,title,starts_at,ends_at) values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Show de teste',now()+interval '2 days',now()+interval '2 days 3 hours'),('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Show concorrente',now()+interval '2 days 1 hour',now()+interval '2 days 4 hours');

grant select on public.profiles to authenticated;
create policy own_profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
grant select,insert on public.events to authenticated;
create policy own_event_read on public.events for select to authenticated using(producer_id=(select auth.uid()));
