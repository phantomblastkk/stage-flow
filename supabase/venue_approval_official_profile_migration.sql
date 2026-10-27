-- StageFlow QA: approving a suggested venue activates its official profile.
-- Only global admins may publish. Pending/rejected entries stay unlisted.
-- Venue calendar, gallery and flyers remain editable only by approved managers/admins.
begin;
create or replace function public.stage_venue_admin_review(
  p_venue_id uuid,p_decision text
) returns text language plpgsql security definer set search_path=''
as $$
declare
  v_status text;
  v_name text;
  v_base text;
  v_slug text;
begin
  if not public.stage_venue_is_admin() then return 'forbidden'; end if;
  if p_venue_id is null or p_decision not in ('approved','rejected')
  then return 'invalid'; end if;

  select v.approval_status,v.name into v_status,v_name
  from public.venues v where v.id=p_venue_id for update;
  if not found then return 'not_found';end if;
  if v_status<>'pending' then return 'already_reviewed';end if;

  if p_decision='approved' then
    -- Human-readable prefix + FULL UUID without hyphens is collision-free;
    -- no user can reserve a URL or publish imagery before approval.
    v_base:=pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.translate(
       v_name,
       'áàâãäåéèêëíìîïóòôõöúùûüçñ',
       'aaaaaaeeeeiiiiooooouuuucn'
    )),'[^a-z0-9]+','-','g');
    v_slug:=pg_catalog.coalesce(
      pg_catalog.nullif(pg_catalog.btrim(pg_catalog.left(v_base,15),'-'),''),
      'casa'
    )||'-'||pg_catalog.replace(p_venue_id::text,'-','');

    update public.venues set
      approval_status='approved',reviewed_by=auth.uid(),reviewed_at=now(),
      active=true,is_official=true,is_partner=false,
      slug=v_slug,logo_path=null,cover_path=null,updated_at=now()
    where id=p_venue_id;
    -- Existing public venue RPCs and URL render only active official venues.
    return 'approved';
  end if;

  update public.venues set
    approval_status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),
    active=false,is_official=false,is_partner=false,
    slug=null,logo_path=null,cover_path=null,updated_at=now()
  where id=p_venue_id;
  return 'rejected';
exception
  when unique_violation then return 'duplicate_slug';
end;
$$;
revoke all on function public.stage_venue_admin_review(uuid,text)
  from public,anon,authenticated;
grant execute on function public.stage_venue_admin_review(uuid,text)
  to authenticated;
commit;
notify pgrst,'reload schema';
