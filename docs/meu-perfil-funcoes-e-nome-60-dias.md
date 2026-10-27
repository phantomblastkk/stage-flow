# Meu perfil — contas de cantor + músico

Atualização: 27/10/2026.

## Interface

- No painel `/painel`, o botão **Meu perfil** aparece ao lado de **Avisos** e leva a `/minha-conta` (responsivo para celular).
- `/minha-conta`: duas seções independentes, com perfil público e editor de **cantor** (`/<arroba>`, `/meu-perfil-artistico`) e de **músico** (`/musico/<slug>`, `/meu-portfolio`). Links públicos só aparecem quando o perfil correspondente estiver publicado.
- Cadastro `/cadastro` como cantor: checkbox **Também sou músico**, liberando portfólio gratuito, convites e recursos de instrumentista na mesma conta; não há cobrança nem criação de um segundo login.
- Funções podem ser ativadas posteriormente na central Meu perfil: **Ativar função de cantor** ou **Ativar função de músico**. A escolha de qual painel priorizar é separada da autorização de cada função.
- Perfil de produtor permanece independente. Nada disso concede Pro, subdomínio ou libera marketplace que esteja fechado.

## Regra de nome / arroba

- `display_name` e `username` possuem relógios independentes: depois de alterados, **60 dias** de espera para mudar novamente.
- O cadastro inicial não consome o direito de alteração, mas a primeira edição registrada inicia o prazo.
- As verificações ficam no banco por gatilho **BEFORE UPDATE**, protegendo inclusive chamadas diretas de API e impedindo que o usuário zere os carimbos de alteração.
- Os dois nomes podem ser atualizados no `/minha-conta`, quando elegíveis. `@minha-conta` é reservado e não pode ser escolhido por usuários.
- Mudanças do @ podem quebrar links antigos; antes de alterar, o editor informa a consequência. O portfólio de músico tem slug público próprio e independente.

## Migrações

Aplicar **na ordem**:
1. `supabase/account_identity_dual_roles_migration.sql`
2. `supabase/account_identity_role_guards_migration.sql`
3. `supabase/account_profile_reserved_route_migration.sql`

Pré-requisitos: `artist_account_experience_migration.sql`, `musician_portfolios_migration.sql`, `musician_portfolio_appearance_migration.sql`, `musician_portfolio_complete_migration.sql` e `marketplace_private_launch_migration.sql`. No QA, dependências ausentes foram instaladas previamente.

A migração é preservadora: artistas existentes com experiência `support` recebem função músico; cantores `lead` recebem função cantor; cantores com portfólio pré-existente também recebem função músico. As assinaturas não são tocadas.

## Validação

- CI executa `tests/account-identity-dual-roles.test.mjs`, TypeScript e build Next.js.
- Teste de integração Supabase QA realizado em transação revertida: ativar função músico em conta de cantor, alternar experiências, alterar nome e @, recusar segunda alteração dentro dos 60 dias; testar músico sem função de cantor tentando trocar experiência e arroba; testar bloqueio de alterações diretas de papel por usuário autenticado.
- Após migração para produção, repetir consulta de integridade e abrir no navegador real `/painel` e `/minha-conta`. Não expor senhas nem dados pessoais em relatórios de teste.
