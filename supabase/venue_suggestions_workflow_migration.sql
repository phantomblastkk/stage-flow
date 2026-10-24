-- Stage Flow | Workflow de sugestões recebidas pelas casas parceiras.
-- Aplicar APÓS venue_partner_management_migration.sql. Somente homologação até validação.
-- NÃO muda as regras da página pública ou apaga sugestões antigas.
begin;

alter table public.stage_venue_artist_suggestions
  add column if not exists review_status text not null default 'pending',
  add column if not exists review_updated_at timestamptz,
  add column if not exists review_updated_by uuid references public.profiles(id) on delete set null;

-- Um cadastro existente começa como pendente; o texto original permanece intacto.
alter table public.stage_venue_artist_suggestions
  drop constraint if exists stage_venue_artist_suggestions_review_status_check;
alter table public.stage_venue_artist_suggestions
  add constraint stage_venue_artist_suggestions_review_status_check
  check (review_status in ('pending','reviewing','resolved'));

create index if not exists stage_venue_suggestions_review_idx
  on public.stage_venue_artist_suggestions(venue_id,review_status,created_at desc);
alter table public.stage_venue_artist_suggestions enable row level security;
revoke all on public.stage_venue_artist_suggestions from public,anon,authenticated;

-- A leitura administrativa mantém o contrato existente; apenas inclui status e data da triagem.
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
    'message',s.message,'created_at',s.created_at,
    'review_status',s.review_status,'review_updated_at',s.review_updated_at
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


-- Somente gestor desta casa (ou admin global) pode alterar a triagem.
-- A permissão é conferida no banco, nunca por id enviado pelo navegador.
create or replace function public.stage_venue_suggestion_set_status(p_id uuid,p_status text)
returns text language plpgsql volatile security definer set search_path=''
as $$
declare
  v_venue uuid;
begin
  if auth.uid() is null then return 'forbidden'; end if;
  if p_id is null or p_status is null or p_status not in ('pending','reviewing','resolved')
    then return 'invalid'; end if;

  select s.venue_id into v_venue
  from public.stage_venue_artist_suggestions s where s.id=p_id;
  if v_venue is null then return 'not_found'; end if;
  if not public.stage_venue_can_manage(v_venue) then return 'forbidden'; end if;

  update public.stage_venue_artist_suggestions s
  set review_status=p_status,
      review_updated_at=now(),
      review_updated_by=auth.uid()
  where s.id=p_id and s.venue_id=v_venue and s.review_status is distinct from p_status;
  return 'ok';
end;
$$;
revoke all on function public.stage_venue_suggestion_set_status(uuid,text) from public,anon,authenticated;
grant execute on function public.stage_venue_suggestion_set_status(uuid,text) to authenticated;

commit;
notify pgrst, 'reload schema';
