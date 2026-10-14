-- Stage Flow: músicos e produtores podem criar seus próprios eventos.
-- Execute uma única vez no SQL Editor do Supabase.
drop policy if exists "Producers can view own events" on public.events;
drop policy if exists "Producers can create own events" on public.events;
drop policy if exists "Producers can update own events" on public.events;
drop policy if exists "Producers can delete own events" on public.events;
create policy "Users can view own events" on public.events for select to authenticated using (auth.uid() = producer_id);
create policy "Users can create own events" on public.events for insert to authenticated with check (
 auth.uid() = producer_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('musician','producer'))
);
create policy "Users can update own events" on public.events for update to authenticated using (auth.uid() = producer_id) with check (auth.uid() = producer_id);
create policy "Users can delete own events" on public.events for delete to authenticated using (auth.uid() = producer_id);
