-- Stage Flow | Unified published artistic identity. No data migration; no private drafts exposed.
begin;
create or replace function public.stage_public_artistic_musician(
 p_username text default null, p_slug text default null
) returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
   'username',case when p.is_public then p.username else null end,
   'is_singer',coalesce(p.is_singer,false) and p.is_public,
   'musician',public.stage_public_musician_portfolio(m.slug)
 )
 from public.musician_portfolios m
 join public.profiles p on p.id=m.profile_id
 where m.is_published=true and p.is_artist=true
  and ((p_slug is not null and m.slug=lower(p_slug))
    or (p_username is not null and p.username=lower(p_username)))
  and coalesce(length(p_slug),length(p_username),0) between 3 and 30
 limit 1;
$$;
revoke all on function public.stage_public_artistic_musician(text,text) from public;
grant execute on function public.stage_public_artistic_musician(text,text) to anon,authenticated;

create or replace function public.stage_public_marketplace_identity(p_ids uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
 select case when p_ids is null or cardinality(p_ids)>48 then '{}'::jsonb
 else coalesce(jsonb_object_agg(p.id::text,jsonb_build_object(
   'is_singer',coalesce(p.is_singer,false) and p.is_public,
   'avatar_path',case when p.is_public and p.is_singer then p.artist_avatar_path else null end
 )),'{}'::jsonb) end
 from public.profiles p
 join public.musician_portfolios m on m.profile_id=p.id and m.is_published=true
 join public.stage_marketplace_musician_settings s on s.musician_id=p.id and s.listed=true
 where p.id=any(p_ids) and p.is_artist=true
  and not exists(select 1 from public.stage_marketplace_hidden_musicians h where h.musician_id=p.id);
$$;
revoke all on function public.stage_public_marketplace_identity(uuid[]) from public;
grant execute on function public.stage_public_marketplace_identity(uuid[]) to anon,authenticated;
commit;
