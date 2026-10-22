-- Stage Flow | Programacao independente das casas, flyers, galeria e sugestoes
-- Pre-requisito: aplicar venue_admin_migration.sql primeiro.
-- Esta migracao NAO importa eventos dos musicos e NAO ativa votacoes.
begin;

create table if not exists public.stage_venue_calendar_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  flyer_path text,
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stage_venue_calendar_time_check check (ends_at is null or ends_at>=starts_at),
  constraint stage_venue_calendar_title_check check (char_length(btrim(title)) between 2 and 120),
  constraint stage_venue_calendar_description_check check (char_length(description)<=1200)
);
create index if not exists stage_venue_calendar_by_month_idx
  on public.stage_venue_calendar_events (venue_id, starts_at, id);
alter table public.stage_venue_calendar_events enable row level security;
revoke all on public.stage_venue_calendar_events from public,anon,authenticated;

create table if not exists public.stage_venue_gallery (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  media_path text not null unique,
  caption text not null default '' check (char_length(caption)<=180),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists stage_venue_gallery_order_idx
  on public.stage_venue_gallery (venue_id,sort_order,created_at);
alter table public.stage_venue_gallery enable row level security;
revoke all on public.stage_venue_gallery from public,anon,authenticated;

create table if not exists public.stage_venue_artist_suggestions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  artist_name text not null check (char_length(artist_name) between 2 and 100),
  visitor_name text not null default '' check (char_length(visitor_name)<=60),
  message text not null default '' check (char_length(message)<=360),
  created_at timestamptz not null default now()
);
create index if not exists stage_venue_suggestion_recent_idx
  on public.stage_venue_artist_suggestions (venue_id, created_at desc);
alter table public.stage_venue_artist_suggestions enable row level security;
revoke all on public.stage_venue_artist_suggestions from public,anon,authenticated;

-- O bucket existente ja publica logo e capa. Novas subpastas somente para admins.
-- Verificacao definer: funciona tambem para casas inativas, que a RLS publica oculta.
create or replace function public.stage_venue_media_can_upload(p_path text)
returns boolean language sql stable security definer set search_path=''
as $
  select public.stage_venue_is_admin()
    and p_path ~ '^[0-9a-f-]{36}/(logo|cover|gallery|flyer)/[0-9a-f-]{36}[.](jpg|png|webp)

-- Somente a administracao pode escrever ou listar a agenda completa.
create or replace function public.stage_venue_calendar_admin_list(p_venue_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_events jsonb;v_gallery jsonb;v_suggestions jsonb;
begin
  if not public.stage_venue_is_admin() then
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

-- Cadastro do show pela propria casa, independentemente de eventos de musicos.
create or replace function public.stage_venue_calendar_admin_save(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_venue uuid;v_title text;v_desc text;
  v_start timestamptz;v_end timestamptz;v_status text;v_old_venue uuid;
begin
  if not public.stage_venue_is_admin() then return jsonb_build_object('status','forbidden');end if;
  if p_event is null or jsonb_typeof(p_event)<>'object' then
    return jsonb_build_object('status','invalid');end if;
  v_id:=nullif(p_event->>'id','')::uuid;
  v_venue:=nullif(p_event->>'venue_id','')::uuid;
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
      where id=v_id for update;
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
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  select venue_id into v_venue from public.stage_venue_calendar_events where id=p_id for update;
  if not found then return 'not_found';end if;
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
as $$
begin
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  delete from public.stage_venue_calendar_events where id=p_id;
  if not found then return 'not_found';end if;
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
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
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
as $$
begin
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  delete from public.stage_venue_gallery where id=p_id;
  if not found then return 'not_found';end if;
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_gallery_admin_remove(uuid) from public,anon,authenticated;
grant execute on function public.stage_venue_gallery_admin_remove(uuid) to authenticated;

-- Perfil publico existente continua leve. A agenda passa a ser EXCLUSIVA da casa:
-- NENHUM registro da agenda dos musicos e consultado nesta funcao.
create or replace function public.stage_public_venue(p_slug text)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'id',v.id,'name',v.name,'slug',v.slug,'description',v.description,
    'address',v.address,'city',c.name,'state',c.state_code,
    'instagram_url',v.instagram_url,'whatsapp',v.whatsapp,
    'logo_path',v.logo_path,'cover_path',v.cover_path,'is_partner',v.is_partner,
    'gallery',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',g.id,'media_path',g.media_path,'caption',g.caption
      ) order by g.sort_order,g.created_at)
      from public.stage_venue_gallery g where g.venue_id=v.id
    ),'[]'::jsonb)
  )
  from public.venues v left join public.cities c on c.id=v.city_id
  where v.active and v.is_official and v.slug=p_slug limit 1;
$$;
revoke all on function public.stage_public_venue(text) from public,anon,authenticated;
grant execute on function public.stage_public_venue(text) to anon,authenticated;

-- Mes informado na data local do calendario (America/Sao_Paulo).
-- Inclui historico, inclusive flyers dos meses anteriores; nao exibe rascunhos.
create or replace function public.stage_venue_public_month(p_slug text,p_month date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_venue uuid;v_events jsonb;
begin
  if p_slug is null or p_month is null
    or p_month<>date_trunc('month',p_month::timestamp)::date
    or p_month<'2000-01-01'::date or p_month>'2100-01-01'::date
  then return jsonb_build_object('status','invalid','events','[]'::jsonb);end if;
  select id into v_venue from public.venues
    where slug=p_slug and is_official and active;
  if v_venue is null then return jsonb_build_object('status','not_found','events','[]'::jsonb);end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'title',e.title,'description',e.description,
      'starts_at',e.starts_at,'ends_at',e.ends_at,'flyer_path',e.flyer_path,
      'status',e.status
    ) order by e.starts_at,e.id),'[]'::jsonb)
  into v_events from (
    select * from public.stage_venue_calendar_events
    where venue_id=v_venue
      and status='published'
      and starts_at >= (p_month::timestamp at time zone 'America/Sao_Paulo')
      and starts_at < ((p_month + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')
    order by starts_at,id limit 250
  ) e;
  return jsonb_build_object('status','ok','events',v_events);
end;
$$;
revoke all on function public.stage_venue_public_month(text,date) from public,anon,authenticated;
grant execute on function public.stage_venue_public_month(text,date) to anon,authenticated;


-- Destaque publico dos proximos eventos reais da casa em qualquer mes futuro.
-- Nao usa a agenda pessoal dos musicos.
create or replace function public.stage_venue_public_highlights(p_slug text)
returns jsonb language plpgsql stable security definer set search_path=''
as $
declare v_venue uuid;v_result jsonb;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*
-- Visitantes nao precisam criar conta. Nenhum dado de sugestao e publico.
-- Limite de volume por casa e repeticoes exatas (defesa basica, nao substitui CAPTCHA).
create or replace function public.stage_venue_suggest_artist(
  p_slug text,p_artist_name text,p_visitor_name text default '',
  p_message text default '',p_website text default ''
)
returns text language plpgsql volatile security definer set search_path=''
as $$
declare v_venue uuid;v_artist text:=btrim(coalesce(p_artist_name,''));
  v_visitor text:=btrim(coalesce(p_visitor_name,''));
  v_message text:=btrim(coalesce(p_message,''));
begin
  if char_length(coalesce(p_website,''))>0 then return 'ok';end if; -- honeypot
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(v_artist) not between 2 and 100
    or char_length(v_visitor)>60 or char_length(v_message)>360
    or v_artist ~ '[[:cntrl:]]' or v_message ~ '[[:cntrl:]]'
  then return 'invalid';end if;
  select id into v_venue from public.venues
    where slug=p_slug and is_official and active;
  if v_venue is null then return 'not_found';end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_venue::text,981241)
  );
  if (select count(*) from public.stage_venue_artist_suggestions
      where venue_id=v_venue and created_at>now()-interval '1 day')>=100
  then return 'limit_reached';end if;
  if exists(select 1 from public.stage_venue_artist_suggestions
    where venue_id=v_venue and lower(artist_name)=lower(v_artist)
      and lower(message)=lower(v_message)
      and created_at>now()-interval '15 minutes')
  then return 'ok';end if; -- resposta neutra contra spam
  insert into public.stage_venue_artist_suggestions
    (venue_id,artist_name,visitor_name,message)
  values(v_venue,v_artist,v_visitor,v_message);
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_suggest_artist(text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.stage_venue_suggest_artist(text,text,text,text,text)
  to anon,authenticated;

commit;
notify pgrst, 'reload schema';

    and exists (select 1 from public.venues v
      where v.id::text=split_part(p_path,'/',1));
$;
revoke all on function public.stage_venue_media_can_upload(text) from public,anon,authenticated;
grant execute on function public.stage_venue_media_can_upload(text) to authenticated;

-- Arquivos sao publicos por URL; rascunhos nao aparecem nas consultas publicas.
drop policy if exists "stage_venue_media_admin_insert" on storage.objects;
create policy "stage_venue_media_admin_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id='stage-venue-media'
  and public.stage_venue_media_can_upload(name)
);

-- Somente a administracao pode escrever ou listar a agenda completa.
create or replace function public.stage_venue_calendar_admin_list(p_venue_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_events jsonb;v_gallery jsonb;v_suggestions jsonb;
begin
  if not public.stage_venue_is_admin() then
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

-- Cadastro do show pela propria casa, independentemente de eventos de musicos.
create or replace function public.stage_venue_calendar_admin_save(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_venue uuid;v_title text;v_desc text;
  v_start timestamptz;v_end timestamptz;v_status text;v_old_venue uuid;
begin
  if not public.stage_venue_is_admin() then return jsonb_build_object('status','forbidden');end if;
  if p_event is null or jsonb_typeof(p_event)<>'object' then
    return jsonb_build_object('status','invalid');end if;
  v_id:=nullif(p_event->>'id','')::uuid;
  v_venue:=nullif(p_event->>'venue_id','')::uuid;
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
      where id=v_id for update;
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
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  select venue_id into v_venue from public.stage_venue_calendar_events where id=p_id for update;
  if not found then return 'not_found';end if;
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
as $$
begin
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  delete from public.stage_venue_calendar_events where id=p_id;
  if not found then return 'not_found';end if;
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
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
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
as $$
begin
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  delete from public.stage_venue_gallery where id=p_id;
  if not found then return 'not_found';end if;
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_gallery_admin_remove(uuid) from public,anon,authenticated;
grant execute on function public.stage_venue_gallery_admin_remove(uuid) to authenticated;

-- Perfil publico existente continua leve. A agenda passa a ser EXCLUSIVA da casa:
-- NENHUM registro da agenda dos musicos e consultado nesta funcao.
create or replace function public.stage_public_venue(p_slug text)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'id',v.id,'name',v.name,'slug',v.slug,'description',v.description,
    'address',v.address,'city',c.name,'state',c.state_code,
    'instagram_url',v.instagram_url,'whatsapp',v.whatsapp,
    'logo_path',v.logo_path,'cover_path',v.cover_path,'is_partner',v.is_partner,
    'gallery',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',g.id,'media_path',g.media_path,'caption',g.caption
      ) order by g.sort_order,g.created_at)
      from public.stage_venue_gallery g where g.venue_id=v.id
    ),'[]'::jsonb)
  )
  from public.venues v left join public.cities c on c.id=v.city_id
  where v.active and v.is_official and v.slug=p_slug limit 1;
$$;
revoke all on function public.stage_public_venue(text) from public,anon,authenticated;
grant execute on function public.stage_public_venue(text) to anon,authenticated;

-- Mes informado na data local do calendario (America/Sao_Paulo).
-- Inclui historico, inclusive flyers dos meses anteriores; nao exibe rascunhos.
create or replace function public.stage_venue_public_month(p_slug text,p_month date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_venue uuid;v_events jsonb;
begin
  if p_slug is null or p_month is null
    or p_month<>date_trunc('month',p_month::timestamp)::date
    or p_month<'2000-01-01'::date or p_month>'2100-01-01'::date
  then return jsonb_build_object('status','invalid','events','[]'::jsonb);end if;
  select id into v_venue from public.venues
    where slug=p_slug and is_official and active;
  if v_venue is null then return jsonb_build_object('status','not_found','events','[]'::jsonb);end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'title',e.title,'description',e.description,
      'starts_at',e.starts_at,'ends_at',e.ends_at,'flyer_path',e.flyer_path,
      'status',e.status
    ) order by e.starts_at,e.id),'[]'::jsonb)
  into v_events from (
    select * from public.stage_venue_calendar_events
    where venue_id=v_venue
      and status='published'
      and starts_at >= (p_month::timestamp at time zone 'America/Sao_Paulo')
      and starts_at < ((p_month + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')
    order by starts_at,id limit 250
  ) e;
  return jsonb_build_object('status','ok','events',v_events);
end;
$$;
revoke all on function public.stage_venue_public_month(text,date) from public,anon,authenticated;
grant execute on function public.stage_venue_public_month(text,date) to anon,authenticated;

-- Apenas uma sugestao de ARTISTA, sem voto, ranking nem publicacao automatica.
-- Visitantes nao precisam criar conta. Nenhum dado de sugestao e publico.
-- Limite de volume por casa e repeticoes exatas (defesa basica, nao substitui CAPTCHA).
create or replace function public.stage_venue_suggest_artist(
  p_slug text,p_artist_name text,p_visitor_name text default '',
  p_message text default '',p_website text default ''
)
returns text language plpgsql volatile security definer set search_path=''
as $$
declare v_venue uuid;v_artist text:=btrim(coalesce(p_artist_name,''));
  v_visitor text:=btrim(coalesce(p_visitor_name,''));
  v_message text:=btrim(coalesce(p_message,''));
begin
  if char_length(coalesce(p_website,''))>0 then return 'ok';end if; -- honeypot
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(v_artist) not between 2 and 100
    or char_length(v_visitor)>60 or char_length(v_message)>360
    or v_artist ~ '[[:cntrl:]]' or v_message ~ '[[:cntrl:]]'
  then return 'invalid';end if;
  select id into v_venue from public.venues
    where slug=p_slug and is_official and active;
  if v_venue is null then return 'not_found';end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_venue::text,981241)
  );
  if (select count(*) from public.stage_venue_artist_suggestions
      where venue_id=v_venue and created_at>now()-interval '1 day')>=100
  then return 'limit_reached';end if;
  if exists(select 1 from public.stage_venue_artist_suggestions
    where venue_id=v_venue and lower(artist_name)=lower(v_artist)
      and lower(message)=lower(v_message)
      and created_at>now()-interval '15 minutes')
  then return 'ok';end if; -- resposta neutra contra spam
  insert into public.stage_venue_artist_suggestions
    (venue_id,artist_name,visitor_name,message)
  values(v_venue,v_artist,v_visitor,v_message);
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_suggest_artist(text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.stage_venue_suggest_artist(text,text,text,text,text)
  to anon,authenticated;

commit;
notify pgrst, 'reload schema';

  then return jsonb_build_object('status','invalid','events','[]'::jsonb);end if;
  select id into v_venue from public.venues
  where slug=p_slug and active and is_official;
  if v_venue is null then
    return jsonb_build_object('status','not_found','events','[]'::jsonb);end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'title',e.title,'description',e.description,
    'starts_at',e.starts_at,'ends_at',e.ends_at,
    'flyer_path',e.flyer_path,'status',e.status
  ) order by e.starts_at,e.id),'[]'::jsonb)
  into v_result from (
    select id,title,description,starts_at,ends_at,flyer_path,status
    from public.stage_venue_calendar_events
    where venue_id=v_venue and status='published' and starts_at>=now()
    order by starts_at,id limit 4
  ) e;
  return jsonb_build_object('status','ok','events',v_result);
end;
$;
revoke all on function public.stage_venue_public_highlights(text)
from public,anon,authenticated;
grant execute on function public.stage_venue_public_highlights(text)
to anon,authenticated;

-- Apenas uma sugestao de ARTISTA, sem voto, ranking nem publicacao automatica.
-- Visitantes nao precisam criar conta. Nenhum dado de sugestao e publico.
-- Limite de volume por casa e repeticoes exatas (defesa basica, nao substitui CAPTCHA).
create or replace function public.stage_venue_suggest_artist(
  p_slug text,p_artist_name text,p_visitor_name text default '',
  p_message text default '',p_website text default ''
)
returns text language plpgsql volatile security definer set search_path=''
as $$
declare v_venue uuid;v_artist text:=btrim(coalesce(p_artist_name,''));
  v_visitor text:=btrim(coalesce(p_visitor_name,''));
  v_message text:=btrim(coalesce(p_message,''));
begin
  if char_length(coalesce(p_website,''))>0 then return 'ok';end if; -- honeypot
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(v_artist) not between 2 and 100
    or char_length(v_visitor)>60 or char_length(v_message)>360
    or v_artist ~ '[[:cntrl:]]' or v_message ~ '[[:cntrl:]]'
  then return 'invalid';end if;
  select id into v_venue from public.venues
    where slug=p_slug and is_official and active;
  if v_venue is null then return 'not_found';end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_venue::text,981241)
  );
  if (select count(*) from public.stage_venue_artist_suggestions
      where venue_id=v_venue and created_at>now()-interval '1 day')>=100
  then return 'limit_reached';end if;
  if exists(select 1 from public.stage_venue_artist_suggestions
    where venue_id=v_venue and lower(artist_name)=lower(v_artist)
      and lower(message)=lower(v_message)
      and created_at>now()-interval '15 minutes')
  then return 'ok';end if; -- resposta neutra contra spam
  insert into public.stage_venue_artist_suggestions
    (venue_id,artist_name,visitor_name,message)
  values(v_venue,v_artist,v_visitor,v_message);
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_suggest_artist(text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.stage_venue_suggest_artist(text,text,text,text,text)
  to anon,authenticated;

commit;
notify pgrst, 'reload schema';

    and exists (select 1 from public.venues v
      where v.id::text=split_part(p_path,'/',1));
$;
revoke all on function public.stage_venue_media_can_upload(text) from public,anon,authenticated;
grant execute on function public.stage_venue_media_can_upload(text) to authenticated;

-- Arquivos sao publicos por URL; rascunhos nao aparecem nas consultas publicas.
drop policy if exists "stage_venue_media_admin_insert" on storage.objects;
create policy "stage_venue_media_admin_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id='stage-venue-media'
  and public.stage_venue_media_can_upload(name)
);

-- Somente a administracao pode escrever ou listar a agenda completa.
create or replace function public.stage_venue_calendar_admin_list(p_venue_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_events jsonb;v_gallery jsonb;v_suggestions jsonb;
begin
  if not public.stage_venue_is_admin() then
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

-- Cadastro do show pela propria casa, independentemente de eventos de musicos.
create or replace function public.stage_venue_calendar_admin_save(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_venue uuid;v_title text;v_desc text;
  v_start timestamptz;v_end timestamptz;v_status text;v_old_venue uuid;
begin
  if not public.stage_venue_is_admin() then return jsonb_build_object('status','forbidden');end if;
  if p_event is null or jsonb_typeof(p_event)<>'object' then
    return jsonb_build_object('status','invalid');end if;
  v_id:=nullif(p_event->>'id','')::uuid;
  v_venue:=nullif(p_event->>'venue_id','')::uuid;
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
      where id=v_id for update;
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
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  select venue_id into v_venue from public.stage_venue_calendar_events where id=p_id for update;
  if not found then return 'not_found';end if;
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
as $$
begin
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  delete from public.stage_venue_calendar_events where id=p_id;
  if not found then return 'not_found';end if;
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
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
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
as $$
begin
  if not public.stage_venue_is_admin() then return 'forbidden';end if;
  delete from public.stage_venue_gallery where id=p_id;
  if not found then return 'not_found';end if;
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_gallery_admin_remove(uuid) from public,anon,authenticated;
grant execute on function public.stage_venue_gallery_admin_remove(uuid) to authenticated;

-- Perfil publico existente continua leve. A agenda passa a ser EXCLUSIVA da casa:
-- NENHUM registro da agenda dos musicos e consultado nesta funcao.
create or replace function public.stage_public_venue(p_slug text)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'id',v.id,'name',v.name,'slug',v.slug,'description',v.description,
    'address',v.address,'city',c.name,'state',c.state_code,
    'instagram_url',v.instagram_url,'whatsapp',v.whatsapp,
    'logo_path',v.logo_path,'cover_path',v.cover_path,'is_partner',v.is_partner,
    'gallery',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',g.id,'media_path',g.media_path,'caption',g.caption
      ) order by g.sort_order,g.created_at)
      from public.stage_venue_gallery g where g.venue_id=v.id
    ),'[]'::jsonb)
  )
  from public.venues v left join public.cities c on c.id=v.city_id
  where v.active and v.is_official and v.slug=p_slug limit 1;
$$;
revoke all on function public.stage_public_venue(text) from public,anon,authenticated;
grant execute on function public.stage_public_venue(text) to anon,authenticated;

-- Mes informado na data local do calendario (America/Sao_Paulo).
-- Inclui historico, inclusive flyers dos meses anteriores; nao exibe rascunhos.
create or replace function public.stage_venue_public_month(p_slug text,p_month date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_venue uuid;v_events jsonb;
begin
  if p_slug is null or p_month is null
    or p_month<>date_trunc('month',p_month::timestamp)::date
    or p_month<'2000-01-01'::date or p_month>'2100-01-01'::date
  then return jsonb_build_object('status','invalid','events','[]'::jsonb);end if;
  select id into v_venue from public.venues
    where slug=p_slug and is_official and active;
  if v_venue is null then return jsonb_build_object('status','not_found','events','[]'::jsonb);end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'title',e.title,'description',e.description,
      'starts_at',e.starts_at,'ends_at',e.ends_at,'flyer_path',e.flyer_path,
      'status',e.status
    ) order by e.starts_at,e.id),'[]'::jsonb)
  into v_events from (
    select * from public.stage_venue_calendar_events
    where venue_id=v_venue
      and status='published'
      and starts_at >= (p_month::timestamp at time zone 'America/Sao_Paulo')
      and starts_at < ((p_month + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')
    order by starts_at,id limit 250
  ) e;
  return jsonb_build_object('status','ok','events',v_events);
end;
$$;
revoke all on function public.stage_venue_public_month(text,date) from public,anon,authenticated;
grant execute on function public.stage_venue_public_month(text,date) to anon,authenticated;

-- Apenas uma sugestao de ARTISTA, sem voto, ranking nem publicacao automatica.
-- Visitantes nao precisam criar conta. Nenhum dado de sugestao e publico.
-- Limite de volume por casa e repeticoes exatas (defesa basica, nao substitui CAPTCHA).
create or replace function public.stage_venue_suggest_artist(
  p_slug text,p_artist_name text,p_visitor_name text default '',
  p_message text default '',p_website text default ''
)
returns text language plpgsql volatile security definer set search_path=''
as $$
declare v_venue uuid;v_artist text:=btrim(coalesce(p_artist_name,''));
  v_visitor text:=btrim(coalesce(p_visitor_name,''));
  v_message text:=btrim(coalesce(p_message,''));
begin
  if char_length(coalesce(p_website,''))>0 then return 'ok';end if; -- honeypot
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(v_artist) not between 2 and 100
    or char_length(v_visitor)>60 or char_length(v_message)>360
    or v_artist ~ '[[:cntrl:]]' or v_message ~ '[[:cntrl:]]'
  then return 'invalid';end if;
  select id into v_venue from public.venues
    where slug=p_slug and is_official and active;
  if v_venue is null then return 'not_found';end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_venue::text,981241)
  );
  if (select count(*) from public.stage_venue_artist_suggestions
      where venue_id=v_venue and created_at>now()-interval '1 day')>=100
  then return 'limit_reached';end if;
  if exists(select 1 from public.stage_venue_artist_suggestions
    where venue_id=v_venue and lower(artist_name)=lower(v_artist)
      and lower(message)=lower(v_message)
      and created_at>now()-interval '15 minutes')
  then return 'ok';end if; -- resposta neutra contra spam
  insert into public.stage_venue_artist_suggestions
    (venue_id,artist_name,visitor_name,message)
  values(v_venue,v_artist,v_visitor,v_message);
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_suggest_artist(text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.stage_venue_suggest_artist(text,text,text,text,text)
  to anon,authenticated;

commit;
notify pgrst, 'reload schema';
