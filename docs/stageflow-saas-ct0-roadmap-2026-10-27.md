# StageFlow — CTO: evolução SaaS, auditoria e roadmap
**Data:** 27/10/2026 · **Branch exclusiva:** `main` · **Deploy automático:** bloqueado.

**Checkpoint atual:** [Parte 14 — CSS de Contratações](stageflow-saas-phase-14-booking-css-2026-10-28.md).
As seções abaixo registram a auditoria inicial. Consulte os relatórios das partes
seguintes para as alterações incrementais e suas evidências; nesta etapa não
houve acesso à homologação, banco remoto ou deploy.

## Decisões executadas
O projeto é evoluído por **migração gradual por domínio**, não um rewrite de todas as páginas.
A primeira entrega troca a vitrine de dezenas de atalhos por um dashboard operacional,
sem alterar/endurecer contratos financeiros, cobrança, Asaas, autenticação ou URLs existentes.
Todos os acessos administrativos continuam autorizados pelas RPCs do banco — não pela sidebar.

Referências de produto:
- Linear: inbox orientada a prioridade, estados de leitura e menor densidade visual (https://linear.app/docs/inbox).
- Vercel (fev/2026): sidebar consistente e barra inferior em mobile para navegação com uma mão (https://vercel.com/changelog/dashboard-navigation-redesign-rollout).
- Stripe: indicadores financeiros com legenda explícita, sem confundir lançamentos com liquidação.

## Inventário verificado
- Repositório: **277 arquivos** versionados e **40 `app/**/page.tsx`** na auditoria inicial.
- **46 folhas CSS** (incluindo globais, editores, admin, marketplace e componentes). `app/globals.css` tinha aprox. **51,6 KB** de texto: contém estilos de homepage, portfólios, fluxo de login e painel.
- As páginas de `eventos`, `financeiro`, `meus-shows` e `meu-portfolio` possuem lógica de estado, servidor e visual misturada em Client Components extensos.
- Já existiam `robots.ts`, `sitemap.ts` e SEO dinâmico para cantor/músico/casa. Não foram reimplementados do zero.
- Base da homologação: índices `events_producer_start_idx`, `invitations_musician_status_idx`,
`stage_notifications_recipient_recent_idx`, `stage_hiring_musician_idx` e `stage_hiring_requester_idx` **já existiam** e não foram duplicados.

## 1. UX / 2. Navegação / 3. Dashboard (feito: fase 1)
**Problema:** até dezenas de cartões concorrendo pela atenção no `/painel`; o usuário precisava memorizar páginas.
**Impacto:** carga cognitiva, perda de contexto e tarefas pendentes escondidas.
**Solução aplicada:**
- `src/domains/navigation/workspace-navigation.ts`: navegação agrupada por função (Agenda, Contratações, Negócios, Perfil, Configurações); preserva todas as rotas originais e só apresenta recursos de cantor/músico/admin segundo as permissões.
- `src/domains/navigation/components/workspace-sidebar.tsx`: sidebar no PC, drawer acessível (Escape) e barra inferior no celular; links semanticamente marcados como atuais.
- `app/painel/page.tsx`: resumo operacional, campainha existente, menu de conta, troca de função híbrida, estados de autenticação preservados.
- `src/domains/dashboard/components/workspace-overview.tsx`: quatro métricas reais, até seis próximos shows, oito atividades recentes, estado vazio com próxima ação, abertura dos módulos originais, atualização sob demanda e após retornar à aba.
- `supabase/stage_workspace_overview_migration.sql`: RPC que valida `auth.uid()`; agrega shows próprios + participações aceitas, convites pendentes, **conversas** não lidas (não mensagens), contratos recentes e recebimentos manualmente registrados em shows do mês. Lista limitada, não transfere histórico inteiro.
- `supabase/stage_workspace_activity_enrichment_migration.sql`: timeline originada de notificações privadas, propostas/aceites efetivos, solicitações reais de contratação, selo de verificação e recebimentos *informados manualmente*. A leitura do feed não marca a campainha como lida.

**Validação:** QA retornou somente dados do próprio usuário, visitante anônimo sem EXECUTE, conta inexistente `profile_required`. `EXPLAIN` indicou Index Scan em `events_producer_start_idx` para próximos shows.

## 4. Design System (feito: fundação; migração contínua)
`src/components/ui/index.tsx` fornece:
`Button`, `Input`, `Select`, `Modal`, `Dialog`, `Toast`, `Card`, `Badge`,
`Avatar`, `Tabs`, `EmptyState`, `Skeleton`, `LoadingState`,
`StatusChip`, `StatCard`, além de `Textarea`.
`src/components/ui/tokens.css` define cores semânticas, espaços, raios, foco de teclado,
estados de erro, animação reduzida e responsividade.

**Limite:** os 46 CSS antigos **não foram apagados**, porque possuem seletores específicos usados por contratos legados. O novo painel começa a consumir os primitives, e as páginas são migradas por fatias testáveis. Não se declara um redesign completo do produto neste commit.

## 5. CSS: plano de redução (parcial)
1. Congelar novas regras globais sem escopo; todas as telas novas usarão tokens e `sf-ui-`.
2. Migrar gradualmente `dashboard-shortcut`, cartões `mp-`, cartões `show-history-`, formulários `artist-` para primitives por domínio.
3. Centralizar `Button`/`Input`/`EmptyState` e consolidar CSS responsivo duplicado.
4. Após cada migração: buscas por seletor, testes de contrato, contraste e regressão mobile.
5. Excluir CSS legado **apenas** quando nenhuma rota ou componente utilizá-lo.

**Risco:** apagar CSS compartilhado antes de migrar pode quebrar mais de 40 telas; por isso a transição é incremental.

## 6. Arquitetura por domínio (primeiro módulo migrado)
Estrutura iniciada:
```
src/
  domains/
    navigation/workspace-navigation.ts
    navigation/components/workspace-sidebar.tsx
    navigation/components/workspace-shell.css
    dashboard/components/workspace-overview.tsx
  components/ui/index.tsx
  components/ui/tokens.css
```
Roteiro seguinte: `domains/events` (agenda e recorrências),
`booking` (convites, conversas e propostas),
`artists` (portfólio e site), `venues` (programação),
`marketplace` (descoberta), `billing` (Asaas e relatórios),
`notifications` (inbox e feed);
extrair em cada domínio schemas, serviços, hooks e componentes, mantendo `app/` como roteador fino.

**Invariantes:** transações e alterações financeiras continuam exclusivamente no banco com políticas explícitas. Nunca confiar em `raw_user_meta_data`, nem publicar funções administrativas anônimas por engano.

## 7. Supabase: auditoria e remediação segura
Análise inicial de advisors (produção e QA têm histórico diferente):

| Sinal | QA antes | QA após correções | Produção (não alterada) |
|---|---:|---:|---:|
| Foreign keys sem índice de apoio | 24 | 22 | 31 |
| `auth_rls_initplan` | 13 | 8 | 12 |
| Políticas permissivas duplicadas | 2 | 1 | 2 |
| Índices sem uso observado (INFO) | 19 | 20 (índices novos ainda frios) | 24 |
| Funções `SECURITY DEFINER` acessíveis a `anon` (WARN) | 66 | requer revisão individual | 75 |

`supabase/stage_workspace_rls_index_performance_migration.sql` aplicada em QA:
- altera `auth.uid()=id` para `(select auth.uid())=id` em RLS de **profiles** e **notifications**, sem alterar ownership;
- remove a regra redundante de `cities` (outra política `PUBLIC` de mesmo predicado permanece);
- cria índices de FK em `stage_hiring_messages(sender_id)` e `stage_admin_verifications(verified_by)`.
- `stage_workspace_overview_migration.sql` cria índice parcial para novos pedidos de contratação por artista.

**Pendentes antes de escalar:** revisar explicitamente as funções `SECURITY DEFINER` acessíveis a `anon`,
demais 22/31 FKs conforme uso/DELETE, políticas de `events` divergentes entre QA e produção, tabelas históricas de backup em produção sem PK, o alerta de proteção de senhas vazadas no Auth e testes de isolamento em todos os papéis.

**Segurança:** registros INFO de RLS sem política frequentemente são intencionais em tabelas RPC-only. Não conceder SELECT geral para eliminar alerta. Não descartar índices chamados 'unused' sem janela estatística representativa. Não trocar funções para `SECURITY INVOKER` sem verificar seus contratos.

## 8. Mobile-first (feito: dashboard; backlog demais rotas)
- Barra inferior com cinco destinos frequentes, drawer completo para o resto, suporte a safe-area do aparelho.
- Indicadores em grade 4→2 conforme largura; painéis de atividade e shows tornam-se coluna única.
- Controles com tamanho mínimo de 44 px e foco visível; animações respeitam `prefers-reduced-motion`.
- Seguir depois em eventos/calendários, tabelas financeiras, mensagens, admin e editor de portfólio, incluindo teste real Android/iOS (ainda não executado).

## 9. Jornadas e eliminação de cliques
**Músico:** entrar → conclusão do portfólio → disponibilidade → convidado → aceitação → show no dashboard.
Próxima ação: checklist de onboarding contextual com progressão persistida.

**Casa:** registro → local oficial → programação → convites → acompanhamento. Próxima ação: assistente de publicação para logo, verificação e aprovação.

**Contratante:** marketplace → canal direto/conversa → proposta → convite/aceite → show. Próxima ação: manter contexto de proposta no fluxo e reduzir redirecionamentos.

## 10. Backlog do marketplace
Impacto alto = facilita contratação de músico de maneira confiável; não significa que já está entregue.

| Prioridade | Funcionalidade | Por quê | Critério de pronto |
|---|---|---|---|
| P0 | Busca por cidade e proximidade | Retenção do contratante | resultados públicos consentidos e índices de cidade |
| P0 | Filtro por instrumento/gênero | Match de demanda | filtros compostos com paginação e performance medida |
| P0 | Faixa de cachê divulgado | Intenção comercial | só referência autorizada, nunca negociação privada |
| P1 | Favoritos privados | Retorno à plataforma | tabela `owner_id, musician_id`, RLS, botão salvar |
| P1 | Histórico de contatos | Retenção, evita duplicidade | histórico por dono, sem revelar mensagens |
| P1 | Artistas semelhantes | Descoberta | gênero, cidade e instrumentos; sem dados sensíveis |
| P2 | Recomendações | Conversão | ranking transparente com avaliação anti-spam |
| P2 | Matching avançado | Volume | expiração de oportunidades, métricas e fairness |

## 11. Performance: correções e próximos passos
**Feito:**
- leitura duplicada de `profiles.artist_kind` foi incorporada à leitura principal;
- duas consultas independentes de permissões de navegação agora são `Promise.all`;
- painel consulta **uma RPC resumida**, não baixa 300/400 registros de show e financeiro;
- dados recentes têm limites rígidos e índice apropriado, sem `setInterval` de alta frequência no dashboard.

**Pendente:** converter páginas gigantes em Server Components + ilhas client quando dependências permitirem, aplicar cache seguro por usuário (sem vazamento intertenant), audit Next Bundle Analyzer, lazy-load dos editores e virtualização para listas realmente grandes.

## 12. SEO
- Já existiam canonical, OG e noindex de perfis não publicados para cantor e músico.
- `app/robots.ts` agora bloqueia módulos privados e bloqueia **toda homologação** da indexação.
- `app/casa/[slug]/layout.tsx` recebe canonical explícito, locale `pt_BR` e URL OG oficial.
- Próximo: sitemap particionado para músicos e casas aprovados e deduplicação por canonical. Para 100k contas, planejar múltiplos sitemaps limitados em vez de uma única resposta dinâmica sem paginação.

## 13. Protocolo para escala (não executado)
**Não há evidência de que o SaaS já suporte 100.000 usuários ativos.**
Antes de certificação de escala:
1. Baseline de `p50/p95/p99` por RPC, Vercel TTFB, bundle JS, CLS e erro de navegação.
2. Load tests em homologação com perfis simulados: 1k → 10k → 100k usuários; avaliar usuários simultâneos, 20–100 RPS crescendo com segurança e isolamento.
3. Limite de conexões Supabase / pooler, locks, custo por consulta, rate limiting e abuso de endpoints.
4. Testes e2e Playwright por músico, cantor híbrido, produtor, parceiro e administrador.
5. RLS adversarial, faturamento idempotente e webhooks Asaas com replays e assinaturas.
6. Alertas de falha, rollback, orçamento de recursos e backup/restore testado.

## Diff funcional / formas de validar
- Comparar `main` anterior com este conjunto de commits no GitHub.
- Testes `tests/workspace-saas.test.mjs` confirmam agrupamento de rotas, indicadores autenticados, estados de teclado, 15 componentes e robots/SEO.
- Teste de banco: `stage_workspace_overview()` retorna `status=ok` somente ao dono autenticado; `anon` sem EXECUTE; conta sem perfil retorna `profile_required`.
- A correção RLS foi observada via `pg_policies` e `get_advisors(type='performance')`.
- **Publicação automática permanece desativada.** Migrações desta fase são executadas em QA, não em produção, até uma release manual planejada.
