-- Stage Flow | Vitrine "Músicos em destaque" do Marketplace
-- Execute DEPOIS de marketplace_private_launch_migration.sql.
-- NÃO LANÇA o marketplace: mantém o bloqueio original do banco e
-- NÃO altera public.stage_marketplace_control.launched.
--
-- Ordenação: quantidade de avaliações VERIFICADAS desc; média da nota
-- como desempate; nome e ID para manter a ordenação estável.
-- Apenas portfólios publicados e músicos que optaram pelo catálogo.
-- Máximo 6, sem destaques pagos, compra de posição ou avaliações artificiais.
--
-- RPC retorna dados SOMENTE quando stage_marketplace_gate() permite.
-- As avaliações já são verificadas por show concluído + convite aceito.

create or replace function public.stage_marketplace_featured()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  if not public.stage_marketplace_gate() then
    return jsonb_build_object('status','not_released','items','[]'::jsonb);
  end if;

  with ranked as (
    select
      p.id as musician_id,
      p.display_name as name,
      m.slug,
      m.headline,
      m.city,
      m.instruments,
      m.genres,
      m.avatar_url,
      m.cover_url,
      m.price_mode,
      case when m.price_mode='from' then m.reference_fee else null end as reference_fee,
      m.experience_years,
      m.performance_types,
      m.availability_note,
      s.availability_mode,
      coalesce(r.rating_avg,0) as rating_avg,
      coalesce(r.rating_count,0) as rating_count,
      (f.owner_id is not null) as is_favorite
    from public.musician_portfolios m
    join public.profiles p on p.id=m.profile_id
    join public.stage_marketplace_musician_settings s
      on s.musician_id=m.profile_id
    cross join lateral (
      select
        round(avg(v.rating)::numeric,1) as rating_avg,
        count(*)::integer as rating_count
      from public.stage_marketplace_reviews v
      where v.musician_id=m.profile_id
    ) r
    left join public.stage_marketplace_favorites f
      on f.owner_id=auth.uid() and f.musician_id=m.profile_id
    where m.is_published=true
      and p.is_artist=true
      and s.listed=true
      and s.availability_mode <> 'unavailable'
      and r.rating_count >= 1
    order by
      r.rating_count desc,
      r.rating_avg desc,
      p.display_name asc,
      p.id asc
    limit 6
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'musician_id', musician_id,
      'name', name,
      'slug',slug,
      'headline',headline,
      'city',city,
      'instruments',instruments,
      'genres',genres,
      'avatar_url',avatar_url,
      'cover_url',cover_url,
      'price_mode',price_mode,
      'reference_fee',reference_fee,
      'experience_years',experience_years,
      'performance_types',performance_types,
      'availability_note',availability_note,
      'availability_mode',availability_mode,
      'date_blocked',false,
      'rating_avg',rating_avg,
      'rating_count',rating_count,
      'is_favorite',is_favorite
    ) order by rating_count desc,rating_avg desc,name asc,musician_id asc
  ),'[]'::jsonb)
  into v_items
  from ranked;

  return jsonb_build_object('status','ok','items',v_items);
end;
$$;

revoke all on function public.stage_marketplace_featured()
  from public,anon,authenticated;
grant execute on function public.stage_marketplace_featured()
  to anon,authenticated;

-- Garante que o marketplace permanece FECHADO se ja estava fechado.
-- Este arquivo NUNCA altera o controle de publicacao.
