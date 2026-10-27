-- Stage Flow / Homologação: operação e encerramento por apresentação
-- Depende de events, invitations, stage_event_budget, stage_event_expenses.
-- Apenas o proprietário administra; músico com convite aceito recebe briefing limitado.
begin;

create table if not exists public.stage_show_operations (
 event_id uuid primary key references public.events(id) on delete cascade,
 arrival_at timestamptz,
 soundcheck_at timestamptz,
 doors_at timestamptz,
 meeting_point text check(meeting_point is null or char_length(meeting_point)<=180),
 contact_name text check(contact_name is null or char_length(contact_name)<=100),
 transport_plan text check(transport_plan is null or char_length(transport_plan)<=600),
 equipment_plan text check(equipment_plan is null or char_length(equipment_plan)<=600),
 backstage_notes text check(backstage_notes is null or char_length(backstage_notes)<=600),
 closing_notes text check(closing_notes is null or char_length(closing_notes)<=1200),
 closed_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.stage_show_operation_tasks (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 category text not null check(category in ('preparation','logistics','soundcheck','show','closing')),
 title text not null check(char_length(btrim(title)) between 3 and 140),
 notes text check(notes is null or char_length(notes)<=500),
 responsible text check(responsible is null or char_length(responsible)<=100),
 due_at timestamptz,
 done boolean not null default false,
 completed_at timestamptz,
 template_code text check(template_code is null or char_length(template_code)<=40),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(event_id,template_code)
);
create index if not exists stage_show_ops_tasks_event_idx
 on public.stage_show_operation_tasks(event_id,category,done,due_at,created_at);
alter table public.stage_show_operations enable row level security;
alter table public.stage_show_operation_tasks enable row level security;
revoke all on public.stage_show_operations from public,anon,authenticated;
revoke all on public.stage_show_operation_tasks from public,anon,authenticated;

-- Authorizes owner or musician with an active accepted invitation.
-- Guests receive logistical briefing and assigned checklist (no private notes,
-- financial figures, closing details or other musicians' information).
create or replace function public.stage_show_ops_overview(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
 v_owner boolean;
 v_participant boolean;
 v_event public.events%rowtype;
 v_ops public.stage_show_operations%rowtype;
 v_tasks jsonb;
 v_summary jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select * into v_event from public.events where id=p_event_id;
 if not found then return jsonb_build_object('status','forbidden');end if;
 v_owner:=v_event.producer_id=auth.uid();
 v_participant:=exists(select 1 from public.invitations i
   where i.event_id=p_event_id and i.musician_id=auth.uid()
     and i.status='accepted' and v_event.status<>'cancelled');
 if not v_owner and not v_participant then
   return jsonb_build_object('status','forbidden');end if;
 select * into v_ops from public.stage_show_operations where event_id=p_event_id;
 if v_owner then
   select coalesce(jsonb_agg(jsonb_build_object(
     'id',t.id,'category',t.category,'title',t.title,
     'notes',t.notes,'responsible',t.responsible,'due_at',t.due_at,
     'done',t.done,'completed_at',t.completed_at,
     'template_code',t.template_code
   ) order by t.done asc,t.due_at asc nulls last,t.created_at,t.id),'[]'::jsonb)
   into v_tasks from (
      select * from public.stage_show_operation_tasks
      where event_id=p_event_id order by created_at,id limit 100
   ) t;
 else
   v_tasks:='[]'::jsonb;
 end if;
 select jsonb_build_object(
  'count',count(*),'done',count(*) filter(where done),
  'pending',count(*) filter(where not done),
  'overdue',count(*) filter(where not done and due_at<now())
 ) into v_summary from public.stage_show_operation_tasks where event_id=p_event_id;
 return jsonb_build_object(
  'status','ok','can_edit',v_owner,
  'event',jsonb_build_object(
    'id',v_event.id,'title',v_event.title,'starts_at',v_event.starts_at,
    'venue',v_event.venue,'city',v_event.city,'status',v_event.status::text),
  'briefing',jsonb_build_object(
    'arrival_at',v_ops.arrival_at,'soundcheck_at',v_ops.soundcheck_at,
    'doors_at',v_ops.doors_at,'meeting_point',v_ops.meeting_point,
    'contact_name',v_ops.contact_name,
    'transport_plan',v_ops.transport_plan,'equipment_plan',v_ops.equipment_plan),
  'private_details',case when v_owner then
     jsonb_build_object('backstage_notes',v_ops.backstage_notes,
       'closing_notes',v_ops.closing_notes,'closed_at',v_ops.closed_at,
       'updated_at',v_ops.updated_at)
    else null end,
  'tasks',v_tasks,
  'progress',case when v_owner then v_summary else null end
 );
end;
$$;
revoke all on function public.stage_show_ops_overview(uuid) from public,anon,authenticated;
grant execute on function public.stage_show_ops_overview(uuid) to authenticated;

create or replace function public.stage_show_ops_save(
 p_event_id uuid,
 p_arrival_at timestamptz,
 p_soundcheck_at timestamptz,
 p_doors_at timestamptz,
 p_meeting_point text,
 p_contact_name text,
 p_transport_plan text,
 p_equipment_plan text,
 p_backstage_notes text
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_e public.events%rowtype;
begin
 if auth.uid() is null then return 'login_required';end if;
 select * into v_e from public.events
 where id=p_event_id and producer_id=auth.uid() for update;
 if not found then return 'forbidden';end if;
 if v_e.status='cancelled' then return 'cancelled';end if;
 if char_length(coalesce(p_meeting_point,''))>180
   or char_length(coalesce(p_contact_name,''))>100
   or char_length(coalesce(p_transport_plan,''))>600
   or char_length(coalesce(p_equipment_plan,''))>600
   or char_length(coalesce(p_backstage_notes,''))>600
   or (p_arrival_at is not null and (p_arrival_at < v_e.starts_at-interval '3 days' or p_arrival_at > v_e.starts_at+interval '1 day'))
   or (p_soundcheck_at is not null and (p_soundcheck_at < v_e.starts_at-interval '3 days' or p_soundcheck_at > v_e.starts_at+interval '1 day'))
   or (p_doors_at is not null and (p_doors_at < v_e.starts_at-interval '3 days' or p_doors_at > v_e.starts_at+interval '1 day'))
 then return 'invalid';end if;
 insert into public.stage_show_operations(
  event_id,arrival_at,soundcheck_at,doors_at,meeting_point,
  contact_name,transport_plan,equipment_plan,backstage_notes,updated_at
 ) values(
  p_event_id,p_arrival_at,p_soundcheck_at,p_doors_at,
  nullif(btrim(coalesce(p_meeting_point,'')),''),
  nullif(btrim(coalesce(p_contact_name,'')),''),
  nullif(btrim(coalesce(p_transport_plan,'')),''),
  nullif(btrim(coalesce(p_equipment_plan,'')),''),
  nullif(btrim(coalesce(p_backstage_notes,'')),''),now()
 )
 on conflict(event_id) do update set
  arrival_at=excluded.arrival_at,soundcheck_at=excluded.soundcheck_at,
  doors_at=excluded.doors_at,meeting_point=excluded.meeting_point,
  contact_name=excluded.contact_name,
  transport_plan=excluded.transport_plan,equipment_plan=excluded.equipment_plan,
  backstage_notes=excluded.backstage_notes,updated_at=now();
 return 'saved';
end;
$$;
revoke all on function public.stage_show_ops_save(
 uuid,timestamptz,timestamptz,timestamptz,text,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.stage_show_ops_save(
 uuid,timestamptz,timestamptz,timestamptz,text,text,text,text,text)
 to authenticated;

create or replace function public.stage_show_ops_seed(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_e public.events%rowtype;v_added integer;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select * into v_e from public.events
 where id=p_event_id and producer_id=auth.uid() for update;
 if not found then return jsonb_build_object('status','forbidden');end if;
 if v_e.status='cancelled' then return jsonb_build_object('status','cancelled');end if;
 insert into public.stage_show_operation_tasks(event_id,category,title,due_at,template_code)
 values
 (p_event_id,'preparation','Confirmar local e horário',v_e.starts_at-interval '7 days','venue'),
 (p_event_id,'preparation','Revisar convites e músicos confirmados',v_e.starts_at-interval '5 days','lineup'),
 (p_event_id,'logistics','Planejar transporte e chegada da equipe',v_e.starts_at-interval '3 days','transport'),
 (p_event_id,'logistics','Conferir instrumentos, cabos e equipamentos',v_e.starts_at-interval '2 days','equipment'),
 (p_event_id,'soundcheck','Combinar passagem de som',v_e.starts_at-interval '1 day','soundcheck'),
 (p_event_id,'show','Repassar ponto de encontro e horários',v_e.starts_at-interval '12 hours','arrival'),
 (p_event_id,'closing','Registrar despesas e pagamentos realizados',v_e.starts_at+interval '1 day','finance'),
 (p_event_id,'closing','Registrar ocorrências e concluir pós-show',v_e.starts_at+interval '2 days','closure')
 on conflict(event_id,template_code) do nothing;
 get diagnostics v_added=row_count;
 return jsonb_build_object('status','ok','created',v_added);
end;
$$;
revoke all on function public.stage_show_ops_seed(uuid) from public,anon,authenticated;
grant execute on function public.stage_show_ops_seed(uuid) to authenticated;

create or replace function public.stage_show_ops_task_save(
 p_event_id uuid,
 p_task_id uuid,
 p_category text,
 p_title text,
 p_notes text,
 p_responsible text,
 p_due_at timestamptz
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_e public.events%rowtype;v_id uuid;v_title text:=btrim(coalesce(p_title,''));
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select * into v_e from public.events
 where id=p_event_id and producer_id=auth.uid() for update;
 if not found then return jsonb_build_object('status','forbidden');end if;
 if v_e.status='cancelled' then return jsonb_build_object('status','cancelled');end if;
 if p_category is null or p_category not in ('preparation','logistics','soundcheck','show','closing')
  or char_length(v_title) not between 3 and 140
  or char_length(coalesce(p_notes,''))>500
  or char_length(coalesce(p_responsible,''))>100
  or (p_due_at is not null and
     (p_due_at<v_e.starts_at-interval '60 days' or p_due_at>v_e.starts_at+interval '60 days'))
 then return jsonb_build_object('status','invalid');end if;
 if p_task_id is null then
  if (select count(*) from public.stage_show_operation_tasks where event_id=p_event_id)>=100
   then return jsonb_build_object('status','limit_reached');end if;
  insert into public.stage_show_operation_tasks(
    event_id,category,title,notes,responsible,due_at
  ) values(p_event_id,p_category,v_title,
    nullif(btrim(coalesce(p_notes,'')),''),
    nullif(btrim(coalesce(p_responsible,'')),''),p_due_at)
  returning id into v_id;
 else
  update public.stage_show_operation_tasks
  set category=p_category,title=v_title,notes=nullif(btrim(coalesce(p_notes,'')),''),
   responsible=nullif(btrim(coalesce(p_responsible,'')),''),due_at=p_due_at,updated_at=now()
  where id=p_task_id and event_id=p_event_id
  returning id into v_id;
  if not found then return jsonb_build_object('status','not_found');end if;
 end if;
 return jsonb_build_object('status','ok','id',v_id);
end;
$$;
revoke all on function public.stage_show_ops_task_save(
 uuid,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.stage_show_ops_task_save(
 uuid,uuid,text,text,text,text,timestamptz) to authenticated;

create or replace function public.stage_show_ops_task_toggle(
 p_event_id uuid,p_task_id uuid,p_done boolean
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_e public.events%rowtype;
begin
 if auth.uid() is null then return 'login_required';end if;
 if p_done is null then return 'invalid';end if;
 select * into v_e from public.events
 where id=p_event_id and producer_id=auth.uid() for update;
 if not found then return 'forbidden';end if;
 if v_e.status='cancelled' then return 'cancelled';end if;
 update public.stage_show_operation_tasks
 set done=p_done,completed_at=case when p_done then now() else null end,updated_at=now()
 where id=p_task_id and event_id=p_event_id;
 if not found then return 'not_found';end if;
 return 'saved';
end;
$$;
revoke all on function public.stage_show_ops_task_toggle(uuid,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.stage_show_ops_task_toggle(uuid,uuid,boolean) to authenticated;

create or replace function public.stage_show_ops_task_remove(
 p_event_id uuid,p_task_id uuid
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_e public.events%rowtype;
begin
 if auth.uid() is null then return 'login_required';end if;
 select * into v_e from public.events
 where id=p_event_id and producer_id=auth.uid() for update;
 if not found then return 'forbidden';end if;
 if v_e.status='cancelled' then return 'cancelled';end if;
 delete from public.stage_show_operation_tasks
 where id=p_task_id and event_id=p_event_id;
 if not found then return 'not_found';end if;
 return 'removed';
end;
$$;
revoke all on function public.stage_show_ops_task_remove(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.stage_show_ops_task_remove(uuid,uuid) to authenticated;

create or replace function public.stage_show_ops_close(
 p_event_id uuid,p_notes text,p_reopen boolean default false
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_e public.events%rowtype;
begin
 if auth.uid() is null then return 'login_required';end if;
 if char_length(coalesce(p_notes,''))>1200 or p_reopen is null
 then return 'invalid';end if;
 select * into v_e from public.events
 where id=p_event_id and producer_id=auth.uid() for update;
 if not found then return 'forbidden';end if;
 if v_e.status='cancelled' then return 'cancelled';end if;
 if not p_reopen and v_e.starts_at>now() then return 'not_yet';end if;
 if not p_reopen and exists(select 1 from public.stage_show_operation_tasks
      where event_id=p_event_id and category='closing' and not done)
 then return 'closing_pending';end if;
 insert into public.stage_show_operations(event_id,closing_notes,closed_at,updated_at)
 values(p_event_id,nullif(btrim(coalesce(p_notes,'')),''),
  case when p_reopen then null else now() end,now())
 on conflict(event_id) do update set
 closing_notes=excluded.closing_notes,
 closed_at=excluded.closed_at,updated_at=now();
 return 'saved';
end;
$$;
revoke all on function public.stage_show_ops_close(uuid,text,boolean)
 from public,anon,authenticated;
grant execute on function public.stage_show_ops_close(uuid,text,boolean)
 to authenticated;

commit;
notify pgrst,'reload schema';
