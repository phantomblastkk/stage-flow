-- Stage Flow · QA: alertas operacionais de shows para músicos confirmados.
-- Dependências: internal_notifications_migration.sql e show_operations_migration.sql.
-- Nenhum push, envio WhatsApp ou notificação externa.
begin;

alter table public.stage_internal_notifications
 drop constraint if exists stage_internal_notifications_source_type_check;
alter table public.stage_internal_notifications
 add constraint stage_internal_notifications_source_type_check
 check (source_type in ('invitation','proposal','conversation','operations'));

alter table public.stage_internal_notifications
 drop constraint if exists stage_internal_notifications_event_code_check;
alter table public.stage_internal_notifications
 add constraint stage_internal_notifications_event_code_check
 check (event_code in (
  'invite_received','invite_accepted','invite_declined','invite_cancelled',
  'proposal_received','proposal_accepted','proposal_declined','proposal_withdrawn',
  'chat_message','show_briefing_changed'
 ));

-- A inserção/atualização do briefing e a notificação pertencem à mesma transação.
-- Somente dados logísticos geram aviso; notas privadas ou pós-show não geram.
-- A mensagem anuncia quais campos mudaram SEM copiar valores sensíveis.
create or replace function public.stage_notify_show_briefing_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
 v_fields text[]:=array[]::text[];
 v_title text;
 v_owner uuid;
begin
 if tg_op='INSERT' then
  if new.arrival_at is not null then v_fields:=array_append(v_fields,'horário de chegada');end if;
  if new.soundcheck_at is not null then v_fields:=array_append(v_fields,'passagem de som');end if;
  if new.doors_at is not null then v_fields:=array_append(v_fields,'abertura das portas');end if;
  if new.meeting_point is not null then v_fields:=array_append(v_fields,'ponto de encontro');end if;
  if new.contact_name is not null then v_fields:=array_append(v_fields,'contato da produção');end if;
  if new.transport_plan is not null then v_fields:=array_append(v_fields,'transporte');end if;
  if new.equipment_plan is not null then v_fields:=array_append(v_fields,'equipamentos');end if;
 else
  if new.arrival_at is distinct from old.arrival_at
   then v_fields:=array_append(v_fields,'horário de chegada');end if;
  if new.soundcheck_at is distinct from old.soundcheck_at
   then v_fields:=array_append(v_fields,'passagem de som');end if;
  if new.doors_at is distinct from old.doors_at
   then v_fields:=array_append(v_fields,'abertura das portas');end if;
  if new.meeting_point is distinct from old.meeting_point
   then v_fields:=array_append(v_fields,'ponto de encontro');end if;
  if new.contact_name is distinct from old.contact_name
   then v_fields:=array_append(v_fields,'contato da produção');end if;
  if new.transport_plan is distinct from old.transport_plan
   then v_fields:=array_append(v_fields,'transporte');end if;
  if new.equipment_plan is distinct from old.equipment_plan
   then v_fields:=array_append(v_fields,'equipamentos');end if;
 end if;
 if cardinality(v_fields)=0 then return new;end if;

 select left(e.title,100),e.producer_id
 into v_title,v_owner
 from public.events e
 where e.id=new.event_id
  and e.status not in ('cancelled','completed')
  and e.starts_at>now();
 if v_owner is null then return new;end if;

 insert into public.stage_internal_notifications(
   recipient_id,source_type,source_id,event_code,event_id,title,summary
 )
 select distinct i.musician_id,'operations',new.event_id,'show_briefing_changed',
   new.event_id,'Informações do show atualizadas',
   left('Show '||coalesce(v_title,'agendado')||': '||
        array_to_string(v_fields,', ')||
        '. Confira o briefing atualizado.',240)
 from public.invitations i
 where i.event_id=new.event_id
   and i.musician_id is not null
   and i.musician_id<>v_owner
   and i.status='accepted'
 on conflict(recipient_id,source_type,source_id,event_code)
 do update set
   title=excluded.title,
   summary=excluded.summary,
   event_id=excluded.event_id,
   created_at=excluded.created_at,
   read_at=null;

 return new;
end;
$$;
revoke all on function public.stage_notify_show_briefing_trigger()
 from public,anon,authenticated;

drop trigger if exists stage_notify_show_briefing on public.stage_show_operations;
create trigger stage_notify_show_briefing
after insert or update of
 arrival_at,soundcheck_at,doors_at,meeting_point,contact_name,
 transport_plan,equipment_plan,backstage_notes
on public.stage_show_operations
for each row
execute function public.stage_notify_show_briefing_trigger();

commit;
notify pgrst,'reload schema';
