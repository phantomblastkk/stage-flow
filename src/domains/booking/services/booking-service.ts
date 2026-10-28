import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invite, Message, Thread } from "../types";
import { bookingId, validBookingDate } from "../model/booking-links";
type BookingClient = Pick<SupabaseClient, "auth" | "rpc">;

export class BookingSessionRequired extends Error {
  constructor() { super("Entre na sua conta para continuar a contratação."); }
}
/** Mutations verify the current account; database RPCs remain the authority for participants. */
async function verifyAccount(db: BookingClient, accountId: string) {
  const { data: { user }, error } = await db.auth.getUser();
  if (!user && (!error || error.name === "AuthSessionMissingError")) throw new BookingSessionRequired();
  if (error || !user) throw new Error("Não foi possível validar sua sessão agora. Sua conta não foi desconectada. Tente novamente.");
  if (user.id !== accountId) throw new Error("Sua conta mudou. Atualize a contratação antes de continuar.");
}
export async function loadInvitations(db: BookingClient, signal: AbortSignal): Promise<Invite[]> {
  const { data, error } = await db.rpc("stage_my_invitations").abortSignal(signal);
  signal.throwIfAborted();
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar os convites. Tente novamente.");
  return data as Invite[];
}
export async function respondToInvitation(db: BookingClient, accountId: string, id: string, accept: boolean) {
  bookingId(id);await verifyAccount(db, accountId);
  const { data, error } = await db.rpc("stage_respond_invite", { p_invitation_id: id, p_accept: accept });
  if (error) throw new Error("Não conseguimos registrar sua resposta. Tente novamente.");
  if (!["accepted", "declined", "fee_pending", "already_responded"].includes(data))
    throw new Error("Não foi possível responder a esse convite. Atualize a página e tente novamente.");
  return data as "accepted" | "declined" | "fee_pending" | "already_responded";
}
export async function loadThreads(db: BookingClient, signal: AbortSignal): Promise<Thread[]> {
  const { data, error } = await db.rpc("stage_hiring_list").abortSignal(signal);
  signal.throwIfAborted();
  if (error || !Array.isArray(data)) throw new Error("Não foi possível abrir a lista de conversas. Tente novamente.");
  return data as Thread[];
}
export async function loadThreadMessages(db: BookingClient, id: string, signal: AbortSignal): Promise<Message[]> {
  bookingId(id);
  const { data, error } = await db.rpc("stage_hiring_messages", { p_thread_id: id }).abortSignal(signal);
  signal.throwIfAborted();
  if (error) throw new Error("Não foi possível atualizar as mensagens. Tente novamente.");
  if (data?.status !== "ok" || !Array.isArray(data.messages)) throw new Error("Não foi possível abrir as mensagens desta conversa.");
  return data.messages as Message[];
}
export async function startConversation(db: BookingClient, accountId: string, musicianId: string, date: string | null, eventId: string | null) {
  bookingId(musicianId);if (eventId) bookingId(eventId);
  if (date && !validBookingDate(date)) throw new Error("Data inválida.");
  await verifyAccount(db, accountId);
  const { data, error } = await db.rpc("stage_hiring_start", { p_musician_id: musicianId, p_date: date, p_event_id: eventId });
  if (error || data?.status !== "ok") throw new Error(data?.status === "not_released"
    ? "O chat de contratação ainda não está disponível para esta conta."
    : data?.status === "invalid_musician" ? "Este músico não possui conta elegível para receber pedidos."
    : "Não foi possível iniciar essa conversa.");
  return bookingId(data.thread_id);
}
export async function sendThreadMessage(db: BookingClient, accountId: string, id: string, body: string) {
  bookingId(id);const text = body.trim();
  if (!text || text.length > 1500) throw new Error("Escreva uma mensagem de até 1.500 caracteres.");
  await verifyAccount(db, accountId);
  const { data, error } = await db.rpc("stage_hiring_send", { p_thread_id: id, p_body: text });
  if (error || data?.status !== "ok") throw new Error(data?.status === "rate_limited"
    ? "Você enviou muitas mensagens seguidas. Tente novamente daqui a pouco." : "Não foi possível enviar esta mensagem.");
}
export async function saveThreadAvailability(db: BookingClient, accountId: string, id: string, response: "available" | "unavailable" | "ask_later") {
  bookingId(id);await verifyAccount(db, accountId);
  const { data, error } = await db.rpc("stage_hiring_availability", { p_thread_id: id, p_response: response });
  if (error || data !== "saved") throw new Error("Não foi possível registrar sua disponibilidade.");
}
