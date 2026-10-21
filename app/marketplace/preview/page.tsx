"use client";

import MarketplaceCatalog from "@/components/marketplace-catalog";

export default function MarketplaceLaboratory() {
  // Acesso verificado em duas camadas:
  // 1. O componente exige usuario na allowlist de preview.
  // 2. Todas as RPCs que acessam dados verificam a allowlist no Supabase.
  // Nao adicionar este componente na rota publica /marketplace sem autorizacao.
  return <MarketplaceCatalog preview/>;
}
