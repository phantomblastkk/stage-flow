# StageFlow — QA de perfis públicos e cadastro (27/10/2026)

## Escopo e isolamento
- GitHub: `phantomblastkk/stage-flow`, branch `develop`; mudanças de código verificadas até `2750b2879865790ebb9d17479ee97017fd39eaec`.
- Vercel QA: projeto `stage-flow-homologacao` (`prj_5QIrtYibgORgIHuRIUIZ50Jawwgr`), domínio `https://stage-flow-homologacao.vercel.app`, deployment `dpl_GDUAkoaBb73MFU6SbahM3cEZo4xa` READY no SHA acima.
- Supabase QA: `zycuprhymoukhnuamtit`; marcador `ISOLATED_STAGE_FLOW_HOMOLOGATION_ONLY` confirmado.
- Não ocorreu merge na `main`, atualização do Vercel `stage-flow`, alteração do Supabase de produção ou ativação comercial/Asaas.
- O target `production` da Vercel foi usado exclusivamente **dentro do projeto separado de QA**, para carregar as variáveis de ambiente configuradas nesse projeto e atualizar seu domínio de teste.

## Defeito encontrado e correção
`public.handle_new_user()` definia `chosen_singer` e `chosen_musician` antes de resolver `chosen_kind`. Por causa do comportamento de NULL no PostgreSQL, contas artísticas novas poderiam falhar no INSERT dos campos booleanos NOT NULL de `public.profiles`.

- Atualizado o trecho no arquivo `supabase/account_identity_dual_roles_migration.sql` para novas instalações.
- Criada a correção idempotente `supabase/account_signup_role_initialization_fix_migration.sql` para ambientes já migrados.
- Migração `account_signup_role_initialization_fix` aplicada **somente ao Supabase QA**; confirmação posterior mostrou a atribuição de roles após a resolução do tipo artístico.
- Teste de regressão adicionado em `tests/account-identity-dual-roles.test.mjs`.

## Validações realizadas em SQL com ROLLBACK integral
Foi exigido o marcador exclusivo de homologação antes de cada conjunto de mutações de teste. Inserções temporárias em `auth.users` acionaram o trigger real `on_auth_user_created`.

1. Cadastro de cantor gratuito: `is_singer=true`, `is_musician=false`, plano `free`.
2. Cadastro de músico: `is_singer=false`, `is_musician=true`.
3. Cadastro híbrido: ambas as flags verdadeiras; nenhum plano pago.
4. Cadastro de produtor puro: flags artísticas falsas, `is_producer=true`.
5. Perfil de cantor não publicado não é retornado pela RPC pública; depois de marcar como público **dentro da transação**, passa a ser retornado.
6. Perfil gratuito publicado entra em `stage_public_singer_sitemap` e continua sem snapshot Pro; nenhuma liberação paga foi simulada.
7. `stage_account_enable_role('musician')` converte uma conta de cantor em híbrida; `stage_my_account_identity` confirma os dois papéis.
8. `stage_update_account_identity` aceita a primeira edição de nome e recusa a segunda com `name_cooldown` (60 dias).
9. `stage_save_musician_portfolio_v3` publica um portfólio temporário; `stage_public_musician_portfolio` devolve o slug público sem chaves de e-mail, telefone ou ID privado.
10. Cada transação foi revertida; verificação final: 1 perfil pré-existente no QA, 0 usuários sintéticos remanescentes, 0 portfólios e 0 snapshots Pro publicados.

## Compilação e publicação QA
- CI `Stage Flow • Integration and build` no commit `2750b287`: **success** (testes, TypeScript e Next.js build).
  https://github.com/phantomblastkk/stage-flow/actions/runs/40553591720
- Deployment manual do projeto QA: **READY**, SHA confirmado por inspeção do domínio de homologação.
- A Vercel mantém `ssoProtection.enabled=true` com `deploymentType=all_except_custom_domains`. A rota HTTP externa não pôde ser inspecionada pelo acesso disponível; não declarar teste visual/browser completo.

## Pendências para homologação visual
- Com sessão autorizada da Vercel, testar em navegador e celular: `/minha-conta`, `/cadastro`, `/<arroba>`, `/pro/<arroba>`, `/musico/<slug>` e as prévias ao compartilhar no WhatsApp.
- Criar ou publicar perfis **somente de teste**, mediante fluxo normal de autenticação, se for necessário cobrir interface e URLs reais.
- Testar Pro autorizado somente com direito de teste legítimo; não liberar assinatura/Asaas para forçar esse cenário.
- Verificar regras de 60 dias, alternância de papel, compartilhamento, prévia Open Graph, blur de conteúdos Pro e o comportamento em telas menores.
- O Security Advisor de QA também lista avisos amplos de funções `SECURITY DEFINER` executáveis por `anon` e tabelas com RLS sem policy. Fazer auditoria de privilégios por rotina antes de considerar resolvidos ou explorar mudanças em produção.

**Produção:** não atualizar sem autorização expressa, nova verificação de SHA e validação da migração de cadastro.
