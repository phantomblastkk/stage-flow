-- Stage Flow - Gestores das casas parceiras.
-- Aplicar depois de venue_admin_migration.sql e venue_calendar_gallery_suggestions_migration.sql.
-- Somente Stage Flow concede acesso. Nenhuma conta e promovida automaticamente.
begin;
create table if not exists public.stage_venue_managers (
  venue_id uuid not null references public.venues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (venue_id,profile_id)
);
create index if not exists stage_venue_managers_profile_idx on public.stage_venue_managers(profile_id,venue_id);
alter table public.stage_venue_managers enable row level security;
revoke all on public.stage_venue_managers from public,anon,authenticated;

create or replace function public.stage_venue_can_manage(p_venue_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null
    and (public.stage_venue_is_admin() or exists (
      select 1 from public.stage_venue_managers m
      join public.venues v on v.id=m.venue_id
      where m.profile_id=auth.uid() and m.venue_id=p_venue_id
        and v.active and v.is_official and v.is_partner
    ));
$$;
revoke all on function public.stage_venue_can_manage(uuid) from public,anon,authenticated;
grant execute on function public.stage_venue_can_manage(uuid) to authenticated;

create or replace function public.stage_venue_partner_access()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_list jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('status','unauthenticated','items','[]'::jsonb);end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,'name',v.name,'slug',v.slug,'logo_path',v.logo_path,
    'description',v.description,'city',c.name,'state',c.state_code
  ) order by v.name),'[]'::jsonb)
  into v_list
  from public.stage_venue_managers m
  join public.venues v on v.id=m.venue_id
  left join public.cities c on c.id=v.city_id
  where m.profile_id=auth.uid()
    and v.active and v.is_official and v.is_partner;
  return jsonb_build_object('status','ok','items',v_list);
end;
$$;
revoke all on function public.stage_venue_partner_access() from public,anon,authenticated;
grant execute on function public.stage_venue_partner_access() to authenticated;

create or replace function public.stage_venue_admin_managers(p_venue_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_list jsonb;
begin
  if not public.stage_venue_is_admin() then
    return jsonb_build_object('status','forbidden','items','[]'::jsonb);end if;
  if not exists(select 1 from public.venues where id=p_venue_id)
  then return jsonb_build_object('status','not_found','items','[]'::jsonb);end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile_id',m.profile_id,'display_name',p.display_name,
    'email',u.email,'granted_at',m.granted_at
  ) order by m.granted_at desc),'[]'::jsonb)
  into v_list from public.stage_venue_managers m
  join public.profiles p on p.id=m.profile_id
  join auth.users u on u.id=m.profile_id
  where m.venue_id=p_venue_id;
  return jsonb_build_object('status','ok','items',v_list);
end;
$$;
revoke all on function public.stage_venue_admin_managers(uuid) from public,anon,authenticated;
grant execute on function public.stage_venue_admin_managers(uuid) to authenticated;

create or replace function public.stage_venue_admin_set_manager(
  p_venue_id uuid,p_email text,p_enabled boolean
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_profile uuid;v_email text:=lower(btrim(coalesce(p_email,'')));
begin
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  if p_venue_id is null or p_enabled is null
    or char_length(v_email)<5 or char_length(v_email)>254
    or v_email not like '%@%' then return 'invalid';end if;
  if not exists(select 1 from public.venues where id=p_venue_id) then return 'not_found';end if;
  if p_enabled and not exists(select 1 from public.venues
    where id=p_venue_id and active and is_official and is_partner)
  then return 'venue_not_partner';end if;
  select u.id into v_profile from auth.users u
    join public.profiles p on p.id=u.id where lower(u.email)=v_email;
  if v_profile is null then return 'account_not_found';end if;
  if p_enabled then
    insert into public.stage_venue_managers(venue_id,profile_id,granted_by)
    values(p_venue_id,v_profile,auth.uid()) on conflict(venue_id,profile_id) do nothing;
    return 'granted';
  else
    delete from public.stage_venue_managers
      where venue_id=p_venue_id and profile_id=v_profile;
    return 'revoked';
  end if;
end;
$$;
revoke all on function public.stage_venue_admin_set_manager(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.stage_venue_admin_set_manager(uuid,text,boolean) to authenticated;

-- Logo/capa apenas admin geral. Flyers e galeria: manager da propria casa.
create or replace function public.stage_venue_media_can_upload(p_path text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_path is not null
    and p_path ~ '^[0-9a-f-]{36}/(logo|cover|gallery|flyer)/[0-9a-f-]{36}[.](jpg|png|webp)$'
    and exists(select 1 from public.venues v where v.id::text=split_part(p_path,'/',1))
    and (public.stage_venue_is_admin() or (
      split_part(p_path,'/',2) in ('gallery','flyer')
      and public.stage_venue_can_manage(split_part(p_path,'/',1)::uuid)
    ));
$$;
revoke all on function public.stage_venue_media_can_upload(text) from public,anon,authenticated;
grant execute on function public.stage_venue_media_can_upload(text) to authenticated;

create or replace function public.stage_venue_calendar_admin_list(p_venue_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_events jsonb;v_gallery jsonb;v_suggestions jsonb;
begin
  if not public.stage_venue_can_manage(p_venue_id) then
    return jsonb_build_object('status','forbidden');end if;
  if not exists(select 1 from public.venues where id=p_venue_id) then
    return jsonb_build_object('status','not_found');end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'title',e.title,'description',e.description,
    'starts_at',e.starts_at,'ends_at',e.ends_at,'status',e.status,
    'flyer_path',e.flyer_path
  ) order by e.starts_at desc,e.id),'[]'::jsonb)
  into v_events from (
    select * from public.stage_venue_calendar_events
    where venue_id=p_venue_id order by starts_at desc limit 750
  ) e;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'media_path',g.media_path,'caption',g.caption,
    'sort_order',g.sort_order
  ) order by g.sort_order,g.created_at),'[]'::jsonb)
  into v_gallery from public.stage_venue_gallery g where g.venue_id=p_venue_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'artist_name',s.artist_name,'visitor_name',s.visitor_name,
    'message',s.message,'created_at',s.created_at
  ) order by s.created_at desc),'[]'::jsonb)
  into v_suggestions from (
    select * from public.stage_venue_artist_suggestions
    where venue_id=p_venue_id order by created_at desc limit 100
  ) s;
  return jsonb_build_object('status','ok','events',v_events,
    'gallery',v_gallery,'suggestions',v_suggestions);
end;
$$;
revoke all on function public.stage_venue_calendar_admin_list(uuid) from public,anon,authenticated;
grant execute on function public.stage_venue_calendar_admin_list(uuid) to authenticated;

create or replace function public.stage_venue_calendar_admin_save(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_venue uuid;v_title text;v_desc text;
  v_start timestamptz;v_end timestamptz;v_status text;v_old_venue uuid;
begin
  if p_event is null or jsonb_typeof(p_event)<>'object' then
    return jsonb_build_object('status','invalid');end if;
  v_id:=nullif(p_event->>'id','')::uuid;
  v_venue:=nullif(p_event->>'venue_id','')::uuid;
  if not public.stage_venue_can_manage(v_venue) then return jsonb_build_object('status','forbidden');end if;
  v_title:=btrim(coalesce(p_event->>'title',''));
  v_desc:=btrim(coalesce(p_event->>'description',''));
  v_start:=nullif(p_event->>'starts_at','')::timestamptz;
  v_end:=nullif(p_event->>'ends_at','')::timestamptz;
  v_status:=coalesce(p_event->>'status','draft');
  if v_venue is null or not exists(select 1 from public.venues where id=v_venue)
    or char_length(v_title) not between 2 and 120
    or char_length(v_desc)>1200 or v_start is null
    or v_start < '2000-01-01'::timestamptz or v_start > '2100-01-01'::timestamptz
    or (v_end is not null and v_end<v_start)
    or v_status not in ('draft','published','cancelled')
  then return jsonb_build_object('status','invalid');end if;
  if v_id is null then
    insert into public.stage_venue_calendar_events
      (venue_id,title,description,starts_at,ends_at,status)
    values (v_venue,v_title,v_desc,v_start,v_end,v_status) returning id into v_id;
  else
    select venue_id into v_old_venue from public.stage_venue_calendar_events
      where id=v_id and venue_id=v_venue for update;
    if not found then return jsonb_build_object('status','not_found');end if;
    if v_old_venue<>v_venue then return jsonb_build_object('status','invalid_venue');end if;
    update public.stage_venue_calendar_events
      set title=v_title,description=v_desc,starts_at=v_start,ends_at=v_end,
      status=v_status,updated_at=now()
    where id=v_id;
  end if;
  return jsonb_build_object('status','ok','id',v_id);
exception when invalid_text_representation or datetime_field_overflow or
  invalid_datetime_format or numeric_value_out_of_range
  then return jsonb_build_object('status','invalid');
end;
$$;
revoke all on function public.stage_venue_calendar_admin_save(jsonb) from public,anon,authenticated;
grant execute on function public.stage_venue_calendar_admin_save(jsonb) to authenticated;

create or replace function public.stage_venue_calendar_admin_flyer(p_id uuid,p_path text)
returns text language plpgsql security definer set search_path=''
as $$
declare v_venue uuid;v_path text:=nullif(btrim(coalesce(p_path,'')),'');
begin
  select venue_id into v_venue from public.stage_venue_calendar_events where id=p_id for update;
  if not found then return 'not_found';end if;
  if not public.stage_venue_can_manage(v_venue) then return 'forbidden';end if;
  if v_path is not null and (
    v_path !~ '^[0-9a-f-]{36}/flyer/[0-9a-f-]{36}[.](jpg|png|webp)$'
    or split_part(v_path,'/',1)<>v_venue::text
    or not exists(select 1 from storage.objects o
      where o.bucket_id='stage-venue-media' and o.name=v_path)
  ) then return 'invalid_media';end if;
  update public.stage_venue_calendar_events
    set flyer_path=v_path,updated_at=now() where id=p_id;
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_calendar_admin_flyer(uuid,text) from public,anon,authenticated;
grant execute on function public.stage_venue_calendar_admin_flyer(uuid,text) to authenticated;

create or replace function public.stage_venue_calendar_admin_delete(p_id uuid)
returns text language plpgsql security definer set search_path=''
as $
declare v_venue uuid;
begin
  select venue_id into v_venue from public.stage_venue_calendar_events where id=p_id for update;
  if not found then return 'not_found';end if;
  if not public.stage_venue_can_manage(v_venue) then return 'forbidden';end if;
  delete from public.stage_venue_calendar_events where id=p_id;
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_calendar_admin_delete(uuid) from public,anon,authenticated;
grant execute on function public.stage_venue_calendar_admin_delete(uuid) to authenticated;

create or replace function public.stage_venue_gallery_admin_add(
  p_venue_id uuid,p_path text,p_caption text default ''
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_caption text:=btrim(coalesce(p_caption,''));
begin
  if not public.stage_venue_can_manage(p_venue_id) then return 'forbidden';end if;
  if p_venue_id is null or not exists(select 1 from public.venues where id=p_venue_id)
    or p_path is null
    or p_path !~ '^[0-9a-f-]{36}/gallery/[0-9a-f-]{36}[.](jpg|png|webp)$'
    or split_part(p_path,'/',1)<>p_venue_id::text
    or char_length(v_caption)>180
    or not exists(select 1 from storage.objects
      where bucket_id='stage-venue-media' and name=p_path)
  then return 'invalid';end if;
  -- Evita adicao em concorrencia alem da cota.
  perform 1 from public.venues where id=p_venue_id for update;
  if (select count(*) from public.stage_venue_gallery where venue_id=p_venue_id)>=36
    then return 'limit_reached';end if;
  insert into public.stage_venue_gallery(venue_id,media_path,caption)
    values(p_venue_id,p_path,v_caption);
  return 'ok';
exception when unique_violation then return 'duplicate';
end;
$$;
revoke all on function public.stage_venue_gallery_admin_add(uuid,text,text) from public,anon,authenticated;
grant execute on function public.stage_venue_gallery_admin_add(uuid,text,text) to authenticated;

create or replace function public.stage_venue_gallery_admin_remove(p_id uuid)
returns text language plpgsql security definer set search_path=''
as $
declare v_venue uuid;
begin
  select venue_id into v_venue from public.stage_venue_gallery where id=p_id for update;
  if not found then return 'not_found';end if;
  if not public.stage_venue_can_manage(v_venue) then return 'forbidden';end if;
  delete from public.stage_venue_gallery where id=p_id;
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_gallery_admin_remove(uuid) from public,anon,authenticated;
grant execute on function public.stage_venue_gallery_admin_remove(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
