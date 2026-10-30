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
  const [realtimeConnected,setRealtimeConnected]=useState(false);
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
    const onRealtime=(event:Event)=>{
      const {threadId}=(event as CustomEvent<{threadId:string|null}>).detail||{};
      if((threadId===activeId||threadId===null)&&document.visibilityState==="visible")
        void loadMessages(activeId,true);
    };
    // A slower watchdog reconciles missed events; fast polling is kept if the
    // private channel has not authenticated or the phone is offline.
    const timer = setInterval(refresh, realtimeConnected?45000:8000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("stageflow:chat-updated",onRealtime);
    return () => { mounted.current = false;clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("stageflow:chat-updated",onRealtime);
      request.current?.abort();request.current = null; };
  }, [activeId, loadMessages,realtimeConnected]);
  useEffect(()=>{
    const update=(event:Event)=>{
      setRealtimeConnected(Boolean((event as CustomEvent<{connected:boolean}>).detail?.connected));
    };
    setRealtimeConnected(document.documentElement.dataset.stageflowRealtime==="connected");
    window.addEventListener("stageflow:realtime-status",update);
    return()=>window.removeEventListener("stageflow:realtime-status",update);
  },[]);
  const setText = useCallback((value: string) => {
    if (activeId) setDrafts(previous => ({ ...previous, [activeId]: value }));
  }, [activeId]);
  // Mask the previous thread during the render before the selection effect runs.
  return { messages: snapshot.id === activeId ? snapshot.items : [],
    messagesLoading: Boolean(activeId && (snapshot.id !== activeId || snapshot.loading)),
    messagesError: snapshot.id === activeId ? snapshot.error : "",
    text: activeId ? drafts[activeId] ?? "" : "", setText, loadMessages,realtimeConnected };
}
