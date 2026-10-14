-- Stage Flow: base segura para convites entre produtores e músicos.
-- Execute no SQL Editor do Supabase depois da implantação da página /convites.

alter table public.invitations
  add column if not exists invited_email text,
  add column if not exists invite_code text;

-- Convites existentes podem apontar para um perfil de músico.
-- Convites por e-mail sem conta podem ser adicionados nesta estrutura.
alter table public.invitations alter column musician_id drop not null;

create unique index if not exists invitations_invite_code_unique
  on public.invitations (invite_code)
  where invite_code is not null;

drop policy if exists "Producers can invite musicians to own events" on public.invitations;
create policy "Producers can invite musicians to own events"
on public.invitations for insert to authenticated
with check (
  exists (
    select 1 from public.events e
    join public.profiles p on p.id = e.producer_id
    where e.id = event_id
      and e.producer_id = auth.uid()
      and p.role = 'producer'
  )
  and (
    musician_id is null
    or exists (
      select 1 from public.profiles m
      where m.id = musician_id and m.role = 'musician'
    )
  )
);

drop policy if exists "Users can view invitations they are involved in" on public.invitations;
create policy "Users can view invitations they are involved in"
on public.invitations for select to authenticated
using (
  auth.uid() = musician_id
  or exists (
    select 1 from public.events e
    where e.id = event_id and e.producer_id = auth.uid()
  )
);

drop policy if exists "Musicians can respond to own invitations" on public.invitations;
create policy "Musicians can respond to own invitations"
on public.invitations for update to authenticated
using (auth.uid() = musician_id)
with check (
  auth.uid() = musician_id
  and exists (
    select 1 from public.invitations original
    where original.id = id
      and original.musician_id = auth.uid()
  )
);
