-- Stage Flow | Central privada de notificações (homologação)
-- Pré-requisitos: invitations, events, stage_hiring_proposals, stage_hiring_messages.
-- Notificações no site apenas. Nenhum push / HTTP / WhatsApp é enviado.
begin;
create table if not exists public.stage_internal_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 source_type text not null check(source_type in ('invitation','proposal','conversation')),
 source_id uuid not null,
 event_code text not null check(event_code in
   ('invite_received','invite_accepted','invite_declined','invite_cancelled',
    'proposal_received','proposal_accepted','proposal_declined','proposal_withdrawn',
    'chat_message')),
 event_id uuid,
 thread_id uuid,
 title text not null check(char_length(title) between 1 and 160),
 summary text not null check(char_length(summary) between 1 and 240),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(recipient_id,source_type,source_id,event_code)
);
create index if not exists stage_notifications_recipient_recent_idx
 on public.stage_internal_notifications(recipient_id,created_at desc,id desc);
create index if not exists stage_notifications_recipient_unread_idx
 on public.stage_internal_notifications(recipient_id,created_at desc)
 where read_at is null;
alter table public.stage_internal_notifications enable row level security;
revoke all on public.stage_internal_notifications from public,anon,authenticated;

-- Trigger runs inside the original transaction, so canceled/failed
-- invitations and proposals cannot create phantom notifications.
create or replace function public.stage_notify_invitation_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_owner uuid;v_title text;v_to uuid;v_code text;v_heading text;v_body text;
begin
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
 select e.producer_id,left(e.title,110) into v_owner,v_title
 from public.events e where e.id=new.event_id;
 if v_owner is null then return new;end if;
 if tg_op='INSERT' then
   if new.status::text<>'pending' or new.musician_id is null then return new;end if;
   v_to:=new.musician_id;v_code:='invite_received';
   v_heading:='Novo convite para tocar';
   v_body:='Você recebeu um convite para '||coalesce(v_title,'um show')||'.';
 elsif new.status::text='accepted' then
   v_to:=v_owner;v_code:='invite_accepted';
   v_heading:='Convite confirmado';
   v_body:='Um músico confirmou participação em '||coalesce(v_title,'seu show')||'.';
 elsif new.status::text='declined' then
   v_to:=v_owner;v_code:='invite_declined';
   v_heading:='Convite recusado';
   v_body:='Um músico recusou o convite para '||coalesce(v_title,'seu show')||'.';
 elsif new.status::text='cancelled' and new.musician_id is not null then
   v_to:=new.musician_id;v_code:='invite_cancelled';
   v_heading:='Participação cancelada';
   v_body:='Um convite para '||coalesce(v_title,'um show')||' foi cancelado. Confira os detalhes no Stage Flow.';
 else return new;
 end if;
 if v_to is null or (v_to=v_owner and v_code='invite_received') then return new;end if;
 insert into public.stage_internal_notifications(
   recipient_id,source_type,source_id,event_code,event_id,title,summary
 ) values(v_to,'invitation',new.id,v_code,new.event_id,v_heading,left(v_body,240))
 on conflict(recipient_id,source_type,source_id,event_code) do nothing;
 return new;
end;
$$;
revoke all on function public.stage_notify_invitation_trigger() from public,anon,authenticated;
drop trigger if exists stage_notify_invitation_changed on public.invitations;
create trigger stage_notify_invitation_changed
after insert or update of status on public.invitations
for each row execute function public.stage_notify_invitation_trigger();

create or replace function public.stage_notify_proposal_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_to uuid;v_code text;v_heading text;v_body text;
begin
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
 if tg_op='INSERT' then
   if new.status<>'pending' then return new;end if;
   v_to:=new.musician_id;v_code:='proposal_received';
   v_heading:='Nova proposta de show';v_body:='Você recebeu uma proposta para '||left(new.title,110)||'.';
 elsif new.status='accepted' then
   v_to:=new.requester_id;v_code:='proposal_accepted';
   v_heading:='Proposta aceita';v_body:='Sua proposta para '||left(new.title,110)||' foi aceita.';
 elsif new.status='declined' then
   v_to:=new.requester_id;v_code:='proposal_declined';
   v_heading:='Proposta recusada';v_body:='Sua proposta para '||left(new.title,110)||' foi recusada.';
 elsif new.status='withdrawn' then
   v_to:=new.musician_id;v_code:='proposal_withdrawn';
   v_heading:='Proposta retirada';v_body:='Uma proposta para '||left(new.title,110)||' foi retirada.';
 else return new;
 end if;
 if v_to is null then return new;end if;
 insert into public.stage_internal_notifications(
  recipient_id,source_type,source_id,event_code,event_id,thread_id,title,summary
 ) values(v_to,'proposal',new.id,v_code,
  coalesce(new.linked_event_id,new.source_event_id),new.thread_id,
  v_heading,left(v_body,240))
 on conflict(recipient_id,source_type,source_id,event_code) do nothing;
 return new;
end;
$$;
revoke all on function public.stage_notify_proposal_trigger() from public,anon,authenticated;
drop trigger if exists stage_notify_proposal_changed on public.stage_hiring_proposals;
create trigger stage_notify_proposal_changed
after insert or update of status on public.stage_hiring_proposals
for each row execute function public.stage_notify_proposal_trigger();

create or replace function public.stage_notify_chat_message_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_to uuid;
begin
 -- Propostas já têm notificações próprias, sem um segundo aviso de sistema.
 if new.body in (
  'Uma proposta formal de show foi enviada. Confira os detalhes na conversa.',
  'Proposta de show aceita! A apresentação foi vinculada à agenda e ao convite.',
  'A proposta de show foi recusada. Vocês podem conversar e enviar outra.',
  'O contratante retirou a proposta anterior.'
 ) then return new;end if;
 select case when t.requester_id=new.sender_id then t.musician_id
             when t.musician_id=new.sender_id then t.requester_id
             else null end into v_to
 from public.stage_hiring_threads t where t.id=new.thread_id;
 if v_to is null then return new;end if;
 -- One notification per conversation: each new message reopens and refreshes it.
 insert into public.stage_internal_notifications(
  recipient_id,source_type,source_id,event_code,thread_id,title,summary
 ) values(v_to,'conversation',new.thread_id,'chat_message',new.thread_id,
   'Nova mensagem no chat','Você recebeu uma mensagem de contratação no Stage Flow.')
 on conflict(recipient_id,source_type,source_id,event_code)
 do update set read_at=null,created_at=excluded.created_at;
 return new;
end;
$$;
revoke all on function public.stage_notify_chat_message_trigger() from public,anon,authenticated;
drop trigger if exists stage_notify_chat_message on public.stage_hiring_messages;
create trigger stage_notify_chat_message
after insert on public.stage_hiring_messages
for each row execute function public.stage_notify_chat_message_trigger();

-- Read access exclusively through an authenticated, user-scoped RPC.
create or replace function public.stage_notifications_list(
 p_filter text default 'all',p_limit integer default 80
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;v_unread integer;v_limit integer;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_filter not in ('all','unread') or p_limit is null or p_limit not between 1 and 100
 then return jsonb_build_object('status','invalid');end if;
 v_limit:=p_limit;
 select count(*) into v_unread from public.stage_internal_notifications
  where recipient_id=auth.uid() and read_at is null;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',n.id,'source_type',n.source_type,'source_id',n.source_id,
  'event_code',n.event_code,'event_id',n.event_id,'thread_id',n.thread_id,
  'title',n.title,'summary',n.summary,
  'created_at',n.created_at,'read_at',n.read_at
 ) order by n.created_at desc,n.id desc),'[]'::jsonb)
 into v_items
 from (select * from public.stage_internal_notifications
       where recipient_id=auth.uid() and
         (p_filter='all' or read_at is null)
       order by created_at desc,id desc limit v_limit) n;
 return jsonb_build_object('status','ok','unread',v_unread,
   'items',v_items,'limit',v_limit);
end;
$$;
revoke all on function public.stage_notifications_list(text,integer)
 from public,anon,authenticated;
grant execute on function public.stage_notifications_list(text,integer) to authenticated;

create or replace function public.stage_notifications_mark(
 p_ids uuid[] default null,p_all boolean default false
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_all is distinct from true and
  (p_ids is null or cardinality(p_ids)=0 or cardinality(p_ids)>100)
 then return jsonb_build_object('status','invalid');end if;
 update public.stage_internal_notifications n set read_at=now()
 where n.recipient_id=auth.uid() and n.read_at is null and (
   p_all=true or n.id=any(p_ids)
 );
 get diagnostics v_count=row_count;
 return jsonb_build_object('status','ok','marked',v_count);
end;
$$;
revoke all on function public.stage_notifications_mark(uuid[],boolean)
 from public,anon,authenticated;
grant execute on function public.stage_notifications_mark(uuid[],boolean) to authenticated;

-- Lightweight count for navbar, with no ability to list other people's data.
create or replace function public.stage_notifications_unread_count()
returns integer language sql stable security definer set search_path=''
as $$
 select count(*)::integer from public.stage_internal_notifications
 where recipient_id=auth.uid() and read_at is null;
$$;
revoke all on function public.stage_notifications_unread_count() from public,anon,authenticated;
grant execute on function public.stage_notifications_unread_count() to authenticated;

commit;
notify pgrst, 'reload schema';
