-- Stage Flow initial schema
-- Execute no SQL Editor do Supabase somente depois de revisar o projeto.
create extension if not exists pgcrypto;

create type public.account_role as enum ('musician', 'producer');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.account_role not null,
  display_name text not null,
  username text unique,
  bio text,
  city text,
  instagram_url text,
  youtube_url text,
  spotify_url text,
  whatsapp text,
  avatar_url text,
  is_public boolean not null default false,
  subscription_status text not null default 'inactive' check (subscription_status in ('inactive','trialing','active','past_due','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9-]{3,30}$')
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  venue text,
  city text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.event_status not null default 'draft',
  show_publicly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_time_order check (ends_at is null or ends_at >= starts_at)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  musician_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  fee_amount numeric(10,2),
  status public.invitation_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique(event_id, musician_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index events_producer_start_idx on public.events(producer_id, starts_at);
create index events_public_start_idx on public.events(show_publicly, status, starts_at);
create index invitations_musician_status_idx on public.invitations(musician_id, status, created_at desc);
create index notifications_profile_created_idx on public.notifications(profile_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.invitations enable row level security;
alter table public.notifications enable row level security;

-- Public artist profiles only when explicitly published.
create policy "Public can view published artist profiles"
on public.profiles for select
using (role = 'musician' and is_public = true and subscription_status = 'active');

create policy "Users can view own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy "Users can create own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Producers can view own events"
on public.events for select to authenticated
using (auth.uid() = producer_id);

create policy "Public can view public published events"
on public.events for select
using (show_publicly = true and status = 'published');

create policy "Producers can create own events"
on public.events for insert to authenticated
with check (auth.uid() = producer_id and exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'producer'
));

create policy "Producers can update own events"
on public.events for update to authenticated
using (auth.uid() = producer_id)
with check (auth.uid() = producer_id);

create policy "Producers can delete own events"
on public.events for delete to authenticated
using (auth.uid() = producer_id);

create policy "Musicians can view own invitations"
on public.invitations for select to authenticated
using (auth.uid() = musician_id or exists (
  select 1 from public.events e where e.id = event_id and e.producer_id = auth.uid()
));

create policy "Producers can invite musicians to own events"
on public.invitations for insert to authenticated
with check (exists (
  select 1 from public.events e where e.id = event_id and e.producer_id = auth.uid()
));

create policy "Musicians can respond to own invitations"
on public.invitations for update to authenticated
using (auth.uid() = musician_id)
with check (auth.uid() = musician_id);

create policy "Users can view own notifications"
on public.notifications for select to authenticated
using (auth.uid() = profile_id);

create policy "Users can mark own notifications read"
on public.notifications for update to authenticated
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

-- IMPORTANT: antes de produção, endurecer policies de UPDATE para impedir
-- mudanças em campos protegidos (role, subscription_status, musician_id etc.)
-- e implementar criação de perfil via trigger ou fluxo server-side confiável.
