-- StageFlow | Venue onboarding policy: same owner predicate, cached per statement.
-- QA contract verified; never apply to production without comparing policies.
begin;
alter policy "Authenticated users can add venues" on public.venues
 with check ((select auth.uid())=submitted_by);
commit;
