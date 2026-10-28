# Marketplace aberto com aviso de desenvolvimento — 28/10/2026

Autorização do proprietário: o menu Marketplace passa a abrir diretamente o catálogo em `/marketplace`, em vez de uma landing page de “Em breve”.

- `/marketplace`: catálogo público, com faixa colorida “Novidade em desenvolvimento”, CTA `Preparar meu portfólio` e âncora para os resultados.
- `/marketplace/preview`: laboratório com allowlist preservada; não desativar essa checagem.
- Painel: links de oportunidades apontam para o Marketplace público; remover textos antigos de bloqueio.
- Banco: para consultas públicas responderem `status: ok`, o proprietário autorizou a liberação de `stage_marketplace_control.launched=true` no projeto oficial. A trava RLS/opt-in/moderação continua obrigatória. Nenhuma migração ou alteração de planos decorre desta mudança de UI.
- Resumo do painel: a implantação da RPC `stage_workspace_overview` no banco oficial é um problema independente e deve ser verificada antes de publicação.
- Implantação: Vercel usa deploy manual, sem reativar deploy automático. Validar CI e publicar apenas o commit aprovado.

Rollback visual: restaurar a página anterior com o teaser. Se o lançamento público precisar ser suspenso, reverter `stage_marketplace_control.launched=false` no banco oficial; não apagar portfólios, favoritos, convites ou outras informações.
