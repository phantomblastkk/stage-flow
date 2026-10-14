-- Stage Flow: evita locais duplicados no catálogo.
-- Execute no SQL Editor do Supabase. Mantém ativo o cadastro mais antigo
-- de cada combinação de nome + cidade e desativa repetições já existentes.

with ranked_venues as (
  select
    id,
    row_number() over (
      partition by lower(trim(name)), coalesce(city_id, 0)
      order by created_at asc, id asc
    ) as duplicate_number
  from public.venues
  where active = true
)
update public.venues as venue
set active = false
from ranked_venues as ranked
where venue.id = ranked.id
  and ranked.duplicate_number > 1;

create unique index if not exists venues_unique_active_name_city_idx
on public.venues (lower(trim(name)), coalesce(city_id, 0))
where active = true;
