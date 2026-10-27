/**
 * Asaas webhook contract for future sandbox integration.
 * Pure validation only: never grants access or modifies subscriptions.
 * A verified event still requires idempotent persistence and matching
 * the payment's trusted subscription and account in the database.
 */
export type AsaasPaymentEvent = {
  id: string;
  event: string;
  payment: {
    id: string;
    subscription: string | null;
    status: string;
  };
};

const paymentEvents = new Set([
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_DELETED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE"
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAsaasPaymentEvent(input: unknown): AsaasPaymentEvent | null {
  if (!record(input) || typeof input.id !== "string" ||
      !/^[a-zA-Z0-9_-]{5,120}$/.test(input.id) ||
      typeof input.event !== "string" || !paymentEvents.has(input.event) ||
      !record(input.payment) || typeof input.payment.id !== "string" ||
      !/^[a-zA-Z0-9_-]{5,120}$/.test(input.payment.id) ||
      typeof input.payment.status !== "string") return null;
  const subscription = input.payment.subscription;
  if (subscription != null &&
      (typeof subscription !== "string" ||
       !/^[a-zA-Z0-9_-]{5,120}$/.test(subscription))) return null;
  return {
    id: input.id,
    event: input.event,
    payment: {
      id: input.payment.id,
      subscription: subscription ?? null,
      status: input.payment.status
    }
  };
}

export function asaasEventIsPaymentSettlement(event: AsaasPaymentEvent): boolean {
  // A successful event isn't enough to grant Pro: verified ownership,
  // deduplicated event ID, actual Asaas payment and billing cycle are required.
  return event.event === "PAYMENT_CONFIRMED" || event.event === "PAYMENT_RECEIVED";
}
