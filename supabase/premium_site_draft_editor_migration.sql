-- Stage Flow | Rascunho privado do editor visual do SITE PROFISSIONAL
-- Execute após multi_role_accounts_migration.sql.
-- A página gratuita /@artista NÃO é alterada por esta migração.
-- A configuração nunca habilita assinatura, subdomínio ou publicação premium.
-- Opcionalmente executável de novo (não apaga rascunhos existentes).

create table if not exists public.stage_premium_site_drafts (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'midnight',
  accent text not null default 'violet',
  section_order text[] not null default array['about','portfolio','agenda','contact']::text[],
  visible_sections text[] not null default array['about','portfolio','agenda','contact']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stage_premium_site_drafts enable row level security;
-- Nenhum acesso direto por cliente: somente RPCs autenticadas e verificadas.
revoke all on table public.stage_premium_site_drafts from PUBLIC, anon, authenticated;

-- Restrições preservam rascunhos íntegros mesmo quando o banco for acessado
-- via processos confiáveis internos.
alter table public.stage_premium_site_drafts
  drop constraint if exists stage_premium_draft_theme_check,
  drop constraint if exists stage_premium_draft_accent_check,
  drop constraint if exists stage_premium_draft_order_check,
  drop constraint if exists stage_premium_draft_visible_check;

alter table public.stage_premium_site_drafts
  add constraint stage_premium_draft_theme_check
    check (theme in ('midnight', 'concert', 'ivory')),
  add constraint stage_premium_draft_accent_check
    check (accent in ('violet','lime','cyan','gold','coral')),
  add constraint stage_premium_draft_order_check
    check (
      cardinality(section_order) = 4
      and section_order @> array['about','portfolio','agenda','contact']::text[]
      and section_order <@ array['about','portfolio','agenda','contact']::text[]
      and array_position(section_order, null) is null
    ),
  add constraint stage_premium_draft_visible_check
    check (
      cardinality(visible_sections) between 1 and 4
      and visible_sections <@ array['about','portfolio','agenda','contact']::text[]
      and array_position(visible_sections, null) is null
    );

create or replace function public.stage_my_premium_site_draft()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then return null; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_artist = true
  ) then return null; end if;

  select jsonb_build_object(
    'theme', d.theme,
    'accent', d.accent,
    'section_order', d.section_order,
    'visible_sections', d.visible_sections,
    'updated_at', d.updated_at
  )
  into v_result
  from public.stage_premium_site_drafts d
  where d.owner_id = auth.uid();

  return coalesce(v_result, jsonb_build_object(
    'theme','midnight',
    'accent','violet',
    'section_order',array['about','portfolio','agenda','contact']::text[],
    'visible_sections',array['about','portfolio','agenda','contact']::text[],
    'updated_at',null
  ));
end;
$$;

revoke all on function public.stage_my_premium_site_draft() from PUBLIC;
grant execute on function public.stage_my_premium_site_draft() to authenticated;

create or replace function public.stage_save_premium_site_draft(
  p_theme text,
  p_accent text,
  p_section_order text[],
  p_visible_sections text[]
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_allowed text[] := array['about','portfolio','agenda','contact']::text[];
begin
  if auth.uid() is null then return 'login_required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_artist = true
  ) then return 'artist_required'; end if;

  if p_theme is null or p_theme not in ('midnight','concert','ivory')
    then return 'invalid_theme'; end if;
  if p_accent is null or p_accent not in ('violet','lime','cyan','gold','coral')
    then return 'invalid_accent'; end if;
  if p_section_order is null
    or cardinality(p_section_order) <> 4
    or p_section_order @> v_allowed is not true
    or p_section_order <@ v_allowed is not true
    or array_position(p_section_order, null) is not null
    then return 'invalid_order'; end if;
  if p_visible_sections is null
    or cardinality(p_visible_sections) not between 1 and 4
    or p_visible_sections <@ v_allowed is not true
    or array_position(p_visible_sections, null) is not null
    or cardinality(p_visible_sections) <> (
      select count(distinct section)::integer
      from unnest(p_visible_sections) section
    )
    then return 'invalid_sections'; end if;

  insert into public.stage_premium_site_drafts
    (owner_id,theme,accent,section_order,visible_sections,updated_at)
  values (
    auth.uid(),p_theme,p_accent,p_section_order,p_visible_sections,now()
  )
  on conflict (owner_id) do update
    set theme = excluded.theme,
        accent = excluded.accent,
        section_order = excluded.section_order,
        visible_sections = excluded.visible_sections,
        updated_at = now();

  return 'saved';
end;
$$;

revoke all on function public.stage_save_premium_site_draft(
  text,text,text[],text[]
) from PUBLIC;
grant execute on function public.stage_save_premium_site_draft(
  text,text,text[],text[]
) to authenticated;

-- Em particular, NENHUMA rotina acima consulta/altera
-- plan_code, subscription_status ou custom_subdomain_enabled.
