-- Stage Flow: permitir que usuários autenticados contribuam com locais para o catálogo.
-- Execute no SQL Editor do Supabase após a migração venues_catalog_migration.sql.

alter table public.venues
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;

drop policy if exists "Authenticated users can add venues" on public.venues;
create policy "Authenticated users can add venues"
  on public.venues
  for insert
  to authenticated
  with check (auth.uid() = submitted_by);

drop policy if exists "Users can view active cities" on public.cities;
create policy "Users can view active cities"
  on public.cities
  for select
  to authenticated
  using (active = true);
