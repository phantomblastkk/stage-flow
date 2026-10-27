"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { createAccountStore } from "./account-store";
import type { AccountSnapshot } from "./account-types";

type AccountContextValue = { snapshot: AccountSnapshot; refresh: () => Promise<void> };
const AccountContext = createContext<AccountContextValue | null>(null);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createAccountStore(createClient));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    void store.start();
    const visible = () => {
      const value = store.getSnapshot();
      if (document.visibilityState === "visible" && value.status === "ready" && !value.refreshing
        && Date.now() - value.verifiedAt > 60000) void store.refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => { document.removeEventListener("visibilitychange", visible);store.stop(); };
  }, [store]);
  return <AccountContext.Provider value={{ snapshot, refresh: store.refresh }}>{children}</AccountContext.Provider>;
}
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("AccountProvider is required for private workspace pages.");
  return value;
}
