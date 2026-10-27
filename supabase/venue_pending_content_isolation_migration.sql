-- StageFlow QA: no calendar, gallery or media writes for an unapproved house.
-- Global admins keep separate rights to review the venue and edit its base record.
begin;
create or replace function public.stage_venue_can_manage(p_venue_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists(
   select 1 from public.venues v
   where v.id=p_venue_id
     and v.approval_status='approved'
     and v.active and v.is_official
     and (
       public.stage_venue_is_admin()
       or (v.is_partner and exists(
          select 1 from public.stage_venue_managers m
          where m.venue_id=v.id and m.profile_id=auth.uid()
       ))
     )
 );
$$;
revoke all on function public.stage_venue_can_manage(uuid)
 from public,anon,authenticated;
grant execute on function public.stage_venue_can_manage(uuid) to authenticated;

create or replace function public.stage_venue_media_can_upload(p_path text)
returns boolean language sql stable security definer set search_path=''
as $$
 select p_path is not null
  and p_path ~ '^[0-9a-f-]{36}/(logo|cover|gallery|flyer)/[0-9a-f-]{36}[.](jpg|png|webp)$'
  and exists(
   select 1 from public.venues v
   where v.id::text=split_part(p_path,'/',1)
     and v.approval_status='approved'
     and (
       (split_part(p_path,'/',2) in ('logo','cover')
        and public.stage_venue_is_admin())
       or (split_part(p_path,'/',2) in ('gallery','flyer')
        and public.stage_venue_can_manage(v.id))
     )
  );
$$;
revoke all on function public.stage_venue_media_can_upload(text)
 from public,anon,authenticated;
grant execute on function public.stage_venue_media_can_upload(text) to authenticated;
commit;
notify pgrst,'reload schema';
