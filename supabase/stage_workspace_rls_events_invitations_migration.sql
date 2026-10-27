-- StageFlow | RLS auth initplan optimization for current QA policy contracts.
-- Only wraps identical auth.uid() expressions in a scalar SELECT, allowing
-- PostgreSQL to evaluate them once per statement instead of per row.
-- No policy is added/removed and no role, table grant, or ownership changes.
-- Production policy definitions MUST be compared before applying this migration.
begin;

alter policy "Producers can view own events" on public.events
 using ((select auth.uid())=producer_id);
alter policy "Producers can create own events" on public.events
 with check (
  (select auth.uid())=producer_id
  and exists(select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.role='producer'::public.account_role)
 );
alter policy "Producers can update own events" on public.events
 using ((select auth.uid())=producer_id)
 with check ((select auth.uid())=producer_id);
alter policy "Producers can delete own events" on public.events
 using ((select auth.uid())=producer_id);

alter policy "Musicians can view own invitations" on public.invitations
 using (
  (select auth.uid())=musician_id
  or exists(select 1 from public.events e
   where e.id=invitations.event_id and e.producer_id=(select auth.uid()))
 );
alter policy "Producers can invite musicians to own events" on public.invitations
 with check (exists(select 1 from public.events e
  where e.id=invitations.event_id and e.producer_id=(select auth.uid())));
alter policy "Musicians can respond to own invitations" on public.invitations
 using ((select auth.uid())=musician_id)
 with check ((select auth.uid())=musician_id);

-- FK supporting indexes for the two-sided hiring flow; created only once.
create index if not exists stage_hiring_proposals_musician_fk_idx
 on public.stage_hiring_proposals(musician_id);
create index if not exists stage_hiring_proposals_requester_fk_idx
 on public.stage_hiring_proposals(requester_id);
create index if not exists stage_hiring_threads_event_fk_idx
 on public.stage_hiring_threads(event_id);

commit;
