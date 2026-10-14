-- Stage Flow — convites individuais por link, sem e-mail obrigatório.
-- Execute uma vez (é seguro executar novamente) APÓS as migrações anteriores.
-- Cada link contém um UUID aleatório e só pode ser vinculado a UMA conta.
-- Convites antigos por e-mail continuam exigindo correspondência do e-mail.

create unique index if not exists invitations_invite_code_unique
  on public.invitations (invite_code) where invite_code is not null;

-- Prévia segura de um convite para quem possui seu link.
-- Nunca expõe e-mail, ID do convidado nem outros convites.
create or replace function public.stage_invite_preview(p_invite_code text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', e.title,
    'starts_at', e.starts_at,
    'organizer', p.display_name,
    'message', i.message
  )
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.profiles p on p.id = e.producer_id
  where i.invite_code = p_invite_code
    and i.status = 'pending'
    and i.musician_id is null
  limit 1;
$$;

revoke all on function public.stage_invite_preview(text) from public;
grant execute on function public.stage_invite_preview(text) to anon, authenticated;

-- A associação é feita APÓS autenticação (não durante a criação não confirmada
-- da conta). Um link não pode ser reutilizado nem transferir direitos do plano.
create or replace function public.claim_stage_invite(p_invite_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invitations%rowtype;
  v_email text;
begin
  if auth.uid() is null then return 'login_required'; end if;
  if p_invite_code is null
    or p_invite_code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then return 'invalid'; end if;

  -- Lock atômico: apenas uma conta pode consumir o código.
  select * into v_invite
  from public.invitations
  where invite_code = p_invite_code
  for update;
  if not found then return 'invalid'; end if;

  if v_invite.musician_id = auth.uid() then return 'already_claimed'; end if;
  if v_invite.musician_id is not null then return 'used'; end if;
  if v_invite.status <> 'pending' then return 'closed'; end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_artist = true
  ) then return 'artist_required'; end if;

  if exists (
    select 1 from public.events e
    where e.id = v_invite.event_id and e.producer_id = auth.uid()
  ) then return 'own_event'; end if;

  -- Mantém a proteção para os links antigos criados com e-mail obrigatório.
  if v_invite.invited_email is not null then
    select lower(email) into v_email from auth.users where id = auth.uid();
    if v_email is distinct from lower(v_invite.invited_email) then
      return 'different_email';
    end if;
  end if;

  if exists (
    select 1 from public.invitations i
    where i.event_id = v_invite.event_id and i.musician_id = auth.uid()
  ) then return 'already_invited'; end if;

  update public.invitations
    set musician_id = auth.uid()
    where id = v_invite.id and musician_id is null;

  return 'claimed';
exception
  when unique_violation then return 'already_invited';
end;
$$;

revoke all on function public.claim_stage_invite(text) from public;
grant execute on function public.claim_stage_invite(text) to authenticated;

-- Os músicos podem responder aos convites, mas não modificar evento,
-- destinatário, código ou conteúdo do convite pela API pública.
revoke update on public.invitations from authenticated;
grant update (status, responded_at) on public.invitations to authenticated;
