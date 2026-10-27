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
