import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { parseAsaasPaymentEvent } from "@/lib/asaas-webhook";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameSecret(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  // Never acknowledge a webhook until durable, idempotent storage exists.
  // Asaas retries non-2xx responses; no payments or Pro access are granted here.
  const token = process.env.ASAAS_WEBHOOK_AUTH_TOKEN;
  if (!token || token.length < 32 || token.length > 255 || /\s/.test(token)) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const received = request.headers.get("asaas-access-token") ?? "";
  if (!received || !sameSecret(received, token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > 65536) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 65536) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const event = parseAsaasPaymentEvent(payload);
  if (!event) return NextResponse.json({ error: "unsupported_event" }, { status: 422 });

  // Payments are not enabled. Only the QA environment may receive sandbox events.
  if (process.env.NEXT_PUBLIC_STAGE_FLOW_ENV !== "homologation") {
    return NextResponse.json({ error: "sandbox_only" }, { status: 503 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !url.startsWith("https://zycuprhymoukhnuamtit.supabase.co")) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }
  try {
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { error } = await admin.from("stage_asaas_webhook_inbox").upsert({
      event_id: event.id,
      event_type: event.event,
      payment_id: event.payment.id,
      subscription_id: event.payment.subscription,
      payment_status: event.payment.status
    }, { onConflict: "event_id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    // 200 only after durable insert or verified duplicate; never grants Pro.
    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
