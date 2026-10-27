import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { parseAsaasPaymentEvent } from "@/lib/asaas-webhook";

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

  // The future queue must atomically store event.id as a unique key before 200.
  // No persistence is connected: explicitly refuse instead of losing the event.
  return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
}
