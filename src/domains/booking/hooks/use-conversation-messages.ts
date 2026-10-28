"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadThreadMessages } from "../services/booking-service";
import type { Message } from "../types";

export function useConversationMessages(activeId: string | null) {
  const selected = useRef(activeId);selected.current = activeId;
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<{ id: string | null;items: Message[];loading: boolean;error: string }>(
    { id: null, items: [], loading: false, error: "" });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const loadMessages = useCallback(async (id: string, background = false) => {
    if (!mounted.current || selected.current !== id || (background && request.current)) return;
    request.current?.abort();const next = new AbortController();request.current = next;
    setSnapshot(previous => previous.id === id ? { ...previous, loading: !background, error: "" }
      : { id, items: [], loading: true, error: "" });
    try {
      const items = await loadThreadMessages(createClient(), id, next.signal);
      if (!next.signal.aborted && selected.current === id) setSnapshot({ id, items, loading: false, error: "" });
    } catch (error) {
      if (!next.signal.aborted && selected.current === id) setSnapshot(previous => ({ ...previous, id, loading: false,
        error: error instanceof Error ? error.message : "Não foi possível atualizar as mensagens." }));
    } finally { if (request.current === next) request.current = null; }
  }, []);
  useEffect(() => {
    if (!activeId) return;
    mounted.current = true;
    void loadMessages(activeId);
    const refresh = () => { if (document.visibilityState === "visible") void loadMessages(activeId, true); };
    const timer = setInterval(refresh, 8000);
    document.addEventListener("visibilitychange", refresh);
    return () => { mounted.current = false;clearInterval(timer);document.removeEventListener("visibilitychange", refresh);request.current?.abort();request.current = null; };
  }, [activeId, loadMessages]);
  const setText = useCallback((value: string) => {
    if (activeId) setDrafts(previous => ({ ...previous, [activeId]: value }));
  }, [activeId]);
  // Mask the previous thread during the render before the selection effect runs.
  return { messages: snapshot.id === activeId ? snapshot.items : [],
    messagesLoading: Boolean(activeId && (snapshot.id !== activeId || snapshot.loading)),
    messagesError: snapshot.id === activeId ? snapshot.error : "",
    text: activeId ? drafts[activeId] ?? "" : "", setText, loadMessages };
}
