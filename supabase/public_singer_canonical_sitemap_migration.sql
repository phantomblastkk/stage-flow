-- Canonical public singer sitemap: a published free singer page is discoverable
-- at /username, with or without a paid Pro snapshot. QA first.
-- Never returns private handles, contact records or billing entitlements.
create or replace function public.stage_public_singer_sitemap()
returns table(username text, updated_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select p.username::text,p.updated_at
 from public.profiles p
 where p.is_singer=true
   and p.is_public=true
   and p.username is not null
   and p.username ~ '^[a-z0-9-]{3,30}$'
 order by p.username asc
 limit 5000;
$$;
revoke all on function public.stage_public_singer_sitemap()
 from public,anon,authenticated;
grant execute on function public.stage_public_singer_sitemap()
 to anon,authenticated;
notify pgrst,'reload schema';
