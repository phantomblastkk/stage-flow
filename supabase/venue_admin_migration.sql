-- Stage Flow | Gestao de casas oficiais (fase 1)
-- Requer venues_catalog_migration.sql, venues_catalog_contributions.sql e venues_deduplication_migration.sql.
-- Executar no Supabase SQL Editor. NENHUM administrador e criado automaticamente.
-- Nunca usar email ou senha como regra de permissao no frontend.

begin;

create table if not exists public.stage_venue_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.stage_venue_admins enable row level security;
revoke all on public.stage_venue_admins from public, anon, authenticated;

create or replace function public.stage_venue_is_admin()
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.stage_venue_admins a where a.profile_id=auth.uid()
  );
$$;
revoke all on function public.stage_venue_is_admin() from public,anon,authenticated;

create or replace function public.stage_venue_admin_status()
returns boolean language sql stable security definer set search_path=''
as $$
  select public.stage_venue_is_admin();
$$;
revoke all on function public.stage_venue_admin_status() from public,anon,authenticated;
grant execute on function public.stage_venue_admin_status() to authenticated;

alter table public.venues
  add column if not exists slug text,
  add column if not exists description text not null default '',
  add column if not exists instagram_url text,
  add column if not exists whatsapp text,
  add column if not exists logo_path text,
  add column if not exists cover_path text,
  add column if not exists is_official boolean not null default false,
  add column if not exists is_partner boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists stage_venue_slug_unique
  on public.venues (slug) where slug is not null;
create index if not exists stage_venue_official_idx
  on public.venues (is_official,active) where slug is not null;

-- IMPORTANTE: o cadastro colaborativo deve continuar podendo inserir APENAS
-- dados basicos. Impede que um usuario comum injete is_partner, is_official,
-- logo_path, slug etc. ao chamar PostgREST diretamente.
revoke insert on public.venues from public, anon, authenticated;
grant insert (name, address, city_id, submitted_by) on public.venues to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('stage-venue-media','stage-venue-media',true,5242880,
  array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set
  public=true, file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];

drop policy if exists "stage_venue_media_admin_insert" on storage.objects;
create policy "stage_venue_media_admin_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id='stage-venue-media'
  and public.stage_venue_is_admin()
  and name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
  and exists (
    select 1 from public.venues v
    where v.id::text=split_part(name,'/',1)
  )
);
-- Nao concede UPDATE ou DELETE de midia diretamente ao cliente.
-- Os URLs de imagens publicadas sao publicos; nunca usar para material privado.

create or replace function public.stage_venue_admin_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
begin
  if not public.stage_venue_is_admin()
    then return jsonb_build_object('status','forbidden','items','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',v.id,'name',v.name,'city_id',v.city_id,'city_name',c.name,
      'state_code',c.state_code,'address',v.address,'active',v.active,
      'slug',v.slug,'description',v.description,
      'instagram_url',v.instagram_url,'whatsapp',v.whatsapp,
      'logo_path',v.logo_path,'cover_path',v.cover_path,
      'is_official',v.is_official,'is_partner',v.is_partner,
      'submitted_by',v.submitted_by,'created_at',v.created_at
    ) order by v.created_at desc,v.id), '[]'::jsonb)
  into v_items
  from public.venues v left join public.cities c on c.id=v.city_id;
  return jsonb_build_object('status','ok','items',v_items);
end;
$$;
revoke all on function public.stage_venue_admin_list() from public,anon,authenticated;
grant execute on function public.stage_venue_admin_list() to authenticated;

-- Edicao centralizada. A verificacao de permissao e feita no banco.
create or replace function public.stage_venue_admin_save(p_venue jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_id uuid;
  v_existing boolean;
  v_name text;
  v_city bigint;
  v_address text;
  v_slug text;
  v_description text;
  v_instagram text;
  v_whatsapp text;
  v_logo text;
  v_cover text;
  v_official boolean;
  v_partner boolean;
  v_active boolean;
begin
  if not public.stage_venue_is_admin()
    then return jsonb_build_object('status','forbidden'); end if;
  if p_venue is null or jsonb_typeof(p_venue)<>'object'
    then return jsonb_build_object('status','invalid'); end if;

  v_existing := nullif(p_venue->>'id','') is not null;
  v_id := coalesce(nullif(p_venue->>'id','')::uuid, gen_random_uuid());
  v_name := btrim(coalesce(p_venue->>'name',''));
  v_city := nullif(p_venue->>'city_id','')::bigint;
  v_address := nullif(btrim(coalesce(p_venue->>'address','')),'');
  v_slug := nullif(lower(btrim(coalesce(p_venue->>'slug',''))),'');
  v_description := btrim(coalesce(p_venue->>'description',''));
  v_instagram := nullif(btrim(coalesce(p_venue->>'instagram_url','')),'');
  v_whatsapp := nullif(regexp_replace(coalesce(p_venue->>'whatsapp',''),'[^0-9]','','g'),'');
  v_logo := nullif(btrim(coalesce(p_venue->>'logo_path','')),'');
  v_cover := nullif(btrim(coalesce(p_venue->>'cover_path','')),'');
  v_official := coalesce((p_venue->>'is_official')::boolean,false);
  v_partner := coalesce((p_venue->>'is_partner')::boolean,false);
  v_active := coalesce((p_venue->>'active')::boolean,true);

  if char_length(v_name)<2 or char_length(v_name)>120
    or v_city is null or not exists (
      select 1 from public.cities c where c.id=v_city and c.active
    )
    or char_length(coalesce(v_address,''))>240
    or char_length(v_description)>1500
    or (v_slug is not null and v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    or char_length(coalesce(v_slug,''))>50
    or (v_official and v_slug is null)
    or (v_partner and not v_official)
    or (v_instagram is not null and (
      char_length(v_instagram)>240
      or v_instagram !~* '^https://(www[.])?instagram[.]com/[a-z0-9._/-]+/?$'
    ))
    or (v_whatsapp is not null and char_length(v_whatsapp) not between 10 and 15)
  then return jsonb_build_object('status','invalid');end if;

  if (v_logo is not null and (
      v_logo !~ '^[0-9a-f-]{36}/logo/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
      or split_part(v_logo,'/',1)<>v_id::text
      or not exists(select 1 from storage.objects s where s.bucket_id='stage-venue-media' and s.name=v_logo)
    )) or (v_cover is not null and (
      v_cover !~ '^[0-9a-f-]{36}/cover/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
      or split_part(v_cover,'/',1)<>v_id::text
      or not exists(select 1 from storage.objects s where s.bucket_id='stage-venue-media' and s.name=v_cover)
    ))
  then return jsonb_build_object('status','invalid_media');end if;

  if v_existing then
    update public.venues set
      name=v_name,city_id=v_city,address=v_address,slug=v_slug,
      description=v_description,instagram_url=v_instagram,whatsapp=v_whatsapp,
      logo_path=v_logo,cover_path=v_cover,is_official=v_official,
      is_partner=v_partner,active=v_active,updated_at=now()
    where id=v_id;
    if not found then return jsonb_build_object('status','not_found');end if;
  else
    insert into public.venues(
      id,name,city_id,address,slug,description,instagram_url,whatsapp,
      logo_path,cover_path,is_official,is_partner,active
    ) values (
      v_id,v_name,v_city,v_address,v_slug,v_description,v_instagram,v_whatsapp,
      v_logo,v_cover,v_official,v_partner,v_active
    );
  end if;
  return jsonb_build_object('status','ok','id',v_id);
exception
  when unique_violation then return jsonb_build_object('status','duplicate');
  when invalid_text_representation or numeric_value_out_of_range
    then return jsonb_build_object('status','invalid');
end;
$$;
revoke all on function public.stage_venue_admin_save(jsonb) from public,anon,authenticated;
grant execute on function public.stage_venue_admin_save(jsonb) to authenticated;

-- Perfil publico, sem dados sobre quem cadastrou ou quaisquer eventos privados.
create or replace function public.stage_public_venue(p_slug text)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'id',v.id,'name',v.name,'slug',v.slug,'description',v.description,
    'address',v.address,'city',c.name,'state',c.state_code,
    'instagram_url',v.instagram_url,'whatsapp',v.whatsapp,
    'logo_path',v.logo_path,'cover_path',v.cover_path,'is_partner',v.is_partner
  )
  from public.venues v
  left join public.cities c on c.id=v.city_id
  where v.active and v.is_official and v.slug=p_slug
  limit 1;
$$;
revoke all on function public.stage_public_venue(text) from public,anon,authenticated;
grant execute on function public.stage_public_venue(text) to anon,authenticated;

commit;
notify pgrst, 'reload schema';

-- Ativar a sua conta SOMENTE no Supabase SQL Editor (troque pelo seu UUID real):
-- insert into public.stage_venue_admins (profile_id)
-- values ('SEU_UUID_DE_AUTH_USERS')
-- on conflict (profile_id) do nothing;
