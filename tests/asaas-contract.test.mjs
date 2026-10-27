import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const webhook = readFileSync("lib/asaas-webhook.ts", "utf8");
const subscriptions = readFileSync("app/assinatura/page.tsx", "utf8");

test("Asaas webhook parser accepts only allowlisted payment events and bounded identifiers", () => {
  assert.match(webhook, /paymentEvents = new Set/);
  assert.match(webhook, /PAYMENT_CONFIRMED/);
  assert.match(webhook, /PAYMENT_RECEIVED/);
  assert.match(webhook, /!paymentEvents\.has\(input\.event\)/);
  assert.match(webhook, /subscription: subscription \?\? null/);
  assert.match(webhook, /return null/);
});

test("Asaas events cannot directly provision Pro or generate real charges", () => {
  assert.doesNotMatch(webhook, /stage_pro_site_access|subscription_status\s*=|createClient|fetch\(/);
  assert.match(webhook, /deduplicated event ID/);
  assert.match(subscriptions, /Assinatura ainda indisponível/);
});

test("webhook endpoint validates Asaas token and stores events only through QA RPC", () => {
  const route = readFileSync("app/api/asaas/webhook/route.ts", "utf8");
  assert.match(route, /ASAAS_WEBHOOK_AUTH_TOKEN/);
  assert.match(route, /asaas-access-token/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /parseAsaasPaymentEvent\(payload\)/);
  assert.match(route, /storage_not_configured/);
  assert.match(route, /stage_asaas_ingest_verified_event/);
  assert.match(route, /STAGE_ASAAS_INGEST_TOKEN/);
  assert.match(route, /data !== "stored" && data !== "duplicate"/);
  assert.match(route, /duplicate: data === "duplicate"/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /NEXT_PUBLIC_STAGE_FLOW_ENV/);
  assert.match(route, /zycuprhymoukhnuamtit/);
  assert.match(route, /status: 503/);
  assert.doesNotMatch(route, /stage_pro_site_access|subscription_status/);
});

test("Asaas queue is private, duplicate-safe and does not grant paid access", () => {
 const sql=readFileSync("supabase/asaas_webhook_inbox_migration.sql","utf8");
 assert.match(sql,/event_id text primary key/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all .* from public,anon,authenticated/);
 assert.match(sql,/grant select,insert .* to service_role/);
 assert.doesNotMatch(sql,/update public\.profiles|stage_pro_site_access|subscription_status\s*=/);
});

test("private ingestion RPC requires server secret and cannot unlock any account", () => {
 const sql=readFileSync("supabase/asaas_private_ingest_migration.sql","utf8");
 assert.match(sql,/create or replace function public\.stage_asaas_ingest_verified_event/);
 assert.match(sql,/v_hash <> encode\(pg_catalog\.sha256/);
 assert.match(sql,/on conflict \(event_id\) do nothing/);
 assert.match(sql,/get diagnostics v_count = row_count/);
 assert.match(sql,/revoke all on function public\.stage_asaas_ingest_verified_event/);
 assert.match(sql,/grant execute on function public\.stage_asaas_ingest_verified_event/);
 assert.doesNotMatch(sql,/update public\.profiles|stage_pro_site_access|subscription_status\s*=/);
});

test("sandbox smoke script cannot target production or create subscriptions", () => {
 const smoke=readFileSync("scripts/asaas-sandbox-smoke.mjs","utf8");
 assert.match(smoke,/stage-flow-homologacao\.vercel\.app/);
 assert.match(smoke,/QA host required/);
 assert.match(smoke,/crypto\.randomUUID\(\)/);
 assert.match(smoke,/PAYMENT_CREATED/);
 assert.match(smoke,/No authentication rejected/);
 assert.match(smoke,/Duplicate sandbox event/);
 assert.doesNotMatch(smoke,/PAYMENT_CONFIRMED|PAYMENT_RECEIVED|\/payments|\/subscriptions/);
});
