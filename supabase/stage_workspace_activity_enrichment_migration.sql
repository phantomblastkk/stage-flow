-- StageFlow | Activity feed enrichment from already stored, user-owned facts.
-- No billing mutations; finance entries are labeled as manually registered.
begin;
create or replace function public.stage_workspace_overview()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
 v_uid uuid:=auth.uid();
 v_shows integer:=0;
 v_invites integer:=0;
 v_conversations integer:=0;
 v_contacts integer:=0;
 v_revenue numeric:=0;
 v_upcoming jsonb:='[]'::jsonb;
 v_activity jsonb:='[]'::jsonb;
 v_since timestamptz;
 v_until timestamptz;
begin
 if v_uid is null then return jsonb_build_object('status','login_required'); end if;
 if not exists(select 1 from public.profiles p where p.id=v_uid)
 then return jsonb_build_object('status','profile_required'); end if;

 v_since:=date_trunc('month',now() at time zone 'America/Sao_Paulo')
   at time zone 'America/Sao_Paulo';
 v_until:=v_since+interval '1 month';

 -- An invitation participant is not counted twice for their own show.
 select count(*) into v_shows
 from (
  select e.id from public.events e
  where e.producer_id=v_uid and e.status<>'cancelled'
    and e.starts_at>=now() and e.starts_at<now()+interval '7 days'
  union
  select e.id from public.invitations i
  join public.events e on e.id=i.event_id
  where i.musician_id=v_uid and i.status='accepted'
    and e.status<>'cancelled' and e.starts_at>=now()
    and e.starts_at<now()+interval '7 days'
 ) s;

 select count(*) into v_invites
 from public.invitations i
 where i.musician_id=v_uid and i.status='pending';

 -- Unread conversation threads, not an invented raw message count.
 select count(*) into v_conversations
 from public.stage_hiring_threads h
 where (h.requester_id=v_uid and h.last_message_at>
   coalesce(h.requester_read_at,'epoch'::timestamptz))
 or (h.musician_id=v_uid and h.last_message_at>
   coalesce(h.musician_read_at,'epoch'::timestamptz));

 select count(*) into v_contacts
 from public.stage_artist_booking_requests b
 where b.artist_id=v_uid and b.status='new';

 -- Financial metric means manually RECORDED receipts for shows occurring
 -- during the current São Paulo calendar month (not Asaas settlement).
 select coalesce(sum(z.amount),0) into v_revenue from (
  select coalesce(b.received_amount,0) as amount
  from public.events e
  join public.stage_event_budget b on b.event_id=e.id
  where e.producer_id=v_uid and e.status<>'cancelled'
    and e.starts_at>=v_since and e.starts_at<v_until
  union all
  select coalesce(f.received_amount,0) as amount
  from public.invitations i
  join public.events e on e.id=i.event_id
  join public.stage_show_participation_finance f on f.invitation_id=i.id
  where i.musician_id=v_uid and i.status='accepted'
    and e.producer_id<>v_uid and e.status<>'cancelled'
    and e.starts_at>=v_since and e.starts_at<v_until
 ) z;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',s.id,'title',s.title,'starts_at',s.starts_at,
   'venue',s.venue,'city',s.city,'kind',s.kind
 ) order by s.starts_at,s.id),'[]'::jsonb)
 into v_upcoming
 from (
   (select e.id,e.title,e.starts_at,e.venue,e.city,'organized'::text kind
    from public.events e
    where e.producer_id=v_uid and e.status<>'cancelled'
      and e.starts_at>=now()
    order by e.starts_at,e.id limit 6)
   union all
   (select e.id,e.title,e.starts_at,e.venue,e.city,'participation'::text kind
    from public.invitations i
    join public.events e on e.id=i.event_id
    where i.musician_id=v_uid and i.status='accepted'
     and e.producer_id<>v_uid and e.status<>'cancelled'
     and e.starts_at>=now()
    order by e.starts_at,e.id limit 6)

 ) s;
 -- Merge at most twelve candidate shows and return six sorted cards.
 select coalesce(jsonb_agg(item order by item->>'starts_at'),'[]'::jsonb)
 into v_upcoming from (
  select value item from jsonb_array_elements(v_upcoming)
  order by value->>'starts_at' limit 6
 ) recent;

 -- Feed is scoped to the user's existing private notifications,
 -- supplemented with actual booking requests that already belong to them.
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',a.id,'type',a.kind,'title',a.title,'summary',a.summary,
   'created_at',a.created_at,'read',a.read_flag,'href',a.href
 ) order by a.created_at desc,a.id),'[]'::jsonb)
 into v_activity
 from (
  select n.id::text id,n.event_code kind,n.title,n.summary,n.created_at,
    n.read_at is not null read_flag,
    case when n.source_type='account' then '/minha-conta'
      when n.source_type='conversation' or n.source_type='proposal' then '/conversas'
      when n.source_type='operations' then '/meus-shows'
      else '/meus-convites' end href
  from public.stage_internal_notifications n
  where n.recipient_id=v_uid
  union all
  select b.id::text,'booking_received'::text,
    'Novo pedido de contratação'::text,
    ('Uma solicitação chegou de '||left(b.contact_name,100))::text,
    b.created_at,(b.status<>'new'),
    '/meu-perfil-artistico/solicitacoes'::text
  from public.stage_artist_booking_requests b
  where b.artist_id=v_uid
  union all
  select i.id::text,'invite_accepted'::text,
    case when e.producer_id=v_uid then 'Convite aceito'::text
      else 'Participação confirmada'::text end,
    left(e.title,130)::text,
    coalesce(i.responded_at,i.created_at),true,
    case when e.producer_id=v_uid then '/convites'
      else '/meus-convites' end
  from public.invitations i join public.events e on e.id=i.event_id
  where i.status='accepted'
    and (i.musician_id=v_uid or e.producer_id=v_uid)
  union all
  select (v.target_id::text||':'||v.kind),'profile_verified'::text,
    'Perfil verificado'::text,
    case when v.kind='singer' then 'Seu perfil de cantor recebeu o selo oficial.'
      when v.kind='musician' then 'Seu portfólio recebeu o selo oficial.'
      else 'Seu perfil recebeu o selo oficial.' end::text,
    v.verified_at,true,'/minha-conta'::text
  from public.stage_admin_verifications v
  where v.target_id=v_uid
  union all
  select f.invitation_id::text,'financial_record_updated'::text,
    'Recebimento informado'::text,
    'Um valor recebido foi informado no financeiro deste show.'::text,
    f.updated_at,true,'/financeiro'::text
  from public.stage_show_participation_finance f
  join public.invitations i on i.id=f.invitation_id
  where i.musician_id=v_uid and f.received_amount>0
  union all
  select b.event_id::text,'financial_record_updated'::text,
    'Recebimento registrado'::text,
    'Um valor recebido foi registrado no financeiro deste evento.'::text,
    b.updated_at,true,'/financeiro'::text
  from public.stage_event_budget b
  join public.events e on e.id=b.event_id
  where e.producer_id=v_uid and b.received_amount>0

  order by created_at desc,id limit 8
 ) a;

 return jsonb_build_object('status','ok',
  'metrics',jsonb_build_object('shows_week',v_shows,
   'pending_invites',v_invites,'unread_conversations',v_conversations,
   'pending_contacts',v_contacts,'received_month',v_revenue),
  'upcoming',v_upcoming,'activity',v_activity,
  'updated_at',now());
end;
$$;
revoke all on function public.stage_workspace_overview() from public,anon,authenticated;
grant execute on function public.stage_workspace_overview() to authenticated;
commit;
notify pgrst,'reload schema';
