-- StageFlow | Pro courtesy notifications, part of the existing private inbox.
-- Transaction-bound notifications: only actual access changes emit notices.
-- No email, push, WhatsApp, payment changes, or exposed notification table.
begin;

alter table public.stage_internal_notifications
 drop constraint if exists stage_internal_notifications_source_type_check;
alter table public.stage_internal_notifications
 add constraint stage_internal_notifications_source_type_check check (
  source_type in ('invitation','proposal','conversation','operations','account')
 );

alter table public.stage_internal_notifications
 drop constraint if exists stage_internal_notifications_event_code_check;
alter table public.stage_internal_notifications
 add constraint stage_internal_notifications_event_code_check check (
  event_code in (
   'invite_received','invite_accepted','invite_declined','invite_cancelled',
   'proposal_received','proposal_accepted','proposal_declined','proposal_withdrawn',
   'chat_message','show_briefing_changed',
   'pro_courtesy_granted','pro_courtesy_revoked'
  )
 );

create or replace function public.stage_notify_pro_courtesy_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 v_owner uuid;
 v_code text;
 v_title text;
 v_summary text;
begin
 if tg_op='INSERT' then
   v_owner:=new.owner_id;
   v_code:='pro_courtesy_granted';
   v_title:='Sua cortesia StageFlow Pro chegou!';
   v_summary:='A administracao liberou gratuitamente os recursos Pro do seu perfil de cantor. Abra seu editor para escolher o que publicar.';
 elsif tg_op='DELETE' then
   v_owner:=old.owner_id;
   v_code:='pro_courtesy_revoked';
   v_title:='Atualizacao da sua cortesia Pro';
   v_summary:='A cortesia Pro foi encerrada. Seu perfil gratuito e seus rascunhos continuam salvos. Assinaturas pagas nao sao canceladas aqui.';
 else
   return null;
 end if;

 insert into public.stage_internal_notifications(
   recipient_id,source_type,source_id,event_code,title,summary
 ) values(v_owner,'account',v_owner,v_code,v_title,v_summary)
 on conflict(recipient_id,source_type,source_id,event_code)
 do update set
  title=excluded.title,summary=excluded.summary,
  created_at=excluded.created_at,read_at=null;
 return null;
end;
$$;
revoke all on function public.stage_notify_pro_courtesy_trigger() from public,anon,authenticated;
drop trigger if exists stage_pro_courtesy_notifications on public.stage_pro_site_access;
create trigger stage_pro_courtesy_notifications
after insert or delete on public.stage_pro_site_access
for each row execute function public.stage_notify_pro_courtesy_trigger();

-- Existing manual courtesies, including recipients granted Pro before this
-- notification feature, receive one accurate welcome notice on rollout.
-- Does not grant or revoke Pro; preserves read state when re-run.
insert into public.stage_internal_notifications(
 recipient_id,source_type,source_id,event_code,title,summary,created_at
)
select a.owner_id,'account',a.owner_id,'pro_courtesy_granted',
 'Sua cortesia StageFlow Pro chegou!',
 'A administracao liberou gratuitamente os recursos Pro do seu perfil de cantor. Abra seu editor para escolher o que publicar.',
 a.granted_at
from public.stage_pro_site_access a
on conflict(recipient_id,source_type,source_id,event_code) do nothing;

commit;
notify pgrst, 'reload schema';
