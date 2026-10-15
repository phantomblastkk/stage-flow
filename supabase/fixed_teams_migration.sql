-- Stage Flow | Formações fixas (equipes) reutilizáveis.
-- Execute DEPOIS de invitations_migration.sql e received_invitations_migration.sql.
-- Organizador só pode incluir músicos já convidados anteriormente por ele.
-- O vínculo com uma equipe é apenas um catálogo privado do organizador:
-- cada show gera convites INDIVIDUAIS, sem cachê compartilhado.

create table if not exists public.stage_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  notes text not null default '' check (char_length(notes) <= 250),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.stage_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.stage_teams(id) on delete cascade,
  musician_id uuid not null references public.profiles(id) on delete cascade,
  instrument text not null default '' check (char_length(instrument) <= 60),
  created_at timestamptz not null default now(),
  unique (team_id, musician_id)
);

create index if not exists stage_teams_owner_idx on public.stage_teams(owner_id);
create index if not exists stage_team_members_team_idx on public.stage_team_members(team_id);

alter table public.stage_teams enable row level security;
alter table public.stage_team_members enable row level security;
revoke all on public.stage_teams from PUBLIC, anon, authenticated;
revoke all on public.stage_team_members from PUBLIC, anon, authenticated;

-- Catálogo de músicos com quem o contratante já iniciou uma colaboração.
-- Nunca retorna cachê, telefone, e-mail ou links privados.
create or replace function public.stage_team_candidates()
returns table (musician_id uuid, musician_name text)
language sql stable security definer set search_path = ''
as $$
  select distinct p.id, p.display_name
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.profiles p on p.id = i.musician_id
  where e.producer_id = auth.uid()
    and i.musician_id is not null
    and i.musician_id <> auth.uid()
    and i.status in ('pending', 'accepted')
    and p.is_artist = true
  order by p.display_name, p.id;
$$;
revoke all on function public.stage_team_candidates() from PUBLIC;
grant execute on function public.stage_team_candidates() to authenticated;

create or replace function public.stage_my_teams()
returns table (
  id uuid, name text, notes text,
  member_count bigint, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name, t.notes,
         (select count(*) from public.stage_team_members tm
          where tm.team_id = t.id),
         t.created_at
  from public.stage_teams t
  where t.owner_id = auth.uid()
  order by t.name asc, t.created_at asc;
$$;
revoke all on function public.stage_my_teams() from PUBLIC;
grant execute on function public.stage_my_teams() to authenticated;

create or replace function public.stage_team_members_for_owner(p_team_id uuid)
returns table (
  member_id uuid, musician_id uuid,
  musician_name text, instrument text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select tm.id, tm.musician_id, p.display_name, tm.instrument, tm.created_at
  from public.stage_team_members tm
  join public.stage_teams t on t.id = tm.team_id
  join public.profiles p on p.id = tm.musician_id
  where tm.team_id = p_team_id
    and t.owner_id = auth.uid()
  order by p.display_name, tm.created_at;
$$;
revoke all on function public.stage_team_members_for_owner(uuid) from PUBLIC;
grant execute on function public.stage_team_members_for_owner(uuid) to authenticated;

create or replace function public.stage_create_team(p_name text, p_notes text default '')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_notes text := btrim(coalesce(p_notes, ''));
begin
  if auth.uid() is null then return jsonb_build_object('status', 'login_required'); end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and (is_artist or is_producer)
  ) then return jsonb_build_object('status', 'forbidden'); end if;
  if char_length(v_name) not between 2 and 80 or char_length(v_notes) > 250
    then return jsonb_build_object('status', 'invalid'); end if;
  insert into public.stage_teams (owner_id, name, notes)
  values (auth.uid(), v_name, v_notes) returning id into v_id;
  return jsonb_build_object('status', 'created', 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('status', 'duplicate');
end;
$$;
revoke all on function public.stage_create_team(text, text) from PUBLIC;
grant execute on function public.stage_create_team(text, text) to authenticated;

create or replace function public.stage_update_team(
  p_team_id uuid, p_name text, p_notes text default ''
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_notes text := btrim(coalesce(p_notes, ''));
begin
  if auth.uid() is null then return 'login_required'; end if;
  if char_length(v_name) not between 2 and 80 or char_length(v_notes) > 250
    then return 'invalid'; end if;
  update public.stage_teams
  set name = v_name, notes = v_notes
  where id = p_team_id and owner_id = auth.uid();
  if not found then return 'not_found'; end if;
  return 'updated';
exception when unique_violation then return 'duplicate';
end;
$$;
revoke all on function public.stage_update_team(uuid, text, text) from PUBLIC;
grant execute on function public.stage_update_team(uuid, text, text) to authenticated;

create or replace function public.stage_delete_team(p_team_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then return 'login_required'; end if;
  delete from public.stage_teams where id = p_team_id and owner_id = auth.uid();
  if not found then return 'not_found'; end if;
  return 'deleted';
end;
$$;
revoke all on function public.stage_delete_team(uuid) from PUBLIC;
grant execute on function public.stage_delete_team(uuid) to authenticated;

create or replace function public.stage_add_team_member(
  p_team_id uuid, p_musician_id uuid, p_instrument text default ''
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_instrument text := btrim(coalesce(p_instrument, ''));
begin
  if auth.uid() is null then return 'login_required'; end if;
  if p_musician_id is null or p_musician_id = auth.uid()
     or char_length(v_instrument) > 60 then return 'invalid'; end if;

  -- Serializa inclusões para limitar o tamanho da equipe.
  perform 1 from public.stage_teams
    where id = p_team_id and owner_id = auth.uid() for update;
  if not found then return 'not_found'; end if;
  if not exists (
    select 1 from public.invitations i
    join public.events e on e.id = i.event_id
    join public.profiles p on p.id = i.musician_id
    where e.producer_id = auth.uid()
      and i.musician_id = p_musician_id
      and i.status in ('pending', 'accepted')
      and p.is_artist = true
  ) then return 'not_previous_invitee'; end if;

  if exists (
    select 1 from public.stage_team_members
    where team_id = p_team_id and musician_id = p_musician_id
  ) then
    update public.stage_team_members set instrument = v_instrument
    where team_id = p_team_id and musician_id = p_musician_id;
    return 'updated';
  end if;
  if (select count(*) from public.stage_team_members
      where team_id = p_team_id) >= 25 then return 'team_full'; end if;

  insert into public.stage_team_members (team_id, musician_id, instrument)
  values (p_team_id, p_musician_id, v_instrument);
  return 'added';
end;
$$;
revoke all on function public.stage_add_team_member(uuid, uuid, text) from PUBLIC;
grant execute on function public.stage_add_team_member(uuid, uuid, text) to authenticated;

create or replace function public.stage_remove_team_member(p_member_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then return 'login_required'; end if;
  delete from public.stage_team_members m
  using public.stage_teams t
  where m.id = p_member_id
    and m.team_id = t.id
    and t.owner_id = auth.uid();
  if not found then return 'not_found'; end if;
  return 'removed';
end;
$$;
revoke all on function public.stage_remove_team_member(uuid) from PUBLIC;
grant execute on function public.stage_remove_team_member(uuid) to authenticated;

-- Envia convites individuais a cada membro. Um show nunca recebe duas
-- solicitações para a MESMA conta (constraint unique(event_id,musician_id)).
-- Sem propostas financeiras automáticas; cada cachê segue privado e negociável.
create or replace function public.stage_invite_team_to_event(
  p_team_id uuid, p_event_id uuid, p_message text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_total integer;
  v_created integer;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if auth.uid() is null then return jsonb_build_object('status', 'login_required'); end if;
  if char_length(coalesce(v_message, '')) > 500 then
    return jsonb_build_object('status', 'message_too_long'); end if;

  if not exists (
    select 1 from public.stage_teams t
    where t.id = p_team_id and t.owner_id = auth.uid()
  ) then return jsonb_build_object('status', 'team_not_found'); end if;

  if not exists (
    select 1 from public.events e
    join public.profiles p on p.id = e.producer_id
    where e.id = p_event_id
      and e.producer_id = auth.uid()
      and (p.is_artist or p.is_producer)
  ) then return jsonb_build_object('status', 'event_not_found'); end if;

  select count(*) into v_total
  from public.stage_team_members tm
  join public.profiles p on p.id = tm.musician_id
  where tm.team_id = p_team_id and p.is_artist = true
    and tm.musician_id <> auth.uid();

  if v_total = 0 then return jsonb_build_object('status', 'empty_team'); end if;

  insert into public.invitations (event_id, musician_id, message)
  select p_event_id, tm.musician_id, v_message
  from public.stage_team_members tm
  join public.profiles p on p.id = tm.musician_id
  where tm.team_id = p_team_id and p.is_artist = true
    and tm.musician_id <> auth.uid()
  on conflict (event_id, musician_id) do nothing;

  get diagnostics v_created = row_count;
  return jsonb_build_object(
    'status', 'sent', 'created', v_created,
    'existing', v_total - v_created,
    'total', v_total
  );
end;
$$;
revoke all on function public.stage_invite_team_to_event(uuid, uuid, text) from PUBLIC;
grant execute on function public.stage_invite_team_to_event(uuid, uuid, text) to authenticated;
