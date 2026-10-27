# Perfil público único do cantor e política de deploy manual

## URL canônica e acesso gratuito
- O perfil público do cantor é `/<arroba>`; ele já usa a identidade visual premium (hero, agenda, contato, redes sociais e seções do site).
- O endereço legado `/pro/<arroba>` redireciona permanentemente para `/<arroba>`, sem exigir assinatura Pro.
- A página só mostra informações que a própria conta publicou; um perfil privado continua indisponível ao visitante.
- Sem um snapshot Pro **publicado e autorizado** retornado pela RPC `stage_public_pro_artist_site`, o frontend chama somente `stage_public_artist_page`, `stage_public_artist_events` e `stage_public_artist_accepts_bookings`. Galerias exclusivas aparecem com **exemplos fictícios desfocados**, nunca com mídia privada, e direcionam para `/planos`.
- Quando existe publicação Pro autorizada, as seções de galeria usam exclusivamente o snapshot público, com limite de três fotos e três vídeos e as verificações de acesso existentes no Supabase. Despublicar a versão Pro não despublica o perfil gratuito.
- Metadados Open Graph e Twitter são gerados apenas dos dados públicos de artista. Nenhuma chave de serviço ou dados de galeria privada é consultada para gerar metadados gratuitos.
- A área de edição artística informa o link único `/<arroba>`. A tela de publicação Pro passa a compartilhar esse endereço, mesmo quando o Pro é ativado depois.

## Desativação de deploys automáticos
- Em `vercel.json` está `git.deploymentEnabled.main=false` e `git.deploymentEnabled.develop=false`, conforme a [documentação oficial](https://vercel.com/docs/project-configuration/git-configuration).
- O projeto Vercel de produção também recebeu uma configuração de *Ignored Build Step* para não construir em pushes sem um desbloqueio explícito. A configuração precisa ser revista/removida antes de um deploy manual autorizado. **Não executar deploy manual na produção sem autorização do usuário.**
- Workflow GitHub Actions apenas compila e testa em `develop`. Os deploys de QA são manuais.
- Mesclar mudanças na `main` não autoriza atualizar o domínio original. Quando o usuário aprovar a publicação, confirmar SHA, projeto de produção, estado do Supabase e executar um deploy manual, seguido de testes de URLs.

## Verificação
- `tests/singer-public-site.test.mjs` valida URL única, fallback gratuito, blur, links de planos, consulta pública e bloqueio dos deploys automáticos.
- CI executa também o TypeScript e `npm run build`.
- Teste HTTP da URL canônica e do redirecionamento `/pro/<arroba>` deve ser feito no QA. Testes visuais de perfis publicados exigem um perfil de teste público; sem um perfil público no QA, não afirmar que a galeria foi testada visualmente.
- Em produção, o número de publicações Pro está zerado no momento desta correção. Não liberar Pro ou editar planos/assinaturas só para fazer o endereço funcionar.
