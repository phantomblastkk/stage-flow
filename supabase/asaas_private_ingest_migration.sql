-- StageFlow / Asaas: isolated QA webhook receiver.
-- Apply ONLY to Supabase QA. This does not create charges or grant Pro.
-- The token stored here is a SHA-256 hash, not the plaintext Vercel secret.
begin;

create table if not exists public.stage_asaas_webhook_credentials (
  singleton boolean primary key default true check (singleton),
  token_sha256 char(64) not null check (token_sha256 ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);
alter table public.stage_asaas_webhook_credentials enable row level security;
revoke all on public.stage_asaas_webhook_credentials from public, anon, authenticated;
-- No RLS policies: browser users cannot retrieve the verifier.

create or replace function public.stage_asaas_ingest_verified_event(
  p_ingest_token text,
  p_event_id text,
  p_event_type text,
  p_payment_id text,
  p_subscription_id text,
  p_payment_status text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash char(64);
  v_count integer;
begin
  if p_ingest_token is null or length(p_ingest_token) <> 64
     or p_ingest_token !~ '^[a-f0-9]{64}$' then
    return 'unauthorized';
  end if;

  select c.token_sha256 into v_hash
    from public.stage_asaas_webhook_credentials c where c.singleton = true;
  if v_hash is null then return 'not_configured'; end if;

  if v_hash <> encode(pg_catalog.sha256(pg_catalog.convert_to(p_ingest_token, 'UTF8')), 'hex')
  then return 'unauthorized'; end if;

  if p_event_id is null or p_event_id !~ '^[A-Za-z0-9_-]{5,120}$'
    or p_payment_id is null or p_payment_id !~ '^[A-Za-z0-9_-]{5,120}$'
    or (p_subscription_id is not null
      and p_subscription_id !~ '^[A-Za-z0-9_-]{5,120}$')
    or p_payment_status is null or length(p_payment_status) not between 1 and 80
    or p_event_type is null or p_event_type not in (
      'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED',
      'PAYMENT_DELETED', 'PAYMENT_CHARGEBACK_REQUESTED',
      'PAYMENT_CHARGEBACK_DISPUTE'
    )
  then return 'invalid'; end if;

  insert into public.stage_asaas_webhook_inbox
    (event_id, event_type, payment_id, subscription_id, payment_status)
  values
    (p_event_id, p_event_type, p_payment_id, p_subscription_id, p_payment_status)
  on conflict (event_id) do nothing;
  get diagnostics v_count = row_count;
  if v_count = 1 then return 'stored'; end if;
  return 'duplicate';
end;
$$;
revoke all on function public.stage_asaas_ingest_verified_event(
  text,text,text,text,text,text) from public,anon,authenticated;
-- Secret is a separate high-entropy server-only verifier, never an Asaas API key.
grant execute on function public.stage_asaas_ingest_verified_event(
  text,text,text,text,text,text) to anon;
commit;
