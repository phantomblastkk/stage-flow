-- QA invite-read compatibility: add missing read RPCs only.
-- Intentionally does not overwrite stage_respond_invite (fee agreement gate).
begin;
create or replace function public.stage_my_invitations()
returns table (
  id uuid,
  status text,
  message text,
  created_at timestamptz,
  responded_at timestamptz,
  event_id uuid,
  event_title text,
  event_starts_at timestamptz,
  event_venue text,
  event_city text,
  organizer_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.status::text,
    i.message,
    i.created_at,
    i.responded_at,
    e.id,
    e.title,
    e.starts_at,
    e.venue,
    e.city,
    p.display_name
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.profiles p on p.id = e.producer_id
  where i.musician_id = auth.uid()
  order by
    case when i.status = 'pending' then 0 else 1 end,
    e.starts_at asc,
    i.created_at desc;
$$;

revoke all on function public.stage_my_invitations() from public;
grant execute on function public.stage_my_invitations() to authenticated;

-- stage_sent_invitations is intentionally not installed here: QA still lacks
-- invited_email and invite_code. Those require a separately reviewed migration.

commit;
notify pgrst,'reload schema';
