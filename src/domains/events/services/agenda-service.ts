import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendaCursor, AgendaSource, AgendaWindow, CitySuggestion, EventDraft, EventRow, GuestShow, VenueSuggestion } from "../types";

// The browser uses only its normal authenticated client; RLS is still authoritative.
type AgendaClient = Pick<SupabaseClient, "auth" | "from" | "rpc">;
const eventColumns = "id,title,description,venue,city,starts_at,ends_at,status,show_publicly";

export class AgendaSessionRequired extends Error {
  constructor() { super("Entre na sua conta para acessar a agenda."); }
}

async function currentUser(db: AgendaClient, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { data: { user }, error } = await db.auth.getUser();
  signal?.throwIfAborted();
  if (!user && (!error || error.name === "AuthSessionMissingError")) throw new AgendaSessionRequired();
  if (error || !user) throw new Error("Não foi possível validar sua sessão. Confira a conexão e tente novamente.");
  return user;
}

export const AGENDA_PAGE_SIZE = 20;
const CALENDAR_MARKER_LIMIT = 500;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Local calendar boundaries are converted to UTC once, including DST transitions. */
export function agendaWindow(month: Date, day: string | null = null): AgendaWindow {
  const year = month.getFullYear(), index = month.getMonth();
  let from = new Date(year, index, 1), to = new Date(year, index + 1, 1);
  if (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Data inválida.");
    const [y, m, d] = day.split("-").map(Number);
    from = new Date(y, m - 1, d); to = new Date(y, m - 1, d + 1);
    if (y !== year || m - 1 !== index || from.getDate() !== d) throw new Error("Data fora do mês selecionado.");
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function validateWindow(window: AgendaWindow) {
  const length = Date.parse(window.to) - Date.parse(window.from);
  if (!Number.isFinite(length) || length <= 0 || length > 32 * 86400000)
    throw new Error("Selecione um período de até um mês.");
}

function pageQuery(db: AgendaClient, ownerId: string, window: AgendaWindow, source: AgendaSource, signal: AbortSignal, cursor?: AgendaCursor) {
  validateWindow(window);
  const idColumn = source === "owned" ? "id" : "event_id";
  let query = source === "owned"
    ? db.from("events").select(eventColumns).eq("producer_id", ownerId)
    : db.rpc("stage_accepted_shows");
  query = query.gte("starts_at", window.from).lt("starts_at", window.to);
  if (cursor) {
    const time = new Date(cursor.startsAt);
    if (!uuid.test(cursor.id) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.startsAt) || !Number.isFinite(time.getTime())) throw new Error("Página inválida. Atualize a agenda.");
    const date = cursor.startsAt; // Preserve PostgreSQL microseconds for stable pagination.
    query = query.or(`starts_at.gt.${date},and(starts_at.eq.${date},${idColumn}.gt.${cursor.id})`);
  }
  return query.order("starts_at", { ascending: true }).order(idColumn, { ascending: true })
    .limit(AGENDA_PAGE_SIZE + 1).abortSignal(signal);
}

function page<T extends EventRow | GuestShow>(rows: T[]) {
  const items = rows.slice(0, AGENDA_PAGE_SIZE), last = items[items.length - 1];
  const next = rows.length > AGENDA_PAGE_SIZE && last
    ? { startsAt: last.starts_at, id: "id" in last ? last.id : last.event_id } : null;
  return { items, next };
}

export async function loadAgenda(db: AgendaClient, signal: AbortSignal, window: AgendaWindow) {
  const user = await currentUser(db, signal);
  const [owned, accepted] = await Promise.all([
    pageQuery(db, user.id, window, "owned", signal),
    pageQuery(db, user.id, window, "accepted", signal),
  ]);
  signal.throwIfAborted();
  const ownPage = !owned.error && Array.isArray(owned.data) ? page(owned.data as EventRow[]) : null;
  const guestPage = !accepted.error && Array.isArray(accepted.data) ? page(accepted.data as GuestShow[]) : null;
  return { ownerId: user.id, events: ownPage?.items ?? null, guestShows: guestPage?.items ?? null,
    ownNext: ownPage?.next ?? null, guestNext: guestPage?.next ?? null };
}

export async function loadMoreAgenda(db: AgendaClient, signal: AbortSignal, window: AgendaWindow, source: AgendaSource, cursor: AgendaCursor) {
  const user = await currentUser(db, signal);
  const result = await pageQuery(db, user.id, window, source, signal, cursor);
  signal.throwIfAborted();
  if (result.error || !Array.isArray(result.data)) throw new Error("Não foi possível carregar mais shows. Tente novamente.");
  return { ownerId: user.id, ...page(result.data as (EventRow | GuestShow)[]) };
}

/** Minimal, bounded month markers are independent of the visible list's page/day. */
export async function loadAgendaMarkers(db: AgendaClient, signal: AbortSignal, window: AgendaWindow) {
  validateWindow(window);
  const user = await currentUser(db, signal);
  const [owned, accepted] = await Promise.all([
    db.from("events").select("starts_at").eq("producer_id", user.id)
      .gte("starts_at", window.from).lt("starts_at", window.to).order("starts_at").limit(CALENDAR_MARKER_LIMIT + 1).abortSignal(signal),
    db.rpc("stage_accepted_shows").select("starts_at,event_status")
      .gte("starts_at", window.from).lt("starts_at", window.to).neq("event_status", "cancelled")
      .order("starts_at").limit(CALENDAR_MARKER_LIMIT + 1).abortSignal(signal),
  ]);
  signal.throwIfAborted();
  if (owned.error || accepted.error || !Array.isArray(owned.data) || !Array.isArray(accepted.data))
    throw new Error("As marcações do calendário estão indisponíveis. Consulte as listas de shows abaixo.");
  return { ownerId: user.id, own: owned.data.slice(0, CALENDAR_MARKER_LIMIT).map(row => row.starts_at as string),
    guest: accepted.data.slice(0, CALENDAR_MARKER_LIMIT).map(row => row.starts_at as string),
    partial: owned.data.length > CALENDAR_MARKER_LIMIT || accepted.data.length > CALENDAR_MARKER_LIMIT };
}

export async function loadAgendaEvent(db: AgendaClient, signal: AbortSignal, eventId: string) {
  if (!uuid.test(eventId)) throw new Error("Show inválido.");
  const user = await currentUser(db, signal);
  const { data, error } = await db.from("events").select(eventColumns)
    .eq("id", eventId).eq("producer_id", user.id).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if (error || !data) throw new Error("Show não encontrado ou sem acesso.");
  return data as EventRow;
}

/** A booking link can target an owned event or an accepted participation, never a public event lookup. */
export async function loadAgendaTarget(db: AgendaClient, signal: AbortSignal, eventId: string) {
  if (!uuid.test(eventId)) throw new Error("Show inválido.");
  const user = await currentUser(db, signal);
  const own = await db.from("events").select(eventColumns).eq("id", eventId)
    .eq("producer_id", user.id).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if (own.error) throw new Error("Não foi possível abrir o show. Tente novamente.");
  if (own.data) return { kind: "owned" as const, event: own.data as EventRow };
  const guest = await db.rpc("stage_accepted_shows").eq("event_id", eventId)
    .limit(1).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if (guest.error) throw new Error("Não foi possível abrir sua participação. Tente novamente.");
  if (!guest.data) throw new Error("Show não encontrado ou sem acesso.");
  return { kind: "accepted" as const, event: guest.data as GuestShow };
}

/** Validate before any mutation. Identity is always taken from Auth, never the form. */
export function eventPayload(draft: EventDraft) {
  const title = draft.title.trim();
  if (!title || title.length > 120) throw new Error("Informe um nome de até 120 caracteres para o show.");
  const start = new Date(draft.startsAt);
  const end = draft.endsAt ? new Date(draft.endsAt) : null;
  if (!Number.isFinite(start.getTime()) || (end && !Number.isFinite(end.getTime())))
    throw new Error("Informe uma data e horário válidos.");
  if (end && end <= start) throw new Error("O término precisa ser depois do início.");
  return {
    title, description: draft.description.trim() || null,
    venue: draft.venue.trim() || null, venue_id: draft.venueId,
    city: draft.city.trim() || null,
    starts_at: start.toISOString(), ends_at: end?.toISOString() ?? null,
    status: draft.publicly ? "published" : "draft", show_publicly: draft.publicly,
  };
}

export async function saveEvent(db: AgendaClient, draft: EventDraft) {
  const payload = eventPayload(draft);
  const user = await currentUser(db);
  const { data, error } = await db.from("events").insert({ ...payload, producer_id: user.id }).select(eventColumns).single();
  if (error || !data) throw new Error("Não foi possível salvar o show. Tente novamente.");
  return data as EventRow;
}

export async function removeEvent(db: AgendaClient, eventId: string) {
  const user = await currentUser(db);
  const { data, error } = await db.from("events").delete()
    .eq("id", eventId).eq("producer_id", user.id).select("id").maybeSingle();
  if (error) throw new Error("Não foi possível excluir o show. Tente novamente.");
  if (!data) throw new Error("Show não encontrado ou sem permissão para excluir. Atualize a agenda.");
}

export async function catalogAvailable(db: AgendaClient, signal: AbortSignal) {
  const { error } = await db.from("cities").select("id").limit(1).abortSignal(signal);
  return !error;
}

export async function searchCities(db: AgendaClient, text: string, signal: AbortSignal): Promise<CitySuggestion[]> {
  const { data, error } = await db.from("cities").select("id,name,state_code").eq("active", true)
    .ilike("name", "%" + text.trim() + "%").order("name").limit(8).abortSignal(signal);
  if (error) return [];
  return data ?? [];
}

export async function searchVenues(db: AgendaClient, text: string, city: string, signal: AbortSignal): Promise<VenueSuggestion[]> {
  let query = db.from("venues").select("id,name,address,cities(name,state_code)")
    .eq("active", true).ilike("name", "%" + text.trim() + "%");
  const [cityName, state] = city.trim().split(" - ");
  if (cityName) {
    let cities = db.from("cities").select("id").eq("active", true).ilike("name", cityName.trim());
    if (state) cities = cities.eq("state_code", state.trim());
    const { data } = await cities.limit(1).abortSignal(signal);
    signal.throwIfAborted();
    if (data?.[0]) query = query.eq("city_id", data[0].id);
  }
  const { data, error } = await query.order("name").limit(8).abortSignal(signal);
  if (error) return [];
  type Row = { id: string; name: string; address: string | null; cities: { name: string; state_code: string } | null };
  return ((data ?? []) as unknown as Row[]).map(row => ({
    id: row.id, name: row.name, address: row.address,
    city_name: row.cities?.name ?? null, state_code: row.cities?.state_code ?? null,
  }));
}
