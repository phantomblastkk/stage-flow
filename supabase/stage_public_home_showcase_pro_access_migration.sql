-- StageFlow | Public home showcase and safe Pro availability
-- Only public, consented artist/venue fields; never disclose subscription,
-- personal email, owner IDs, unpublished galleries or draft media.
begin;

create or replace function public.stage_public_verified_singers(p_limit integer default 8)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
begin
 if p_limit is null or p_limit not between 1 and 12 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'name',x.display_name,'username',x.username,
  'headline',x.artist_headline,'avatar_path',x.artist_avatar_path
 ) order by x.verified_at desc,x.username),'[]'::jsonb)
 into v_items
 from (
  select p.display_name,p.username,p.artist_headline,p.artist_avatar_path,v.verified_at
  from public.stage_admin_verifications v
  join public.profiles p on p.id=v.target_id
  where v.kind='singer' and p.is_singer=true and p.is_artist=true
    and p.is_public=true and p.username is not null
    and p.username ~ '^[a-z0-9-]{3,30}$'
  order by v.verified_at desc,p.username
  limit p_limit
 ) x;
 return v_items;
end;
$$;
revoke all on function public.stage_public_verified_singers(integer) from public,anon,authenticated;
grant execute on function public.stage_public_verified_singers(integer) to anon,authenticated;

create or replace function public.stage_public_partner_venues(p_limit integer default 12)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
begin
 if p_limit is null or p_limit not between 1 and 16 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',x.id,'name',x.name,'slug',x.slug,'logo_path',x.logo_path
 ) order by x.name,x.id),'[]'::jsonb)
 into v_items
 from (
  select v.id,v.name,v.slug,v.logo_path
  from public.venues v
  where v.active=true and v.is_official=true and v.is_partner=true
    and v.approval_status='approved'
    and v.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  order by v.name,v.id
  limit p_limit
 ) x;
 return v_items;
end;
$$;
revoke all on function public.stage_public_partner_venues(integer) from public,anon,authenticated;
grant execute on function public.stage_public_partner_venues(integer) to anon,authenticated;

-- Lightweight public yes/no for public singer profiles only; never exposes
-- how Pro was acquired or whether unpublished media exists.
create or replace function public.stage_public_singer_pro_access(p_username text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
  select 1 from public.profiles p
  where p.username=lower(btrim(coalesce(p_username,'')))
    and p.is_public=true and p.is_singer=true and p.is_artist=true
    and public.stage_pro_site_is_entitled(p.id)
 );
$$;
revoke all on function public.stage_public_singer_pro_access(text) from public,anon,authenticated;
grant execute on function public.stage_public_singer_pro_access(text) to anon,authenticated;
commit;
notify pgrst, 'reload schema';
