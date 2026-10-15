-- Stage Flow • propostas e contrapropostas privadas de cachê
-- Pré-requisito: invitations_migration.sql, received_invitations_migration.sql.
-- Execute no Supabase SQL Editor. Não apaga convites nem valores antigos.

create table if not exists public.stage_fee_negotiations (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  last_amount numeric(10,2) not null check (last_amount > 0 and last_amount <= 999999.99),
  last_by uuid not null references public.profiles(id),
  last_note text check (last_note is null or char_length(last_note) <= 500),
  agreed_amount numeric(10,2) check (agreed_amount is null or agreed_amount > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.stage_fee_offer_history (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  offered_by uuid not null references public.profiles(id),
  amount numeric(10,2) not null check (amount > 0 and amount <= 999999.99),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists stage_fee_offer_history_invite_idx
  on public.stage_fee_offer_history(invitation_id, created_at, id);

alter table public.stage_fee_negotiations enable row level security;
alter table public.stage_fee_offer_history enable row level security;
revoke all on public.stage_fee_negotiations from PUBLIC, anon, authenticated;
revoke all on public.stage_fee_offer_history from PUBLIC, anon, authenticated;

-- A função só devolve propostas para o organizador dono do evento
-- ou para o músico especificado NESTE convite. Ninguém vê valores da banda toda.
create or replace function public.stage_fee_details(p_invitation_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_status text;
  v_is_owner boolean;
  v_last_amount numeric(10,2);
  v_last_by uuid;
  v_last_note text;
  v_agreed numeric(10,2);
  v_history jsonb;
begin
  if auth.uid() is null then return null; end if;
  select i.status::text, (e.producer_id = auth.uid())
  into v_status, v_is_owner
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.id = p_invitation_id
    and (e.producer_id = auth.uid() or i.musician_id = auth.uid());
  if not found then return null; end if;

  select f.last_amount, f.last_by, f.last_note, f.agreed_amount
  into v_last_amount, v_last_by, v_last_note, v_agreed
  from public.stage_fee_negotiations f
  where f.invitation_id = p_invitation_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'amount', h.amount,
    'by_me', h.offered_by = auth.uid(),
    'note', h.note,
    'date', h.created_at
  ) order by h.created_at, h.id), '[]'::jsonb)
  into v_history
  from public.stage_fee_offer_history h
  where h.invitation_id = p_invitation_id;

  return jsonb_build_object(
    'status', v_status,
    'is_owner', v_is_owner,
    'has_offer', v_last_amount is not null,
    'last_amount', v_last_amount,
    'last_by_me', v_last_by = auth.uid(),
    'last_note', v_last_note,
    'agreed_amount', v_agreed,
    'history', v_history
  );
end;
$$;

revoke all on function public.stage_fee_details(uuid) from PUBLIC;
grant execute on function public.stage_fee_details(uuid) to authenticated;

-- Uma pessoa envia a proposta; a outra responde com aceite ou contraproposta.
-- Autorizações verificadas no banco e convite bloqueado para evitar corrida.
create or replace function public.stage_offer_fee(
  p_invitation_id uuid,
  p_amount numeric,
  p_note text default null
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_musician uuid;
  v_status text;
  v_last_by uuid;
  v_agreed numeric(10,2);
  v_has_offer boolean;
  v_note text;
begin
  if auth.uid() is null then return 'login_required'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999.99
    or round(p_amount, 2) <> p_amount then return 'invalid_amount'; end if;
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if char_length(coalesce(v_note, '')) > 500 then return 'note_too_long'; end if;

  select e.producer_id, i.musician_id, i.status::text
  into v_owner, v_musician, v_status
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.id = p_invitation_id
  for update of i;

  if not found then return 'not_found'; end if;
  if auth.uid() <> v_owner and auth.uid() is distinct from v_musician then
    return 'forbidden';
  end if;
  if v_status <> 'pending' then return 'closed'; end if;

  select f.last_by, f.agreed_amount
  into v_last_by, v_agreed
  from public.stage_fee_negotiations f
  where f.invitation_id = p_invitation_id;
  v_has_offer := found;

  if v_agreed is not null then return 'agreed'; end if;
  if v_has_offer and v_last_by = auth.uid() then return 'waiting_other'; end if;

  insert into public.stage_fee_negotiations
    (invitation_id, last_amount, last_by, last_note, agreed_amount, updated_at)
  values (p_invitation_id, p_amount, auth.uid(), v_note, null, now())
  on conflict (invitation_id) do update
  set last_amount = excluded.last_amount,
      last_by = excluded.last_by,
      last_note = excluded.last_note,
      updated_at = now();

  insert into public.stage_fee_offer_history
    (invitation_id, offered_by, amount, note)
  values (p_invitation_id, auth.uid(), p_amount, v_note);

  return 'offered';
end;
$$;
revoke all on function public.stage_offer_fee(uuid, numeric, text) from PUBLIC;
grant execute on function public.stage_offer_fee(uuid, numeric, text) to authenticated;

-- Só quem RECEBEU a última oferta pode aceitá-la.
create or replace function public.stage_accept_fee(p_invitation_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_musician uuid;
  v_status text;
  v_last_by uuid;
  v_amount numeric(10,2);
  v_agreed numeric(10,2);
begin
  if auth.uid() is null then return 'login_required'; end if;

  select e.producer_id, i.musician_id, i.status::text
  into v_owner, v_musician, v_status
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.id = p_invitation_id
  for update of i;

  if not found then return 'not_found'; end if;
  if auth.uid() <> v_owner and auth.uid() is distinct from v_musician
    then return 'forbidden'; end if;
  if v_status <> 'pending' then return 'closed'; end if;

  select last_by, last_amount, agreed_amount
  into v_last_by, v_amount, v_agreed
  from public.stage_fee_negotiations
  where invitation_id = p_invitation_id;

  if not found then return 'no_offer'; end if;
  if v_agreed is not null then return 'agreed'; end if;
  if v_last_by = auth.uid() then return 'waiting_other'; end if;
  if v_musician is null then return 'unclaimed'; end if;

  update public.stage_fee_negotiations
    set agreed_amount = v_amount, updated_at = now()
    where invitation_id = p_invitation_id;
  update public.invitations
    set fee_amount = v_amount
    where id = p_invitation_id;
  return 'accepted';
end;
$$;
revoke all on function public.stage_accept_fee(uuid) from PUBLIC;
grant execute on function public.stage_accept_fee(uuid) to authenticated;

-- Impede que o músico confirme o show enquanto há proposta financeira aberta.
-- Sem proposta cadastrada, convites continuam podendo ser aceitos normalmente.
create or replace function public.stage_respond_invite(
  p_invitation_id uuid, p_accept boolean
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.invitation_status;
  v_owner uuid;
begin
  if auth.uid() is null then return 'login_required'; end if;
  if p_invitation_id is null or p_accept is null then return 'invalid'; end if;

  select i.status, e.producer_id
    into v_status, v_owner
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.id = p_invitation_id and i.musician_id = auth.uid()
  for update of i;
  if not found then return 'not_found'; end if;
  if v_status <> 'pending' then return 'already_responded'; end if;
  if p_accept and exists (
    select 1 from public.stage_fee_negotiations f
    where f.invitation_id = p_invitation_id
      and f.agreed_amount is null
  ) then return 'fee_pending'; end if;

  update public.invitations
  set status = case when p_accept
      then 'accepted'::public.invitation_status
      else 'declined'::public.invitation_status end,
      responded_at = now()
  where id = p_invitation_id and musician_id = auth.uid() and status = 'pending'
  returning status into v_status;
  return v_status::text;
end;
$$;
revoke all on function public.stage_respond_invite(uuid, boolean) from PUBLIC;
grant execute on function public.stage_respond_invite(uuid, boolean) to authenticated;
