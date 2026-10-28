-- Disposable PostgreSQL ONLY. No connection to Supabase or real accounts.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.profiles(id uuid primary key,display_name text);
create table public.stage_hiring_threads(id uuid primary key,requester_id uuid references public.profiles,musician_id uuid references public.profiles,event_id uuid,requested_date date,availability text default 'awaiting',requester_read_at timestamptz,musician_read_at timestamptz,created_at timestamptz default now(),last_message_at timestamptz not null);
create table public.stage_hiring_messages(id uuid primary key,thread_id uuid references public.stage_hiring_threads,sender_id uuid references public.profiles,body text,created_at timestamptz not null);
create index stage_hiring_requester_idx on public.stage_hiring_threads(requester_id,last_message_at desc);
create index stage_hiring_musician_idx on public.stage_hiring_threads(musician_id,last_message_at desc);
create index stage_hiring_messages_page_idx on public.stage_hiring_messages(thread_id,created_at desc,id desc);
alter table public.profiles enable row level security;
alter table public.stage_hiring_threads enable row level security;
alter table public.stage_hiring_messages enable row level security;
revoke all on public.profiles,public.stage_hiring_threads,public.stage_hiring_messages from public,anon,authenticated;
insert into public.profiles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','C');
insert into public.stage_hiring_threads(id,requester_id,musician_id,last_message_at)
select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-10-28 00:00:00.123456+00' from generate_series(1,85)i;
insert into public.stage_hiring_messages(id,thread_id,sender_id,body,created_at)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Fixture '||i,'2026-10-28 00:00:00.654321+00' from generate_series(1,205)i;
