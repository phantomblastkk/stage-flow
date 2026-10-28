const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function bookingId(value: string): string {
  if (!uuid.test(value)) throw new Error("Identificador da contratação inválido.");
  return value;
}
export function conversationHref(id: string) { return "/conversas?conversa=" + encodeURIComponent(bookingId(id)); }
export function invitationAgendaHref(eventId: string) { return "/eventos?evento=" + encodeURIComponent(bookingId(eventId)); }
export function validBookingDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
