-- StageFlow QA: let a venue submitter open its public page after admin approval.
-- Only the owner's submissions are returned. Pending/rejected URLs stay null.
begin;
create or replace function public.stage_venue_my_submissions()
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'name',v.name,'city',c.name,'state',c.state_code,
   'approval_status',v.approval_status,'submitted_at',v.created_at,
   'slug',case when v.approval_status='approved'
       and v.active and v.is_official then v.slug else null end
 ) order by v.created_at desc),'[]'::jsonb)
 from (select * from public.venues
       where submitted_by=auth.uid()
       order by created_at desc limit 50) v
 left join public.cities c on c.id=v.city_id
 where auth.uid() is not null;
$$;
revoke all on function public.stage_venue_my_submissions()
 from public,anon,authenticated;
grant execute on function public.stage_venue_my_submissions()
 to authenticated;
commit;
notify pgrst,'reload schema';
