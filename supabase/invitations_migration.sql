-- Stage Flow: políticas para convites compatíveis com contas multi-função.
-- Pode ser executado novamente com segurança após a migração multi_role_accounts_migration.sql.

alter table public.invitations
  add column if not exists invited_email text,
  add column if not exists invite_code text;

alter table public.invitations alter column musician_id drop not null;

create unique index if not exists invitations_invite_code_unique
  on public.invitations (invite_code)
  where invite_code is not null;

drop policy if exists "Producers can invite musicians to own events" on public.invitations;
create policy "Users with artist or producer function can invite musicians to own events"
on public.invitations for insert to authenticated
with check (
  exists (
    select 1 from public.events e
    join public.profiles p on p.id = e.producer_id
    where e.id = event_id
      and e.producer_id = auth.uid()
      and (p.is_artist = true or p.is_producer = true or p.role = 'producer')
  )
  and (
    musician_id is null
    or exists (
      select 1 from public.profiles m
      where m.id = musician_id and (m.is_artist = true or m.role = 'musician')
    )
  )
);

drop policy if exists "Users can view invitations they are involved in" on public.invitations;
drop policy if exists "Musicians can view own invitations" on public.invitations;
create policy "Users can view invitations they are involved in"
on public.invitations for select to authenticated
using (
  auth.uid() = musician_id
  or exists (
    select 1 from public.events e
    where e.id = event_id and e.producer_id = auth.uid()
  )
);
