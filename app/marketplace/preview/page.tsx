"use client";

import MarketplaceCatalog from "@/components/marketplace-catalog";

export default function MarketplaceLaboratory() {
  // Acesso verificado em duas camadas:
  // 1. O componente exige usuario na allowlist de preview.
  // 2. Todas as RPCs que acessam dados verificam a allowlist no Supabase.
  // A rota publica /marketplace foi autorizada; este laboratório permanece com allowlist.
  return <MarketplaceCatalog preview/>;
}
