-- StageFlow | safe RLS initplan optimization, tested against existing QA policies.
-- Expression only changes auth.uid() evaluation frequency; ownership remains identical.
begin;
alter policy "Users can view own profile" on public.profiles
 using ((select auth.uid())=id);
alter policy "Users can create own profile" on public.profiles
 with check ((select auth.uid())=id);
alter policy "Users can update own profile" on public.profiles
 using ((select auth.uid())=id)
 with check ((select auth.uid())=id);

alter policy "Users can view own notifications" on public.notifications
 using ((select auth.uid())=profile_id);
alter policy "Users can mark own notifications read" on public.notifications
 using ((select auth.uid())=profile_id)
 with check ((select auth.uid())=profile_id);

-- The PUBLIC active-cities policy already grants exactly the same SELECT.
-- Removing the duplicate authenticated policy preserves effective visibility.
drop policy if exists "Users can view active cities" on public.cities;

-- Foreign-key supporting indexes used for user cleanup and admin auditing.
create index if not exists stage_hiring_messages_sender_idx
 on public.stage_hiring_messages(sender_id);
create index if not exists stage_admin_verifications_verified_by_idx
 on public.stage_admin_verifications(verified_by);
commit;
