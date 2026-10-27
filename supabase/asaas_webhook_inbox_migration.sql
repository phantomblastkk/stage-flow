-- StageFlow | Inbox idempotente do webhook Asaas (aplicar SOMENTE no QA primeiro)
-- Nao altera assinaturas, perfis, acesso Pro ou dados financeiros.
begin;
create table if not exists public.stage_asaas_webhook_inbox (
 event_id text primary key check (event_id ~ '^[A-Za-z0-9_-]{5,120}$'),
 event_type text not null check (length(event_type) between 5 and 80),
 payment_id text not null check (payment_id ~ '^[A-Za-z0-9_-]{5,120}$'),
 subscription_id text check (subscription_id is null or subscription_id ~ '^[A-Za-z0-9_-]{5,120}$'),
 payment_status text not null check (length(payment_status) between 1 and 80),
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 processing_error text
);
alter table public.stage_asaas_webhook_inbox enable row level security;
revoke all on public.stage_asaas_webhook_inbox from public,anon,authenticated;
grant select,insert on public.stage_asaas_webhook_inbox to service_role;
create index if not exists stage_asaas_webhook_received_idx
 on public.stage_asaas_webhook_inbox(received_at desc);
-- Sem policies: apenas service_role no servidor registra notificacoes verificadas.
-- Duplicatas usam event_id como PK e NAO sobrescrevem eventos anteriores.
commit;
