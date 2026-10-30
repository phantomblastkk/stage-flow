-- StageFlow · Private, payload-free account signals for chat and notifications.
-- Apply together with the matching Next.js release; do not publish triggers separately.
-- Broadcasts are best-effort *hints*: RPCs remain authoritative.
-- Requires Supabase Realtime database broadcast and channel authorization.
begin;

-- realtime.messages already has RLS enabled by Supabase; do not ALTER it.
-- This SELECT policy grants only subscription to the signed-in account's topic.
-- There is deliberately NO INSERT policy for authenticated/anon clients.
create policy stageflow_receive_own_account_signals
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select auth.uid()) is not null
  and (select realtime.topic()) = 'stageflow:account:' || (select auth.uid())::text
);

create or replace function public.stageflow_signal_chat_message()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  v_requester uuid;
  v_musician uuid;
begin
  select t.requester_id,t.musician_id into v_requester,v_musician
  from public.stage_hiring_threads t where t.id=new.thread_id;
  -- Never transmit message bodies, phone numbers, proposals or identity details.
  if v_requester is not null then
    begin
      perform realtime.send(
        jsonb_build_object('kind','chat','thread_id',new.thread_id::text),
        'chat_changed','stageflow:account:'||v_requester::text,true
      );
    exception when others then
      -- A Realtime outage must not prevent a musician from sending a message.
      null;
    end;
  end if;
  if v_musician is not null and v_musician is distinct from v_requester then
    begin
      perform realtime.send(
        jsonb_build_object('kind','chat','thread_id',new.thread_id::text),
        'chat_changed','stageflow:account:'||v_musician::text,true
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.stageflow_signal_chat_message() from public,anon,authenticated;

drop trigger if exists stageflow_realtime_chat_message on public.stage_hiring_messages;
create trigger stageflow_realtime_chat_message
 after insert on public.stage_hiring_messages
 for each row execute function public.stageflow_signal_chat_message();

create or replace function public.stageflow_signal_notification()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.recipient_id is not null then
    begin
      perform realtime.send(
        '{"kind":"notification"}'::jsonb,
        'notifications_changed','stageflow:account:'||new.recipient_id::text,true
      );
    exception when others then
      -- Realtime signals must not roll back invitations or marking notices read.
      null;
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.stageflow_signal_notification() from public,anon,authenticated;

drop trigger if exists stageflow_realtime_notification on public.stage_internal_notifications;
create trigger stageflow_realtime_notification
 after insert or update of read_at,created_at on public.stage_internal_notifications
 for each row execute function public.stageflow_signal_notification();

commit;
