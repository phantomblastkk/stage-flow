-- Stage Flow | Formação confirmada e substituição por apresentação.
-- QA somente. Exige fixed_teams_migration.sql, events, invitations.
-- A função de substituição nunca cancela confirmação silenciosamente.
begin;

create table if not exists public.stage_show_lineup_slots(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 label text not null check(char_length(btrim(label)) between 2 and 80),
 suggested_musician_id uuid references public.profiles(id) on delete set null,
 source_team_member_id uuid references public.stage_team_members(id) on delete set null,
 current_invitation_id uuid unique references public.invitations(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists stage_show_lineup_event_idx
 on public.stage_show_lineup_slots(event_id,created_at,id);
create unique index if not exists stage_show_lineup_team_origin_idx
 on public.stage_show_lineup_slots(event_id,source_team_member_id)
 where source_team_member_id is not null;

create table if not exists public.stage_show_lineup_assignments(
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references public.stage_show_lineup_slots(id) on delete cascade,
 invitation_id uuid not null references public.invitations(id) on delete cascade,
 assigned_at timestamptz not null default now(),
 released_at timestamptz,
 release_reason text check(release_reason is null or char_length(release_reason)<=250)
);
create unique index if not exists stage_show_lineup_assignment_live_idx
 on public.stage_show_lineup_assignments(slot_id) where released_at is null;
create index if not exists stage_show_lineup_history_idx
 on public.stage_show_lineup_assignments(slot_id,assigned_at desc);

alter table public.stage_show_lineup_slots enable row level security;
alter table public.stage_show_lineup_assignments enable row level security;
revoke all on public.stage_show_lineup_slots from public,anon,authenticated;
revoke all on public.stage_show_lineup_assignments from public,anon,authenticated;

create or replace function public.stage_show_lineup_overview(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_event public.events%rowtype;v_slots jsonb;v_others jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select * into v_event from public.events
 where id=p_event_id and producer_id=auth.uid();
 if not found then return jsonb_build_object('status','forbidden');end if;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',s.id,'label',s.label,'suggested_musician_id',s.suggested_musician_id,
   'suggested_musician_name',p_s.display_name,
   'invitation_id',s.current_invitation_id,
   'musician_name',p_i.display_name,'musician_id',i.musician_id,
   'invitation_status',i.status::text,
   'history',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'musician_name',hp.display_name,'status',hi.status::text,
       'assigned_at',h.assigned_at,'released_at',h.released_at,
       'reason',h.release_reason
     ) order by h.assigned_at desc),'[]'::jsonb)
     from public.stage_show_lineup_assignments h
     join public.invitations hi on hi.id=h.invitation_id
     left join public.profiles hp on hp.id=hi.musician_id
     where h.slot_id=s.id
   )
 ) order by s.created_at,s.id),'[]'::jsonb)
 into v_slots from (
    select * from public.stage_show_lineup_slots
    where event_id=p_event_id order by created_at,id limit 40
 ) s
 left join public.profiles p_s on p_s.id=s.suggested_musician_id
 left join public.invitations i on i.id=s.current_invitation_id
 left join public.profiles p_i on p_i.id=i.musician_id;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',i.id,'musician_id',i.musician_id,
   'name',p.display_name,'status',i.status::text
 ) order by i.created_at,i.id),'[]'::jsonb)
 into v_others from public.invitations i
 left join public.profiles p on p.id=i.musician_id
 where i.event_id=p_event_id and i.musician_id is not null
   and not exists(select 1 from public.stage_show_lineup_slots s
     where s.current_invitation_id=i.id);

 return jsonb_build_object(
  'status','ok','event_title',v_event.title,'event_starts_at',v_event.starts_at,
  'event_status',v_event.status::text,
  'slots',v_slots,'unassigned',v_others
 );
end;
$$;
revoke all on function public.stage_show_lineup_overview(uuid)
 from public,anon,authenticated;
grant execute on function public.stage_show_lineup_overview(uuid) to authenticated;

create or replace function public.stage_show_lineup_add_slot(
 p_event_id uuid,p_label text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_label text:=btrim(coalesce(p_label,''));v_event public.events%rowtype;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if char_length(v_label) not between 2 and 80
 then return jsonb_build_object('status','invalid');end if;
 select * into v_event from public.events
 where id=p_event_id and producer_id=auth.uid() for update;
 if not found then return jsonb_build_object('status','forbidden');end if;
 if v_event.status in ('completed','cancelled') or v_event.starts_at<=now()
 then return jsonb_build_object('status','event_closed');end if;
 if (select count(*) from public.stage_show_lineup_slots where event_id=p_event_id)>=40
 then return jsonb_build_object('status','lineup_full');end if;
 insert into public.stage_show_lineup_slots(event_id,label)
 values(p_event_id,v_label) returning id into v_id;
 return jsonb_build_object('status','ok','slot_id',v_id);
end;
$$;
revoke all on function public.stage_show_lineup_add_slot(uuid,text)
 from public,anon,authenticated;
grant execute on function public.stage_show_lineup_add_slot(uuid,text) to authenticated;

create or replace function public.stage_show_lineup_import_team(
 p_event_id uuid,p_team_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_event public.events%rowtype;v_added integer:=0;v_members integer:=0;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select * into v_event from public.events
 where id=p_event_id and producer_id=auth.uid() for update;
 if not found then return jsonb_build_object('status','forbidden');end if;
 if v_event.status in ('completed','cancelled') or v_event.starts_at<=now()
 then return jsonb_build_object('status','event_closed');end if;
 if not exists(select 1 from public.stage_teams
   where id=p_team_id and owner_id=auth.uid())
 then return jsonb_build_object('status','team_not_found');end if;
 select count(*) into v_members from public.stage_team_members
 where team_id=p_team_id;
 if v_members=0 then return jsonb_build_object('status','empty_team');end if;
 if v_members+(select count(*) from public.stage_show_lineup_slots
    where event_id=p_event_id)>40 then
   -- allow idempotent repeated import when all slots were already copied
   if exists(select 1 from public.stage_team_members tm
     where tm.team_id=p_team_id and not exists(
       select 1 from public.stage_show_lineup_slots s
       where s.event_id=p_event_id and s.source_team_member_id=tm.id
     )) then return jsonb_build_object('status','lineup_full');end if;
 end if;
 insert into public.stage_show_lineup_slots(
   event_id,label,suggested_musician_id,source_team_member_id)
 select p_event_id,
   coalesce(nullif(btrim(tm.instrument),''),'Músico da equipe'),
   tm.musician_id,tm.id
 from public.stage_team_members tm
 where tm.team_id=p_team_id
 on conflict (event_id,source_team_member_id)
   where source_team_member_id is not null do nothing;
 get diagnostics v_added=row_count;
 return jsonb_build_object('status','ok','created',v_added);
end;
$$;
revoke all on function public.stage_show_lineup_import_team(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.stage_show_lineup_import_team(uuid,uuid) to authenticated;

-- Uma única ação associa a vaga a um convite já aberto ou cria um novo PENDENTE.
-- Não reabre recusas e não altera a confirmação de outro integrante.
create or replace function public.stage_show_lineup_invite(
 p_slot_id uuid,p_musician_id uuid,p_message text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_slot public.stage_show_lineup_slots%rowtype;
 v_event public.events%rowtype;v_current text;v_invitation uuid;
 v_previous uuid;v_new boolean:=false;
 v_message text:=nullif(btrim(coalesce(p_message,'')),'');
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_musician_id is null or p_musician_id=auth.uid()
    or char_length(coalesce(v_message,''))>500
 then return jsonb_build_object('status','invalid');end if;
 -- Lock do evento impede duas vagas competirem pelo mesmo convite.
 select e.* into v_event from public.events e
 join public.stage_show_lineup_slots s on s.event_id=e.id
 where s.id=p_slot_id and e.producer_id=auth.uid() for update of e;
 if not found then return jsonb_build_object('status','forbidden');end if;
 if v_event.status in ('completed','cancelled') or v_event.starts_at<=now()
 then return jsonb_build_object('status','event_closed');end if;
 select * into v_slot from public.stage_show_lineup_slots
 where id=p_slot_id for update;

 if not exists(select 1 from public.profiles p
  where p.id=p_musician_id and p.is_artist=true)
 then return jsonb_build_object('status','invalid_musician');end if;
 if not exists(select 1 from public.stage_team_members tm
   join public.stage_teams t on t.id=tm.team_id
   where t.owner_id=auth.uid() and tm.musician_id=p_musician_id)
   and not exists(select 1 from public.invitations i
     join public.events e on e.id=i.event_id
     where e.producer_id=auth.uid() and i.musician_id=p_musician_id)
 then return jsonb_build_object('status','not_previous_invitee');end if;

 if v_slot.current_invitation_id is not null then
   select i.status::text into v_current from public.invitations i
     where i.id=v_slot.current_invitation_id;
   if v_current in ('pending','accepted') then
     return jsonb_build_object('status','active_assignment');end if;
 end if;
 select id into v_invitation from public.invitations
 where event_id=v_event.id and musician_id=p_musician_id;
 if v_invitation is not null then
   if exists(select 1 from public.invitations
      where id=v_invitation and status in ('declined','cancelled')) then
     return jsonb_build_object('status','closed_invite');end if;
   if exists(select 1 from public.stage_show_lineup_slots
       where current_invitation_id=v_invitation and id<>p_slot_id) then
     return jsonb_build_object('status','assigned_elsewhere');end if;
 else
   insert into public.invitations(event_id,musician_id,message,status)
   values(v_event.id,p_musician_id,v_message,'pending')
   returning id into v_invitation;
   v_new:=true;
 end if;
 if v_slot.current_invitation_id is not null then
   update public.stage_show_lineup_assignments
     set released_at=now(),release_reason='Substituído após recusa/cancelamento'
     where slot_id=p_slot_id and invitation_id=v_slot.current_invitation_id
       and released_at is null;
 end if;
 update public.stage_show_lineup_slots
   set current_invitation_id=v_invitation where id=p_slot_id;
 insert into public.stage_show_lineup_assignments(slot_id,invitation_id)
   values(p_slot_id,v_invitation);
 return jsonb_build_object('status','ok','invitation_id',v_invitation,
   'new_invitation',v_new);
end;
$$;
revoke all on function public.stage_show_lineup_invite(uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.stage_show_lineup_invite(uuid,uuid,text) to authenticated;

-- A substituição de um convidado pendente ou confirmado exige gesto explícito,
-- motivo não vazio, e avisa o usuário apenas pelo estado CANCELLED no Stage Flow.
-- O motivo fica privado para o organizador no histórico e não é notificação externa.
create or replace function public.stage_show_lineup_release(
 p_slot_id uuid,p_reason text
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_event public.events%rowtype;v_slot public.stage_show_lineup_slots%rowtype;
 v_reason text:=btrim(coalesce(p_reason,''));v_status text;
begin
 if auth.uid() is null then return 'login_required';end if;
 if char_length(v_reason) not between 5 and 250 then return 'invalid_reason';end if;
 select e.* into v_event from public.events e
 join public.stage_show_lineup_slots s on s.event_id=e.id
 where s.id=p_slot_id and e.producer_id=auth.uid() for update of e;
 if not found then return 'forbidden';end if;
 if v_event.status in ('completed','cancelled') or v_event.starts_at<=now()
 then return 'event_closed';end if;
 select * into v_slot from public.stage_show_lineup_slots
 where id=p_slot_id for update;
 if v_slot.current_invitation_id is null then return 'empty';end if;
 select status::text into v_status from public.invitations
 where id=v_slot.current_invitation_id for update;
 if v_status in ('pending','accepted') then
   update public.invitations set status='cancelled',responded_at=now()
   where id=v_slot.current_invitation_id and status in ('pending','accepted');
 end if;
 update public.stage_show_lineup_assignments
   set released_at=now(),release_reason=v_reason
   where slot_id=p_slot_id and invitation_id=v_slot.current_invitation_id
     and released_at is null;
 update public.stage_show_lineup_slots set current_invitation_id=null
   where id=p_slot_id;
 return 'released';
end;
$$;
revoke all on function public.stage_show_lineup_release(uuid,text)
 from public,anon,authenticated;
grant execute on function public.stage_show_lineup_release(uuid,text) to authenticated;

-- Remover vaga é permitido apenas se ela não tem convite ativo. Histórico
-- associado à vaga é preservado até eventual exclusão consciente do evento.
create or replace function public.stage_show_lineup_remove_slot(p_slot_id uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare v_event public.events%rowtype;v_slot public.stage_show_lineup_slots%rowtype;
begin
 if auth.uid() is null then return 'login_required';end if;
 select e.* into v_event from public.events e
 join public.stage_show_lineup_slots s on s.event_id=e.id
 where s.id=p_slot_id and e.producer_id=auth.uid() for update of e;
 if not found then return 'forbidden';end if;
 if v_event.status in ('completed','cancelled') or v_event.starts_at<=now()
 then return 'event_closed';end if;
 select * into v_slot from public.stage_show_lineup_slots where id=p_slot_id for update;
 if v_slot.current_invitation_id is not null then return 'has_assignment';end if;
 if exists(select 1 from public.stage_show_lineup_assignments
  where slot_id=p_slot_id) then return 'has_history';end if;
 delete from public.stage_show_lineup_slots where id=p_slot_id;
 return 'removed';
end;
$$;
revoke all on function public.stage_show_lineup_remove_slot(uuid)
 from public,anon,authenticated;
grant execute on function public.stage_show_lineup_remove_slot(uuid) to authenticated;

commit;
notify pgrst,'reload schema';
