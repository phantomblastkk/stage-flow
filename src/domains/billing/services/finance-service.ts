import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organized, Participation, TeamMember } from "../types";

type BillingClient = Pick<SupabaseClient, "auth" | "from" | "rpc">;
export class FinanceSessionRequired extends Error {
  constructor() { super("Entre na sua conta para acessar o financeiro."); }
}

async function currentUser(db: BillingClient, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { data: { user }, error } = await db.auth.getUser();
  signal?.throwIfAborted();
  if (!user && (!error || error.name === "AuthSessionMissingError")) throw new FinanceSessionRequired();
  if (error || !user) throw new Error("Não foi possível validar sua sessão. Confira a conexão e tente novamente.");
  return user;
}

/** RPCs retain ownership/financial authorization. Never sum a single UI page as a total. */
export async function loadFinance(db: BillingClient, signal: AbortSignal) {
  const user = await currentUser(db, signal);
  const [ownerResult, historyResult, profileResult] = await Promise.all([
    db.rpc("stage_finance_organizer_overview").abortSignal(signal),
    db.rpc("stage_my_show_history").abortSignal(signal),
    db.from("profiles").select("is_artist,artist_kind,username").eq("id", user.id).abortSignal(signal).maybeSingle(),
  ]);
  signal.throwIfAborted();
  if (ownerResult.error || historyResult.error || !Array.isArray(ownerResult.data) || !Array.isArray(historyResult.data))
    throw new Error("Não foi possível carregar o financeiro. Tente novamente.");
  if (profileResult.error || !profileResult.data) throw new Error("Não foi possível consultar seu perfil financeiro.");
  const profile = profileResult.data;
  const isSinger = profile.is_artist === true && (profile.artist_kind === "lead" ||
    (profile.artist_kind == null && Boolean(profile.username)));
  let reportAccess = !isSinger;
  if (isSinger) {
    const { data: entitlement, error: entitlementError } = await db.rpc("stage_my_pro_site_publication").abortSignal(signal);
    signal.throwIfAborted();
    reportAccess = !entitlementError && entitlement?.entitled === true;
  }
  const organized = ownerResult.data as Organized[];
  const participations = (historyResult.data as Participation[]).filter(row => row.kind === "participation");
  // Existing JSON RPCs cap the organizer snapshot at 400 and participation source at 300.
  // At the boundary we cannot establish completeness, so report it explicitly.
  const coverageLimited = organized.length >= 400 || participations.length >= 300;
  return { ownerId: user.id, organized, participations, reportAccess, coverageLimited };
}

export async function loadFinanceTeam(db: BillingClient, eventId: string, signal: AbortSignal) {
  await currentUser(db, signal);
  const { data, error } = await db.rpc("stage_finance_event_team", { p_event_id: eventId }).abortSignal(signal);
  signal.throwIfAborted();
  if (error || data?.status !== "ok" || !Array.isArray(data.items))
    throw new Error("Não foi possível carregar os pagamentos da equipe. Tente novamente.");
  return data.items as TeamMember[];
}

/** A bookkeeping RPC only: this never transfers money or writes financial tables directly. */
export async function saveMusicianPayment(db: BillingClient, invitationId: string, amount: number) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 9999999.99 || Number(amount.toFixed(2)) !== amount)
    throw new Error("Valor inválido: use reais e até duas casas decimais.");
  await currentUser(db);
  const { data, error } = await db.rpc("stage_finance_save_musician_payment", {
    p_invitation_id: invitationId, p_paid: amount,
  });
  if (error || data !== "saved") throw new Error(data === "amount_exceeds_agreed"
    ? "O valor pago informado não pode superar o cachê acordado." : "Não foi possível salvar o pagamento. Tente novamente.");
}
