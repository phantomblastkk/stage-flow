-- SQL-only emulacao MINIMA de Auth/Storage para teste de migracoes no Postgres descartavel.
-- Nao deve ser aplicada em Supabase real. Usar somente no CI ephemeral PostgreSQL.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create schema storage;

-- Marcador exclusivo deste Postgres descartavel.
create table public.stage_flow_qa_marker (
  acknowledgment text primary key
);
insert into public.stage_flow_qa_marker(acknowledgment)
values ('ISOLATED_STAGE_FLOW_HOMOLOGATION_ONLY');

create table auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (bucket_id,name)
);
alter table storage.objects enable row level security;
grant usage on schema auth,storage to anon,authenticated;
grant select on auth.users to authenticated;
