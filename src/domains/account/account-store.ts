import type { SupabaseClient, AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { AccountProfile, AccountSnapshot } from "./account-types";

type AccountClient = Pick<SupabaseClient, "auth" | "from" | "rpc">;
// Only the empty snapshot is shared. User data lives inside each mounted provider's store.
const EMPTY: AccountSnapshot = Object.freeze({ status: "loading", user: null, profile: null,
  permissions: Object.freeze({ isOwnerAdmin: false, partnerHouseCount: 0 }), epoch: 0, refreshing: false, error: "", verifiedAt: 0 });
const profileColumns = "id,role,is_artist,is_producer,is_singer,is_musician,artist_kind,display_name,username,city,is_public,artist_avatar_path";

function unchanged<T extends object>(old: T | null, next: T): T {
  return old && Object.keys(next).every(key => old[key as keyof T] === next[key as keyof T]) ? old : next;
}

/** Per-provider presentation data. Never used as server/RLS authorization or persisted in storage. */
export function createAccountStore(getClient: () => AccountClient) {
  let state = EMPTY, running = false, generation = 0, lifecycle = 0;
  let client: AccountClient | null = null, request: AbortController | null = null;
  let hint: string | null | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const emit = (next: AccountSnapshot) => {
    if (next.user) Object.freeze(next.user);
    if (next.profile) Object.freeze(next.profile);
    Object.freeze(next.permissions);state = Object.freeze(next);
    listeners.forEach(listener => listener());
  };
  const clearTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const invalidate = (status: "loading" | "signed_out") => {
    generation++; request?.abort(); clearTimer();
    emit({ ...EMPTY, status, epoch: state.epoch + 1 });
  };

  async function refresh() {
    if (!running || !client) return;
    clearTimer();request?.abort();
    const signal = new AbortController();request = signal;
    const version = ++generation, db = client;
    const current = () => running && version === generation && !signal.signal.aborted;
    emit({ ...state, refreshing: true, error: "" });
    try {
      const { data: { user }, error } = await db.auth.getUser();
      if (!current()) return;
      if (!user && (!error || error.name === "AuthSessionMissingError")) {
        hint = null;invalidate("signed_out");return;
      }
      if (error || !user) throw new Error("Não foi possível validar sua conta agora. Sua sessão não foi encerrada. Confira a conexão e tente novamente.");
      const nextUser = { id: user.id, email: user.email ?? null };
      if (state.user?.id !== user.id) {
        const epoch = hint === user.id ? state.epoch : state.epoch + 1;
        hint = user.id;
        emit({ ...EMPTY, user: nextUser, epoch, refreshing: true });
      }
      const [profile, partner, owner] = await Promise.all([
        db.from("profiles").select(profileColumns).eq("id", user.id).abortSignal(signal.signal).maybeSingle(),
        db.rpc("stage_venue_partner_access").abortSignal(signal.signal),
        db.rpc("stage_owner_admin_status").abortSignal(signal.signal),
      ]);
      if (!current()) return;
      if (profile.error) throw new Error("Não foi possível atualizar seu perfil. Tente novamente.");
      if (!profile.data || profile.data.id !== user.id) {
        emit({ ...EMPTY, status: "error", user: nextUser, epoch: state.epoch,
          error: "Sua conta está autenticada, mas o perfil não foi encontrado. Tente atualizar a conta." });return;
      }
      const data = { ...profile.data } as AccountProfile;
      const access = partner.data as { status?: string; items?: unknown[] } | null;
      const permissions = { isOwnerAdmin: !owner.error && owner.data === true,
        partnerHouseCount: !partner.error && access?.status === "ok" && Array.isArray(access.items) ? access.items.length : 0 };
      hint = user.id;
      emit({ status: "ready", user: unchanged(state.user, nextUser), profile: unchanged(state.profile, data),
        permissions: unchanged(state.permissions, permissions), epoch: state.epoch,
        refreshing: false, error: "", verifiedAt: Date.now() });
    } catch (error) {
      if (!current()) return;
      const message = error instanceof Error ? error.message : "Não foi possível carregar sua conta. Tente novamente.";
      if (state.status === "ready" && state.profile && state.user?.id === hint)
        emit({ ...state, refreshing: false, error: message });
      else emit({ ...state, status: "error", profile: null, permissions: EMPTY.permissions, refreshing: false, error: message });
    }
  }

  function authChanged(event: AuthChangeEvent, session: Session | null) {
    // Synchronous only. Session identity is an invalidation hint, never validated account data.
    if (event === "INITIAL_SESSION") return;
    if (event === "SIGNED_OUT") { hint = null;invalidate("signed_out");return; }
    const next = session?.user.id ?? null;
    if (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED" && event !== "USER_UPDATED") return;
    if (next === hint && event !== "USER_UPDATED" && (state.status === "ready" || state.status === "loading")) return;
    if (next !== hint) { hint = next;invalidate("loading"); }
    // Supabase callbacks run under the Auth lock. Query only in a later task.
    clearTimer();timer = setTimeout(() => { timer = null;void refresh(); }, 0);
  }

  async function start() {
      if (running) return;
      running = true;const version = ++lifecycle;
      try {
        client = getClient();
        const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
          if (running && version === lifecycle) authChanged(event, session);
        });
        unsubscribe = () => subscription.unsubscribe();
        await refresh();
      } catch {
        if (running && version === lifecycle) {
          running = false;unsubscribe?.();unsubscribe = null;client = null;
          emit({ ...EMPTY, status: "error", epoch: state.epoch, error: "Não foi possível iniciar sua conta. Atualize a página e tente novamente." });
        }
      }
  }
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => EMPTY,
    subscribe: (listener: () => void) => { listeners.add(listener);return () => { listeners.delete(listener); }; },
    start,
    refresh: () => running && client ? refresh() : start(),
    stop: () => {
      running = false;lifecycle++;generation++;request?.abort();clearTimer();unsubscribe?.();unsubscribe = null;client = null;
      hint = undefined;state = { ...EMPTY, epoch: state.epoch + 1 };
    },
  };
}
