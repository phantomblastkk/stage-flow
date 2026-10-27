-- Stage Flow: apresentações de outros artistas confirmadas pelo músico.
-- Execute no Supabase SQL Editor após received_invitations_migration.sql.
-- Esta função é somente leitura e não duplica eventos na tabela.
-- Cada músico enxerga APENAS shows com convite próprio aceito.

create or replace function public.stage_accepted_shows()
returns table (
  event_id uuid,
  title text,
  venue text,
  city text,
  starts_at timestamptz,
  ends_at timestamptz,
  event_status text,
  organizer_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id as event_id,
    e.title,
    e.venue,
    e.city,
    e.starts_at,
    e.ends_at,
    e.status::text as event_status,
    p.display_name as organizer_name
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.profiles p on p.id = e.producer_id
  where auth.uid() is not null
    and i.musician_id = auth.uid()
    and i.status = 'accepted'
    and e.producer_id <> auth.uid()
  order by e.starts_at asc, e.id;
$$;

revoke all on function public.stage_accepted_shows() from public, anon;
grant execute on function public.stage_accepted_shows() to authenticated;
