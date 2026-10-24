-- Stage Flow | Preenchimento de proposta com dados de show próprio já cadastrado.
-- Não expõe eventos de outras contas nem exige marketplace lançado.
begin;
create or replace function public.stage_hiring_proposal_prefill(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_event jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required');end if;
 select jsonb_build_object(
  'title',e.title,'venue',e.venue,'city',e.city,'starts_at',e.starts_at
 ) into v_event
 from public.stage_hiring_threads t
 join public.events e on e.id=t.event_id and e.producer_id=t.requester_id
 where t.id=p_thread_id and t.requester_id=auth.uid() and e.status<>'cancelled';
 if v_event is null then return jsonb_build_object('status','not_linked');end if;
 return jsonb_build_object('status','ok','event',v_event);
end;
$$;
revoke all on function public.stage_hiring_proposal_prefill(uuid) from public,anon,authenticated;
grant execute on function public.stage_hiring_proposal_prefill(uuid) to authenticated;
commit;
notify pgrst,'reload schema';
