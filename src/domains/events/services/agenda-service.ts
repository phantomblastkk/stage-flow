import type { SupabaseClient } from "@supabase/supabase-js";
import type { CitySuggestion, EventDraft, EventRow, GuestShow, VenueSuggestion } from "../types";

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

export async function loadAgenda(db: AgendaClient, signal: AbortSignal) {
  const user = await currentUser(db, signal);
  const [owned, accepted] = await Promise.all([
    db.from("events").select(eventColumns).eq("producer_id", user.id)
      .order("starts_at", { ascending: true }).order("id", { ascending: true }).abortSignal(signal),
    db.rpc("stage_accepted_shows").abortSignal(signal),
  ]);
  signal.throwIfAborted();
  return {
    ownerId: user.id,
    events: !owned.error && Array.isArray(owned.data) ? owned.data as EventRow[] : null,
    guestShows: !accepted.error && Array.isArray(accepted.data) ? accepted.data as GuestShow[] : null,
  };
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
  const { error } = await db.from("events").insert({ ...payload, producer_id: user.id });
  if (error) throw new Error("Não foi possível salvar o show. Tente novamente.");
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
