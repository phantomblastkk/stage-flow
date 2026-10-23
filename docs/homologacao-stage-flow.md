# Stage Flow — ambiente de HOMOLOGAÇÃO sem tocar na produção

**Situação:** pacote preparado na branch `develop`, mas **nenhum projeto Supabase/Vercel de homologação foi criado, conectado ou publicado automaticamente**. Nome oficial do estabelecimento de referência: **Deck Espeto Bar**.

## Como estamos testando agora (sem nenhuma credencial)
- `.github/workflows/venue-staging-db.yml`: inicializa um PostgreSQL temporário do GitHub Actions.
- `tests/homologation/postgres-shim.sql`: cria SOMENTE no banco descartável uma emulação mínima de tabelas Auth/Storage. **NUNCA executar esse arquivo no Supabase verdadeiro**.
- Aplica `supabase/schema.sql`, catálogo de casas, migrações de casa oficial, calendário e acessos delegados.
- `tests/homologation/seed-venues.sql` cria **Deck Espeto Bar — HOMOLOGAÇÃO** e **Casa B — HOMOLOGAÇÃO**.
- `tests/homologation/verify-venues.sql` confere a agenda da casa, destaque, sigilo de rascunhos, casa distinta e sugestões.
- `tests/sql/venue-partner-isolation.sql` simula um gestor com acesso só ao Deck e rejeita alterações indevidas na Casa B. Usa `ROLLBACK`.
- O banco temporário é destruído depois do job. **Isto não cria ambiente navegável, não valida o Auth/Storage reais nem envolve Vercel.**

## Próxima ativação: Supabase REAL, porém separado
1. No [Supabase Dashboard](https://supabase.com/dashboard), criar um **novo projeto de teste do Stage Flow**, ou uma *persistent branch* isolada se o plano permitir. Não reutilizar banco de produção e nem o banco do projeto separado de reservas Deck Espeto Bar.
2. Em um projeto novo, NÃO supor que o Stage Flow inteiro está pronto só com os SQLs abaixo. Há outras migrações do projeto para cadastros, artistas e convites. Para homologar o aplicativo inteiro, é necessário reconciliar e aplicar sua sequência completa de migrações ou clonar o histórico de schema usando branching.
3. Para homologar **somente o módulo de casas** em um banco de teste limpo, a sequência coberta pelo CI é:
   - `supabase/schema.sql` (apenas se for banco limpo sem schema inicial);
   - `supabase/venues_catalog_migration.sql`;
   - `supabase/venues_catalog_contributions.sql`;
   - `supabase/venues_deduplication_migration.sql`;
   - `supabase/venue_admin_migration.sql`;
   - `supabase/venue_calendar_gallery_suggestions_migration.sql`;
   - `supabase/venue_partner_management_migration.sql`.
4. Confirme **no topo do Supabase Dashboard** que o projeto selecionado é o de teste, e não o real. Só então, se precisar inserir os dados fictícios, rode `tests/homologation/enable-fixtures-on-qa.sql`, seguido de `tests/homologation/seed-venues.sql`. O seed **se recusa a rodar sem marcador de homologação**. Não rode no projeto principal.
5. Para testar com usuários reais de QA, crie contas novas de teste pelo fluxo Auth e autorize somente a conta que será admin via `stage_venue_admins`. Vincule o gerente ao Deck pelo painel e execute os cenários de `tests/README-venue-security.md`. Não copie os usuários reais.
6. No Supabase de teste, verificar upload real de **flyer e galeria**, permissões do Storage, submissão pública de sugestões, listagem do mês e login do gestor. O teste Postgres com shim não cobre esses serviços.

## Configuração local do Stage Flow QA
- `.env.homologation.example` tem apenas placeholders.
- Crie **seu próprio** `.env.local` local com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` **do novo banco isolado** e `NEXT_PUBLIC_STAGE_FLOW_ENV=homologation`.
- Não comitar `.env.local`, tokens de acesso ou chaves service_role. Use apenas chave publicável/anônima no navegador.
- A tela exibirá uma faixa **AMBIENTE DE HOMOLOGAÇÃO** quando `NEXT_PUBLIC_STAGE_FLOW_ENV=homologation`.
- O build do GitHub usa credenciais fictícias somente para compilação; **nunca conecta ao Supabase verdadeiro**.

## Quando quisermos testar a interface na Vercel
- Criar um projeto **Stage Flow - Homologação** separado do projeto principal, apontando a branch `develop` e configurando os valores *Preview* com o Supabase **de teste**, somente depois de verificar isolamento de DB.
- Alternativa: preview da `develop` em projeto atual com env Vars vinculadas à branch. Cuidado: previews do projeto atual podem herdar variáveis de produção, então a opção de projeto Vercel separado reduz risco de erro.
- **NÃO conectamos a Vercel agora e NÃO reativamos os deployments**; o `vercel.json` continua bloqueando deploy automático da `develop`.
- Quando a homologação terminar, validar banco real, navegação mobile, uploads, autenticação e permissões, e só então planejar merge em `main` e deployment único.

## Critérios de aceite
- [ ] Migrações das casas passam no PostgreSQL descartável do GitHub Actions
- [ ] Deck e Casa B aparecem isoladamente, com shows separados
- [ ] Rascunhos e sugestões privadas não aparecem na página pública
- [ ] Gestor Deck não consegue criar/editar/excluir conteúdo na Casa B
- [ ] Build e testes estáticos continuam passando
- [ ] **Pendente:** banco Supabase independente com Auth/Storage reais
- [ ] **Pendente:** visual mobile e uploads em ambiente navegável de QA
- [ ] **Pendente:** deploy da versão de teste e, mais tarde, produção
