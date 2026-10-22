"use client";

import { createClient } from "@/lib/supabase/client";

// Medição de alcance sem IP, cookies de rastreio, identificadores de visitante
// nem perfis individuais no banco. O armazenamento local serve APENAS para
// não contar novamente a mesma ação deste navegador no mesmo dia.
// Não é um mecanismo antifraude; os números são indicadores aproximados.
const inflight = new Set<string>();

function localDay(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function keyFor(surface: string, musician: string): string {
  return "sf-reach:v1:" + localDay() + ":" + surface + ":" + musician;
}

function wasCounted(key: string): boolean {
  if (inflight.has(key)) return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markCounted(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // O navegador pode bloquear storage privado. Contagem continua best-effort.
  }
}

export async function trackPublicPortfolioView(slug: string): Promise<void> {
  if (typeof window === "undefined" || !/^[a-z0-9-]{3,30}$/.test(slug)) return;
  const key = keyFor("portfolio", slug);
  if (wasCounted(key)) return;
  inflight.add(key);
  try {
    const { data, error } = await createClient().rpc(
      "stage_track_musician_portfolio_view", { p_slug: slug }
    );
    if (!error && (data === "recorded" || data === "ignored_owner")) {
      markCounted(key);
    }
  } catch {
    // Métricas jamais devem interromper o carregamento do portfólio público.
  } finally {
    inflight.delete(key);
  }
}

export type MarketplaceSurface = "search" | "featured" | "profile_open";

export async function trackMarketplaceExposure(
  ids: string[], surface: MarketplaceSurface
): Promise<void> {
  if (typeof window === "undefined" || ids.length === 0) return;

  const unique = Array.from(new Set(ids))
    .filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 18);
  const newIds = unique.filter(id => !wasCounted(keyFor(surface, id)));
  if (!newIds.length) return;

  for (const id of newIds) inflight.add(keyFor(surface, id));
  try {
    const { data, error } = await createClient().rpc(
      "stage_track_marketplace_metrics",
      { p_musician_ids: newIds, p_surface: surface }
    );
    if (!error && data?.status === "recorded") {
      for (const id of newIds) markCounted(keyFor(surface, id));
    }
  } catch {
    // Falhas do analytics não comprometem navegação, busca ou convite.
  } finally {
    for (const id of newIds) inflight.delete(keyFor(surface, id));
  }
}
