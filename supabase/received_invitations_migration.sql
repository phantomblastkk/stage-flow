-- Stage Flow: caixa de entrada dos músicos (convites recebidos).
-- Execute depois de shareable_invites_migration.sql.
-- Funções SECURITY DEFINER verificam auth.uid() e expõem apenas dados do próprio músico.

create or replace function public.stage_my_invitations()
returns table (
  id uuid,
  status text,
  message text,
  created_at timestamptz,
  responded_at timestamptz,
  event_id uuid,
  event_title text,
  event_starts_at timestamptz,
  event_venue text,
  event_city text,
  organizer_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.status::text,
    i.message,
    i.created_at,
    i.responded_at,
    e.id,
    e.title,
    e.starts_at,
    e.venue,
    e.city,
    p.display_name
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.profiles p on p.id = e.producer_id
  where i.musician_id = auth.uid()
  order by
    case when i.status = 'pending' then 0 else 1 end,
    e.starts_at asc,
    i.created_at desc;
$$;

revoke all on function public.stage_my_invitations() from public;
grant execute on function public.stage_my_invitations() to authenticated;

-- Os músicos só conseguem responder aos próprios convites ainda pendentes.
-- A mesma resposta não pode ser alterada repetidamente.
create or replace function public.stage_respond_invite(
  p_invitation_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_status public.invitation_status;
begin
  if auth.uid() is null then
    return 'login_required';
  end if;

  if p_invitation_id is null or p_accept is null then
    return 'invalid';
  end if;

  update public.invitations
  set status = case when p_accept
      then 'accepted'::public.invitation_status
      else 'declined'::public.invitation_status end,
      responded_at = now()
  where id = p_invitation_id
    and musician_id = auth.uid()
    and status = 'pending'
  returning status into v_new_status;

  if found then
    return v_new_status::text;
  end if;

  if exists (
    select 1 from public.invitations
    where id = p_invitation_id and musician_id = auth.uid()
  ) then
    return 'already_responded';
  end if;

  return 'not_found';
end;
$$;

revoke all on function public.stage_respond_invite(uuid, boolean) from public;
grant execute on function public.stage_respond_invite(uuid, boolean) to authenticated;

-- As atualizações diretas deixam de ser permitidas pelo usuário:
-- a única forma de responder será a função acima, que valida proprietário e estado.
drop policy if exists "Musicians can respond to own invitations" on public.invitations;
revoke update on table public.invitations from authenticated;
revoke update (status, responded_at) on table public.invitations from authenticated;

-- Acompanhamento do organizador: somente convites de eventos pertencentes à conta.
-- Só devolve código de links genéricos que ainda não foram utilizados.
create or replace function public.stage_sent_invitations()
returns table (
  id uuid,
  event_id uuid,
  event_title text,
  event_starts_at timestamptz,
  status text,
  musician_name text,
  invite_code text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    e.id,
    e.title,
    e.starts_at,
    i.status::text,
    m.display_name,
    case
      when i.musician_id is null and i.invited_email is null and i.status = 'pending'
      then i.invite_code
      else null
    end,
    i.created_at
  from public.events e
  join public.invitations i on i.event_id = e.id
  left join public.profiles m on m.id = i.musician_id
  where e.producer_id = auth.uid()
  order by e.starts_at desc, i.created_at desc;
$$;

revoke all on function public.stage_sent_invitations() from public;
grant execute on function public.stage_sent_invitations() to authenticated;
