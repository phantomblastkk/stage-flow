-- StageFlow: venue suggestions require explicit administrator review before publication.
-- Apply only to Supabase QA before deploying the updated UI. No existing events are created.
begin;

alter table public.venues
  add column if not exists approval_status text not null default 'pending',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- Existing administrator-owned/official venues remain accessible.
update public.venues
set approval_status='approved',reviewed_at=now()
where submitted_by is null or is_official or is_partner or slug is not null;
-- Old collaborative contributions did not receive explicit approval.
update public.venues
set approval_status='pending',active=false,is_official=false,is_partner=false,
    slug=null,logo_path=null,cover_path=null
where approval_status<>'approved';

alter table public.venues
  add constraint stage_venue_approval_status_valid
  check (approval_status in ('pending','approved','rejected'));
alter table public.venues
  add constraint stage_venue_unapproved_not_public
  check (approval_status='approved' or (
    active=false and is_official=false and is_partner=false
    and slug is null and logo_path is null and cover_path is null
  ));
create index if not exists stage_venues_review_queue_idx
  on public.venues(approval_status,created_at desc);

-- Non-admins must not insert a ready/published house via PostgREST.
-- Admin-created records are considered approved at the time the admin submits.
create or replace function public.stage_venue_enforce_approval()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='INSERT' then
    if public.stage_venue_is_admin() then
      new.approval_status:='approved';
      new.reviewed_by:=auth.uid();
      new.reviewed_at:=now();
    else
      new.approval_status:='pending';
      new.reviewed_by:=null;
      new.reviewed_at:=null;
      new.active:=false;
      new.is_official:=false;
      new.is_partner:=false;
      new.slug:=null;
      new.logo_path:=null;
      new.cover_path:=null;
    end if;
  end if;
  if new.approval_status<>'approved' then
    new.active:=false;
    new.is_official:=false;
    new.is_partner:=false;
    new.slug:=null;
    new.logo_path:=null;
    new.cover_path:=null;
  end if;
  return new;
end;
$$;
revoke all on function public.stage_venue_enforce_approval() from public,anon,authenticated;
drop trigger if exists stage_venue_enforce_approval on public.venues;
create trigger stage_venue_enforce_approval
before insert or update on public.venues
for each row execute function public.stage_venue_enforce_approval();

-- For contribution submissions use a narrow, identity-checked RPC instead of
-- direct INSERT grants. The resulting row is private until reviewed by an admin.
revoke insert on public.venues from authenticated;
revoke insert (name,address,city_id,submitted_by) on public.venues from authenticated;
create or replace function public.stage_venue_submit(
 p_name text,p_city_id bigint,p_address text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_name text:=btrim(coalesce(p_name,''));
 v_address text:=nullif(btrim(coalesce(p_address,'')),'');
 v_id uuid;
begin
 if auth.uid() is null then return jsonb_build_object('status','login_required'); end if;
 if char_length(v_name) not between 2 and 120 or v_name ~ '[[:cntrl:]]'
   or char_length(coalesce(v_address,''))>240 or p_city_id is null
   or not exists(select 1 from public.cities where id=p_city_id and active)
 then return jsonb_build_object('status','invalid');end if;

 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(lower(v_name)||':'||p_city_id::text,661013)
 );
 if exists(select 1 from public.venues
   where city_id=p_city_id and lower(btrim(name))=lower(v_name)) then
   return jsonb_build_object('status','duplicate');end if;
 if (select count(*) from public.venues
     where submitted_by=auth.uid() and created_at>now()-interval '1 day')>=20
 then return jsonb_build_object('status','limit_reached');end if;

 insert into public.venues(name,city_id,address,submitted_by,active,approval_status)
 values(v_name,p_city_id,v_address,auth.uid(),false,'pending')
 returning id into v_id;
 return jsonb_build_object('status','pending','id',v_id);
exception when unique_violation then return jsonb_build_object('status','duplicate');
end;
$$;
revoke all on function public.stage_venue_submit(text,bigint,text) from public,anon,authenticated;
grant execute on function public.stage_venue_submit(text,bigint,text) to authenticated;

-- Contributors may review the status of their own submissions, never others'.
create or replace function public.stage_venue_my_submissions()
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'name',v.name,'city',c.name,'state',c.state_code,
   'approval_status',v.approval_status,'submitted_at',v.created_at
 ) order by v.created_at desc),'[]'::jsonb)
 from (select * from public.venues
       where submitted_by=auth.uid()
       order by created_at desc limit 50) v
 left join public.cities c on c.id=v.city_id
 where auth.uid() is not null;
$$;
revoke all on function public.stage_venue_my_submissions() from public,anon,authenticated;
grant execute on function public.stage_venue_my_submissions() to authenticated;

-- Only global StageFlow admins can move a submitted house out of review.
create or replace function public.stage_venue_admin_review(
 p_venue_id uuid,p_decision text
) returns text language plpgsql security definer set search_path=''
as $$
declare v_status text;
begin
 if not public.stage_venue_is_admin() then return 'forbidden';end if;
 if p_venue_id is null or p_decision not in ('approved','rejected')
 then return 'invalid';end if;
 select approval_status into v_status from public.venues
 where id=p_venue_id for update;
 if not found then return 'not_found';end if;
 if v_status<>'pending' then return 'already_reviewed';end if;
 update public.venues set
   approval_status=p_decision, reviewed_by=auth.uid(),reviewed_at=now(),
   active=(p_decision='approved'),is_official=false,is_partner=false,
   slug=null,logo_path=null,cover_path=null,updated_at=now()
 where id=p_venue_id;
 return p_decision;
end;
$$;
revoke all on function public.stage_venue_admin_review(uuid,text) from public,anon,authenticated;
grant execute on function public.stage_venue_admin_review(uuid,text) to authenticated;

-- Extend the admin listing to show private pending and rejected submissions.
create or replace function public.stage_venue_admin_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
begin
 if not public.stage_venue_is_admin() then
   return jsonb_build_object('status','forbidden','items','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'name',v.name,'city_id',v.city_id,'city_name',c.name,
   'state_code',c.state_code,'address',v.address,'active',v.active,
   'slug',v.slug,'description',v.description,
   'instagram_url',v.instagram_url,'whatsapp',v.whatsapp,
   'logo_path',v.logo_path,'cover_path',v.cover_path,
   'is_official',v.is_official,'is_partner',v.is_partner,
   'submitted_by',v.submitted_by,'created_at',v.created_at,
   'approval_status',v.approval_status,'reviewed_at',v.reviewed_at
 ) order by (v.approval_status='pending') desc,v.created_at desc,v.id),'[]'::jsonb)
 into v_items
 from public.venues v left join public.cities c on c.id=v.city_id;
 return jsonb_build_object('status','ok','items',v_items);
end;
$$;
revoke all on function public.stage_venue_admin_list() from public,anon,authenticated;
grant execute on function public.stage_venue_admin_list() to authenticated;

-- The public profile/calendar/flyer RPCs already require active AND official.
-- The DB CHECK prevents that combination for any pending/rejected venue.
-- No grants for publishing or changing approval_status are given to users.
commit;
notify pgrst,'reload schema';
