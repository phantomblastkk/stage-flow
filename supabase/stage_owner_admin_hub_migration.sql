
-- StageFlow | Central privada de administração geral
-- DEPENDÊNCIAS: profiles, venues, musician_portfolios e migrations de aprovação de casas.
-- Não concede privilégios automaticamente. Vincule a conta proprietária explicitamente
-- pelo SQL Editor usando auth.users.id (ver docs/central-admin-privada.md).
begin;

create table if not exists public.stage_owner_admins (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 singleton smallint not null default 1 unique check(singleton=1),
 granted_at timestamptz not null default now()
);
alter table public.stage_owner_admins enable row level security;
revoke all on table public.stage_owner_admins from PUBLIC,anon,authenticated;

create table if not exists public.stage_admin_verifications (
 kind text not null check(kind in ('singer','musician','venue')),
 target_id uuid not null,
 verified_at timestamptz not null default now(),
 verified_by uuid not null references public.profiles(id),
 primary key(kind,target_id)
);
create index if not exists stage_admin_verifications_target on public.stage_admin_verifications(target_id);
alter table public.stage_admin_verifications enable row level security;
revoke all on table public.stage_admin_verifications from PUBLIC,anon,authenticated;

create table if not exists public.stage_owner_admin_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null references public.profiles(id),
 action text not null check(action in ('verification_granted','verification_revoked','venue_approved','venue_rejected')),
 kind text not null check(kind in ('singer','musician','venue')),
 target_id uuid not null,
 happened_at timestamptz not null default now()
);
create index if not exists stage_owner_admin_audit_recent on public.stage_owner_admin_audit(happened_at desc,id desc);
alter table public.stage_owner_admin_audit enable row level security;
revoke all on table public.stage_owner_admin_audit from PUBLIC,anon,authenticated;

create or replace function public.stage_owner_admin_status()
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
   and exists (select 1 from public.stage_owner_admins o where o.profile_id=auth.uid());
$$;
revoke all on function public.stage_owner_admin_status() from PUBLIC,anon,authenticated;
grant execute on function public.stage_owner_admin_status() to authenticated;

create or replace function public.stage_owner_admin_metrics()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.stage_owner_admin_status() then
   return jsonb_build_object('status','forbidden');
 end if;
 return jsonb_build_object(
  'status','ok',
  'users_total',(select count(*) from auth.users),
  'users_7d',(select count(*) from auth.users where created_at >= now()-interval '7 days'),
  'users_30d',(select count(*) from auth.users where created_at >= now()-interval '30 days'),
  'singers',(select count(*) from public.profiles where is_singer=true),
  'musicians',(select count(*) from public.profiles where is_musician=true),
  'hybrids',(select count(*) from public.profiles where is_singer=true and is_musician=true),
  'producers',(select count(*) from public.profiles where is_producer=true),
  'venues_total',(select count(*) from public.venues),
  'venues_pending',(select count(*) from public.venues where approval_status='pending'),
  'venues_approved',(select count(*) from public.venues where approval_status='approved'),
  'venues_rejected',(select count(*) from public.venues where approval_status='rejected'),
  'verified_profiles',(select count(*) from public.stage_admin_verifications where kind in ('singer','musician')),
  'verified_venues',(select count(*) from public.stage_admin_verifications where kind='venue')
 );
end;
$$;
revoke all on function public.stage_owner_admin_metrics() from PUBLIC,anon,authenticated;
grant execute on function public.stage_owner_admin_metrics() to authenticated;

-- Paginacao e ordenacao estritamente permitidas, sem SQL dinamico.
-- Somente campos necessarios para gerir contas sao retornados ao proprietario.
create or replace function public.stage_owner_admin_users(
 p_order text default 'oldest',p_search text default '',p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb; v_total bigint; v_search text;
begin
 if not public.stage_owner_admin_status() then
   return jsonb_build_object('status','forbidden','items','[]'::jsonb);
 end if;
 if p_order not in ('oldest','newest') or p_page is null or p_page<0 or p_page>10000
    or length(coalesce(p_search,''))>80 then
   return jsonb_build_object('status','invalid','items','[]'::jsonb);
 end if;
 v_search:=btrim(coalesce(p_search,''));
 select count(*) into v_total from auth.users u
 left join public.profiles p on p.id=u.id
 where v_search='' or coalesce(p.display_name,'') ilike '%'||v_search||'%'
    or coalesce(p.username,'') ilike '%'||v_search||'%'
    or coalesce(u.email,'') ilike '%'||v_search||'%';
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',x.id,'name',x.name,'email',x.email,'username',x.username,
   'created_at',x.created_at,'is_singer',x.is_singer,'is_musician',x.is_musician,
   'is_producer',x.is_producer,'is_public',x.is_public,
   'plan_code',x.plan_code,'singer_verified',x.singer_verified,
   'musician_verified',x.musician_verified
 ) order by x.rn),'[]'::jsonb) into v_items
 from (
   select row_number() over (
     order by
      case when p_order='oldest' then u.created_at end asc nulls last,
      case when p_order='newest' then u.created_at end desc nulls last,
      u.id
   ) as rn,
   u.id,coalesce(p.display_name,'Sem nome') as name,u.email,
   p.username,u.created_at,
   coalesce(p.is_singer,false) as is_singer,
   coalesce(p.is_musician,false) as is_musician,
   coalesce(p.is_producer,false) as is_producer,
   coalesce(p.is_public,false) as is_public,
   coalesce(p.plan_code,'free') as plan_code,
   exists(select 1 from public.stage_admin_verifications v
     where v.kind='singer' and v.target_id=u.id) as singer_verified,
   exists(select 1 from public.stage_admin_verifications v
     where v.kind='musician' and v.target_id=u.id) as musician_verified
   from auth.users u left join public.profiles p on p.id=u.id
   where v_search='' or coalesce(p.display_name,'') ilike '%'||v_search||'%'
      or coalesce(p.username,'') ilike '%'||v_search||'%'
      or coalesce(u.email,'') ilike '%'||v_search||'%'
   order by
      case when p_order='oldest' then u.created_at end asc nulls last,
      case when p_order='newest' then u.created_at end desc nulls last,
      u.id
   limit 30 offset p_page*30
 ) x;
 return jsonb_build_object('status','ok','items',v_items,'total',v_total,'page',p_page,'page_size',30);
end;
$$;
revoke all on function public.stage_owner_admin_users(text,text,integer) from PUBLIC,anon,authenticated;
grant execute on function public.stage_owner_admin_users(text,text,integer) to authenticated;

create or replace function public.stage_owner_admin_venues(
 p_status text default 'all',p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;v_total bigint;
begin
 if not public.stage_owner_admin_status() then
   return jsonb_build_object('status','forbidden','items','[]'::jsonb);
 end if;
 if p_status not in ('all','pending','approved','rejected')
    or p_page is null or p_page<0 or p_page>10000 then
   return jsonb_build_object('status','invalid','items','[]'::jsonb);
 end if;
 select count(*) into v_total from public.venues v
 where p_status='all' or v.approval_status=p_status;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',x.id,'name',x.name,'city',x.city,'state',x.state,
   'approval_status',x.approval_status,'active',x.active,
   'is_official',x.is_official,'is_partner',x.is_partner,'slug',x.slug,
   'created_at',x.created_at,'submitted_by_name',x.submitted_by_name,
   'submitted_by_email',x.submitted_by_email,'verified',x.verified
 ) order by x.rn),'[]'::jsonb) into v_items
 from(
 select row_number() over(order by (v.approval_status='pending') desc,v.created_at desc,v.id) as rn,
   v.id,v.name,c.name as city,c.state_code as state,v.approval_status,
   v.active,v.is_official,v.is_partner,v.slug,v.created_at,
   p.display_name as submitted_by_name,au.email as submitted_by_email,
   exists(select 1 from public.stage_admin_verifications f
    where f.kind='venue' and f.target_id=v.id) as verified
 from public.venues v left join public.cities c on c.id=v.city_id
 left join public.profiles p on p.id=v.submitted_by
 left join auth.users au on au.id=v.submitted_by
 where p_status='all' or v.approval_status=p_status
 order by (v.approval_status='pending') desc,v.created_at desc,v.id
 limit 30 offset p_page*30
 ) x;
 return jsonb_build_object('status','ok','items',v_items,'total',v_total,'page',p_page,'page_size',30);
end;
$$;
revoke all on function public.stage_owner_admin_venues(text,integer) from PUBLIC,anon,authenticated;
grant execute on function public.stage_owner_admin_venues(text,integer) to authenticated;

create or replace function public.stage_owner_admin_set_verified(
 p_kind text,p_target_id uuid,p_verified boolean
) returns text language plpgsql security definer set search_path=''
as $$
begin
 if not public.stage_owner_admin_status() then return 'forbidden';end if;
 if p_kind not in ('singer','musician','venue') or p_target_id is null
    or p_verified is null then return 'invalid';end if;
 if p_kind='singer' and not exists(
   select 1 from public.profiles where id=p_target_id and is_singer=true
 ) then return 'not_found';end if;
 if p_kind='musician' and not exists(
   select 1 from public.profiles where id=p_target_id and is_musician=true
 ) then return 'not_found';end if;
 if p_kind='venue' and not exists(
   select 1 from public.venues where id=p_target_id and active=true
    and is_official=true and approval_status='approved'
 ) then return 'not_approved';end if;
 if p_verified then
   insert into public.stage_admin_verifications(kind,target_id,verified_by)
   values(p_kind,p_target_id,auth.uid())
   on conflict(kind,target_id) do nothing;
   if not found then return 'unchanged';end if;
 else
   delete from public.stage_admin_verifications where kind=p_kind and target_id=p_target_id;
   if not found then return 'unchanged';end if;
 end if;
 insert into public.stage_owner_admin_audit(actor_id,action,kind,target_id)
 values(auth.uid(),case when p_verified then 'verification_granted' else 'verification_revoked' end,p_kind,p_target_id);
 return 'saved';
end;
$$;
revoke all on function public.stage_owner_admin_set_verified(text,uuid,boolean) from PUBLIC,anon,authenticated;
grant execute on function public.stage_owner_admin_set_verified(text,uuid,boolean) to authenticated;

-- Reutiliza o fluxo de aprovacao oficial existente, inclusive regras de slug.
create or replace function public.stage_owner_admin_review_venue(
 p_venue_id uuid,p_decision text
) returns text language plpgsql security definer set search_path=''
as $$
declare v_result text;
begin
 if not public.stage_owner_admin_status() then return 'forbidden';end if;
 if p_venue_id is null or p_decision not in ('approved','rejected')
   then return 'invalid';end if;
 v_result:=public.stage_venue_admin_review(p_venue_id,p_decision);
 if v_result in ('approved','rejected') then
   insert into public.stage_owner_admin_audit(actor_id,action,kind,target_id)
   values(auth.uid(),case when v_result='approved' then 'venue_approved' else 'venue_rejected' end,'venue',p_venue_id);
 end if;
 return v_result;
end;
$$;
revoke all on function public.stage_owner_admin_review_venue(uuid,text) from PUBLIC,anon,authenticated;
grant execute on function public.stage_owner_admin_review_venue(uuid,text) to authenticated;

create or replace function public.stage_owner_admin_history(p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
begin
 if not public.stage_owner_admin_status() then
  return jsonb_build_object('status','forbidden','items','[]'::jsonb);end if;
 if p_page is null or p_page<0 or p_page>10000 then
  return jsonb_build_object('status','invalid','items','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',x.id,'action',x.action,'kind',x.kind,'target_id',x.target_id,
  'happened_at',x.happened_at,'actor_name',x.actor_name
 ) order by x.happened_at desc,x.id desc),'[]'::jsonb) into v_items
 from(
   select a.*,p.display_name as actor_name from public.stage_owner_admin_audit a
   left join public.profiles p on p.id=a.actor_id
   order by a.happened_at desc,a.id desc
   limit 30 offset p_page*30
 ) x;
 return jsonb_build_object('status','ok','items',v_items);
end;
$$;
revoke all on function public.stage_owner_admin_history(integer) from PUBLIC,anon,authenticated;
grant execute on function public.stage_owner_admin_history(integer) to authenticated;

-- Booleano PUBLICO APENAS para perfis realmente publicados / casas oficiais.
-- Nao aceita UUID vindo de visitantes e nunca inclui detalhes de contas privadas.
create or replace function public.stage_public_verified(p_kind text,p_slug text)
returns boolean language sql stable security definer set search_path=''
as $$
 select case
  when p_kind='singer' then exists (
   select 1 from public.profiles p
   join public.stage_admin_verifications v
    on v.kind='singer' and v.target_id=p.id
   where p.username=lower(p_slug) and p.is_singer and p.is_public
  )
  when p_kind='musician' then exists (
   select 1 from public.musician_portfolios m
   join public.profiles p on p.id=m.profile_id
   join public.stage_admin_verifications v
    on v.kind='musician' and v.target_id=p.id
   where m.slug=lower(p_slug) and m.is_published and p.is_musician
  )
  when p_kind='venue' then exists (
   select 1 from public.venues h
   join public.stage_admin_verifications v
    on v.kind='venue' and v.target_id=h.id
   where h.slug=lower(p_slug) and h.active and h.is_official
     and h.approval_status='approved'
  )
  else false end;
$$;
revoke all on function public.stage_public_verified(text,text) from PUBLIC,anon,authenticated;
grant execute on function public.stage_public_verified(text,text) to anon,authenticated;

commit;
notify pgrst,'reload schema';
