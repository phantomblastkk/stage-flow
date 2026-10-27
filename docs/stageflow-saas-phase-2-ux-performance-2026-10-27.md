# StageFlow — Parte 2: execução incremental SaaS (27/10/2026)

> **Fonte de verdade:** `main`, Supabase de homologação `zycuprhymoukhnuamtit`; **sem deploy automático**. Alterações no banco oficial somente após comparação das políticas e autorização de release. O objetivo de 100 mil usuários NÃO é uma capacidade demonstrada neste momento.

## Primeiro: o que JÁ estava feito ao iniciar esta parte

Estado encontrado na `main`: 288 arquivos versionados, **40 rotas de página** no App Router e **48 arquivos CSS**.

| Item solicitado | Estado verificado |
|---|---|
| Navegação consolidada | Já existe `src/domains/navigation/workspace-navigation.ts` com Início, Agenda, Contratações, Negócios, Perfil e Configurações; antigas URLs preservadas |
| Dashboard | Já existe `src/domains/dashboard/components/workspace-overview.tsx` com shows da semana, convites, conversas, financeiro informado manualmente, agenda e activity feed |
| SQL autenticado do dashboard | `stage_workspace_overview()` instalado **em QA**, ausente em produção; não aplicar UI nova isoladamente |
| Feed | Combina notificações privadas, aceite de convites, contatos, verificações e recebimentos **registrados** — não é confirmação de pagamento pelo Asaas |
| Design System | 15 componentes + Textarea em `src/components/ui/index.tsx`; tokens CSS com prefixo `sf-ui-` |
| Arquitetura por domínio | Iniciada em `src/domains/navigation` e `src/domains/dashboard`; páginas antigas ainda concentram regra, consulta e estado |
| Mobile | Sidebar e drawer no dashboard, barra inferior e safe areas; outras rotas ainda não compartilham um shell persistente |
| SEO | `robots.ts`, `sitemap.ts`, canonical e OG existentes; sitemap inclui cantores, ainda não a totalidade de casas/músicos |
| Marketplace | `/marketplace` ainda é tela **Em breve**, portanto nenhum matching de artistas está disponível nesse endereço |

**Risco central:** 40 páginas continuam existentes porque agrupamento de navegação != consolidação de telas. Mover arquivos de rota por inteiro antes de separar serviços e autenticação criaria regressões.

## Wireframe implementado como continuação (não refazer o primeiro painel)

```text
DESKTOP                          CELULAR
┌─────────┬─────────────────┐    ┌──────────────────────┐
│ Início  │ Olá, artista!   │    │ Campainha  Foto      │
│ Agenda  │ [4 indicadores] │    │ Olá, artista!        │
│ Contr.  │                 │    │ [2 x 2 indicadores]  │
│ Negócio │ PRÓXIMA AÇÃO    │    │ PRÓXIMA AÇÃO         │
│ Perfil  │ [Responder ...] │    │ [Responder ...]      │
│ Config. │ Sua jornada     │    │ Sua jornada          │
│         │ Shows | Feed    │    │ Shows                │
│         │ Acessos rápidos │    │ Feed                 │
└─────────┴─────────────────┘    │ [Início ... Conta]   │
                                 └──────────────────────┘
```

## Problema → impacto → solução aplicada (Parte 2)

### UX e dashboard
**Problema:** os indicadores mostram pendências, mas nem sempre respondem à pergunta "o que fazer agora?". Enquanto carrega, o componente exibia indevidamente listas vazias de atividades e shows.

**Impacto:** cliques extras, percepção errada de agenda vazia e baixa orientação de primeiro uso.

**Aplicado:**
- `src/domains/dashboard/components/workspace-next-step.tsx` prioriza, nessa ordem, convite pendente para músico, pedido de contratação para cantor, conversas não lidas, shows próximos, cuidado do portfólio ou descoberta de talentos. Usa **o snapshot já carregado**, sem novo RPC.
- Exibe uma sequência de acesso rápido contextual (portfólio → disponibilidade → convites para músico; perfil → agenda → solicitações para cantor; marketplace → convites → shows para contratante).
- `src/domains/dashboard/components/workspace-overview.tsx` só mostra o feed e a lista de shows quando há snapshot real; erros não se disfarçam de "Tudo em dia".
- `workspace-shell.css`: painel responsivo, contraste, toque mínimo e teclado, com estilos escopados.

### Mobile e acessibilidade da navegação
**Problema:** o menu em forma de drawer prendia a rolagem, mas não isolava a navegação por teclado do fundo.

**Impacto:** usuários de teclado podiam navegar para elementos ocultos; contexto confuso no celular.

**Aplicado:** `workspace-sidebar.tsx` trata drawer como dialog modal, envia o foco ao botão fechar, faz o ciclo de Tab/Shift+Tab, permite Escape e restaura o foco ao gatilho; músicos recebem acesso rápido a convites na barra inferior.

### Design System
**Problema:** `Tabs` simulava uma tablist visual sem navegação por setas; campos tinham textos de erro não associados pelo `aria-describedby`; Button poderia submeter um formulário sem intenção.

**Aplicado:** `src/components/ui/index.tsx` recebeu teclado Left/Right/Home/End, roving tabindex, `aria-controls` opcional, IDs vinculados para ajuda/erro e `type=button` por padrão (o tipo submit continua suportado explicitamente). Primitives permanecem reutilizáveis para adoção gradual nas próximas rotas.

### Activity feed e performance SQL
**Problema:** a versão anterior consultava histórico potencialmente extenso de seis fontes e limitava somente depois do UNION.

**Aplicado:** `stage_workspace_activity_bounded_migration.sql` limita a **oito itens recentes por origem** antes da fusão, chegando a até **48 candidatos** e retornando somente oito na timeline. A origem permanece filtrada por `auth.uid()`, e o EXECUTE fica restrito a `authenticated`. Migração aplicada e função exercitada em QA; ainda precisamos medir `p95` e analisar planos em volumes de dados reais para garantir execução rápida das consultas individuais.

### RLS e índices Supabase
Advisors QA observados e revistos depois das migrações:

| Aviso | Antes desta parte | Depois |
|---|---:|---:|
| RLS auth initplan | 8 | **0** |
| FKs sem índice de suporte | 22 | **19** |
| Políticas permissivas sobrepostas | 1 | 1 — sobreposição de SELECT para show próprio e show público precisa de revisão funcional |
| Índices sem uso observado | 19 | 22 — três índices recém-criados; não interpretar falta de uso em QA como inutilidade |

- `stage_workspace_rls_events_invitations_migration.sql` preserva os predicados de posse para SELECT/INSERT/UPDATE/DELETE de `events` e `invitations`; apenas usa `(select auth.uid())` para não recalcular por linha.
- Cria três índices de apoio a FKs no fluxo de contratação (`stage_hiring_proposals.musician_id`, `.requester_id`, `stage_hiring_threads.event_id`).
- `stage_workspace_venue_submit_rls_optimization.sql` preserva a proteção `submitted_by=auth.uid()` para cadastro de casas.
- **Tudo aplicado apenas em QA.** Antes de aplicar no banco oficial: comparar `pg_policies`, constraints, índices e carga; executar migrações separadamente, nunca por pipeline de CI.
- Advisors de segurança também mantêm itens de `SECURITY DEFINER` acessíveis em funções públicas e recomendação de proteção de senha vazada. Essas funções exigem revisão uma a uma: revogar acesso anon de RPC pública indiscriminadamente quebraria perfis.

## Diffs auditáveis desta parte

Usar o comparador GitHub: `https://github.com/phantomblastkk/stage-flow/compare/8feaccd3188738ea7a633109b1533011e2b681e5...main`.

| Arquivo | Mudança |
|---|---|
| `src/domains/navigation/components/workspace-sidebar.tsx` | Foco modal + atalho de convites |
| `src/components/ui/index.tsx` | Correções teclado/tabs/formulários |
| `src/domains/dashboard/components/workspace-next-step.tsx` | Novo, ação contextual e jornada |
| `src/domains/dashboard/components/workspace-overview.tsx` | Uso do próximo passo, ausência de falso feed vazio |
| `src/domains/navigation/components/workspace-shell.css` | Painel mobile responsivo de próxima ação |
| `supabase/stage_workspace_activity_bounded_migration.sql` | Query por fonte limitada + privacidade |
| `supabase/stage_workspace_rls_events_invitations_migration.sql` | RLS preservada, FK indexes |
| `supabase/stage_workspace_venue_submit_rls_optimization.sql` | RLS de cadastro de casas |
| `tests/workspace-saas-part2.test.mjs` | Novos contratos estáticos de segurança e UX |

## Próximas partes (execução progressiva, não promessa de conclusão imediata)

| Prioridade | Entrega | Critério objetivo |
|---|---|---|
| P0 | Shell persistente nas telas de Agenda, Contratações e Negócios | Sidebar/menu inferior não desaparecem quando o usuário abre uma tela de trabalho; sem URL quebrada |
| P0 | Fluxo músico de ponta a ponta e onboarding | Cadastro → portfólio → disponibilidade → convite → aceite testado com papel real; menos trocas de página |
| P0 | Mobile: eventos e financeiro | Tabelas com cartões/rolagem legíveis em 360px, ações principais visíveis, testes por viewport |
| P0 | Separar serviços de `app/eventos` e `app/financeiro` | `src/domains/events|billing/services`, sem mutação financeira no frontend |
| P1 | Extração das páginas de perfil e catálogo para domínio `artists` | Uploads, privacidade, Pro/cortesia e publicação intactos |
| P1 | Marketplace operável (hoje Em breve) | Busca pública consentida por cidade/instrumento/gênero/cachê permitido, filtros paginados, logs de performance |
| P1 | Favoritos privados/histórico | RLS por proprietário e botão de desfazer; não revelar contatos privados |
| P1 | SEO públicos e CSS | Sitemap particionado de perfis e casas, canonical, remover CSS duplicado só após prova de não utilização |
| P2 | Recomendações/matching | Métricas de conversão, igualdade de exposição e limite por usuário |
| Antes de escala | Segurança, carga, E2E, observabilidade | Testes reais com usuários simulados, isolamento de papéis, p95/p99, limites de conexões, webhooks Asaas, backup e recuperação |

## Como validar

- CI GitHub Actions na `main`: TypeScript, testes Node e Next build.
- QA Supabase: `stage_workspace_overview()` disponível apenas a `authenticated`; atividade <=8, próximos shows <=6; consulta para usuário inexistente retorna `profile_required`.
- `get_advisors(type=performance)` em QA mostra `auth_rls_initplan=0` e `unindexed_foreign_keys=19`.
- Não foi feita medição de throughput com produção real; os testes QA atuais têm poucos dados.
- **Produção Vercel e Supabase oficial não foram alterados nesta parte. Nenhum deploy executado.**

## Critério CTO para a continuidade

Cada evolução subsequente deve: possuir escopo pequeno e migração separada; preservar links antigos; registrar SQL reversível ou procedimento explícito de recuperação; testar acessibilidade e segurança, não apenas snapshots de texto; passar CI da `main`; e só então solicitar autorização específica para publicar.
