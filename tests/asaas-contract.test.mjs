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

test("webhook endpoint verifies dedicated authentication and fails closed without persistence", () => {
  const route = readFileSync("app/api/asaas/webhook/route.ts", "utf8");
  assert.match(route, /ASAAS_WEBHOOK_AUTH_TOKEN/);
  assert.match(route, /asaas-access-token/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /parseAsaasPaymentEvent\(payload\)/);
  assert.match(route, /storage_not_configured/);
  assert.match(route, /stage_asaas_webhook_inbox/);
  assert.match(route, /ignoreDuplicates: true/);
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
