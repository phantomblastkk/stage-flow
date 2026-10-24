-- Stage Flow: valida disponibilidade também ao criar e aceitar propostas.
-- Aplica somente depois de musician_smart_schedule_migration.sql.
begin;
create or replace function public.stage_hiring_proposal_send(
 p_thread_id uuid,
 p_title text,
 p_venue text,
 p_city text,
 p_starts_at timestamptz,
 p_fee numeric,
 p_details text default null
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
 v_thread public.stage_hiring_threads%rowtype;
 v_id uuid;
 v_title text:=btrim(coalesce(p_title,''));
 v_venue text:=nullif(btrim(coalesce(p_venue,'')),'');
 v_city text:=nullif(btrim(coalesce(p_city,'')),'');
 v_note text:=nullif(btrim(coalesce(p_details,'')),'');
 v_existing timestamptz;
 v_check text;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_thread_id is null or char_length(v_title) not between 3 and 140
 or char_length(coalesce(v_venue,''))>140 or char_length(coalesce(v_city,''))>80
 or char_length(coalesce(v_note,''))>800 or p_starts_at is null
 or p_starts_at<=now() or p_starts_at>now()+interval '366 days'
 or (p_fee is not null and (p_fee<=0 or p_fee>999999.99 or round(p_fee,2)<>p_fee))
 then return jsonb_build_object('status','invalid');end if;

 select * into v_thread from public.stage_hiring_threads
 where id=p_thread_id and requester_id=auth.uid() for update;
 if not found then return jsonb_build_object('status','forbidden');end if;
 if v_thread.availability='unavailable' then
   return jsonb_build_object('status','unavailable');end if;
 if v_thread.requested_date is not null and
   (p_starts_at at time zone 'America/Sao_Paulo')::date<>v_thread.requested_date then
   return jsonb_build_object('status','different_day');end if;
 if v_thread.event_id is not null then
   select starts_at into v_existing from public.events
   where id=v_thread.event_id and producer_id=auth.uid() and status<>'cancelled';
   if not found or abs(extract(epoch from v_existing-p_starts_at))>300 then
     return jsonb_build_object('status','event_mismatch');end if;
 end if;
 select public.stage_musician_schedule_check(
   v_thread.musician_id,p_starts_at,p_starts_at+interval '4 hours',
   p_thread_id,v_thread.event_id
 ) into v_check;
 if v_check='busy' then return jsonb_build_object('status','schedule_conflict');end if;
 if v_check not in ('free','possible_conflict') then
    return jsonb_build_object('status','schedule_unavailable');end if;
 if exists(select 1 from public.stage_hiring_proposals
  where thread_id=p_thread_id and status='pending') then
  return jsonb_build_object('status','pending_exists');end if;
 if exists(select 1 from public.stage_hiring_proposals
  where thread_id=p_thread_id and status='accepted') then
  return jsonb_build_object('status','already_confirmed');end if;
 if (select count(*) from public.stage_hiring_proposals
   where requester_id=auth.uid() and created_at>now()-interval '24 hours')>=15 then
  return jsonb_build_object('status','daily_limit');end if;

 insert into public.stage_hiring_proposals(thread_id,requester_id,musician_id,
   title,venue,city,starts_at,fee_amount,details,source_event_id)
 values(p_thread_id,auth.uid(),v_thread.musician_id,
   v_title,v_venue,v_city,p_starts_at,p_fee,v_note,v_thread.event_id)
 returning id into v_id;

 -- Reaproveita aviso transacional do chat, respeitando opt-in e deduplicacao.
 perform public.stage_hiring_send(p_thread_id,
   'Uma proposta formal de show foi enviada. Confira os detalhes na conversa.');
 return jsonb_build_object('status','ok','proposal_id',v_id,'availability_warning',v_check='possible_conflict');
end;
$$;
create or replace function public.stage_hiring_proposal_decide(
 p_proposal_id uuid,p_accept boolean
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
 v_proposal public.stage_hiring_proposals%rowtype;
 v_event uuid;
 v_invitation uuid;
 v_thread public.stage_hiring_threads%rowtype;
 v_check text;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 if p_proposal_id is null or p_accept is null then
  return jsonb_build_object('status','invalid');end if;

 select * into v_proposal from public.stage_hiring_proposals
  where id=p_proposal_id and musician_id=auth.uid() for update;
 if not found then return jsonb_build_object('status','forbidden');end if;
 if v_proposal.status<>'pending' then
   return jsonb_build_object('status','closed');end if;
 select * into v_thread from public.stage_hiring_threads
   where id=v_proposal.thread_id for update;
 if p_accept then
   if v_proposal.starts_at<=now() then
    return jsonb_build_object('status','expired');end if;
   -- Lock por músico: serializa confirmações concorrentes feitas pelo chat.
   perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_proposal.musician_id::text, 817234)
   );
   select public.stage_musician_schedule_check(
      v_proposal.musician_id,v_proposal.starts_at,
      v_proposal.starts_at+interval '4 hours',
      v_proposal.thread_id,v_proposal.source_event_id
   ) into v_check;
   if v_check='busy' then
      return jsonb_build_object('status','schedule_conflict');end if;
   if v_check not in ('free','possible_conflict') then
      return jsonb_build_object('status','schedule_unavailable');end if;
   if v_thread.availability='unavailable' then
    return jsonb_build_object('status','unavailable');end if;
   -- Um convite ja existente precisa ser resolvido na agenda, nunca duplicado.
   v_event:=v_proposal.source_event_id;
   if v_event is not null and not exists(select 1 from public.events
     where id=v_event and producer_id=v_proposal.requester_id and status<>'cancelled') then
      return jsonb_build_object('status','event_unavailable');end if;
   if v_event is not null and exists(select 1 from public.invitations
     where event_id=v_event and musician_id=auth.uid()) then
     return jsonb_build_object('status','existing_invite');end if;
   if v_event is null then
     insert into public.events(producer_id,title,venue,city,
       starts_at,status,show_publicly)
     values(v_proposal.requester_id,v_proposal.title,
       v_proposal.venue,v_proposal.city,v_proposal.starts_at,
       'draft',false) returning id into v_event;
   end if;
   insert into public.invitations(event_id,musician_id,message,
       fee_amount,status,responded_at)
   values(v_event,auth.uid(),
       left(coalesce(v_proposal.details,'Proposta aceita pelo chat do Stage Flow'),500),
       v_proposal.fee_amount,'accepted',now())
   returning id into v_invitation;
   if v_proposal.fee_amount is not null then
     insert into public.stage_fee_negotiations(invitation_id,last_amount,
       last_by,agreed_amount,updated_at)
     values(v_invitation,v_proposal.fee_amount,
       v_proposal.requester_id,v_proposal.fee_amount,now());
   end if;
   update public.stage_hiring_proposals
     set status='accepted',responded_at=now(),
       linked_event_id=v_event,linked_invitation_id=v_invitation
     where id=p_proposal_id;
   perform public.stage_hiring_send(v_proposal.thread_id,
     'Proposta de show aceita! A apresentação foi vinculada à agenda e ao convite.');
 else
   update public.stage_hiring_proposals
     set status='declined',responded_at=now() where id=p_proposal_id;
   perform public.stage_hiring_send(v_proposal.thread_id,
     'A proposta de show foi recusada. Vocês podem conversar e enviar outra.');
 end if;
 return jsonb_build_object('status','ok','decision',
   case when p_accept then 'accepted' else 'declined' end,
   'event_id',v_event,'invitation_id',v_invitation);
end;
$$;
commit;
notify pgrst,'reload schema';
