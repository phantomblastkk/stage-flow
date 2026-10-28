# StageFlow: centro operacional e descoberta

Esta entrega reorganiza a experiência sobre a `main` `0ee63676b90d9a924a03169bbea6232b2a8ac845`. O deploy automático permanece desativado. A migração abaixo deve preceder qualquer publicação manual.

## Comportamento implementado

- Sete entradas principais: Início, Agenda, Contratações, Marketplace, Financeiro, Perfil Artístico e Configurações.
- Navegação inferior no celular com Início, Agenda, Convites, Marketplace e Financeiro. Acesso aos convites, agenda, catálogo e financeiro em um toque a partir do painel. O drawer mantém Escape, foco contido e retorno de foco.
- Home com saudação no fuso de São Paulo, resumo operacional, um próximo show, CTA de Marketplace, convites pendentes, completude do perfil, resumo financeiro, atividades e cinco ações rápidas.
- Dinheiro calculado pelas mesmas funções de centavos do Financeiro. Sem duplicar participação no próprio evento, sem contar shows cancelados e com indicação de valores indefinidos ou histórico limitado. O resumo de recebimentos é por data do show, não extrato bancário.
- Perfil Artístico em `/perfil-artistico`, com os editores existentes de apresentação artística e trabalho como instrumentista no mesmo espaço. Dados, imagens, vídeos, agenda, contatos, publicação e compartilhamento reutilizam seus RPCs e autorizações. Recursos pagos continuam respeitando as regras existentes.
- Nomenclatura “Site Pro” removida das interfaces. IDs de banco, paths e nomes internos continuam estáveis para compatibilidade. Planos Pro permanecem planos; não foram renomeados nem liberados.
- Descoberta do catálogo existente com Recomendados, Favoritos e Histórico. Recomendados usa a seleção por avaliações verificadas; Histórico mostra contatos reais da conta, não navegação inventada. Evento selecionado segue do fluxo de contratação ao catálogo.
- Perfis adicionais de artista individual, grupo, produtor e casa sob a mesma conta, em `/perfis`. Formação musical, integrantes, líder responsável, apresentação e publicação na descoberta restrita.
- Produtor pode criar uma casa comum e cadastrar sua programação na Agenda. Isso não concede selo oficial, parceria nem privilégios sobre outras casas.
- Contratação em `/contratar`: evento/casa existente ou novo evento → artista/grupo → disponibilidade → convite → negociação de cachê existente → aceite → agenda/financeiro. Para grupo, uma única contratação e um cachê total; nome e formação ficam congelados no convite.

## Componentes e responsabilidades

| Componente / módulo | Responsabilidade |
|---|---|
| `WorkspaceSidebar` + `workspaceNavigation` | As sete áreas e os acessos móveis |
| `WorkspaceOverview` | Próximo show, atividades, convites e descoberta |
| `OperationalFinance` | Carregar dados existentes e apresentar recebimentos reais |
| `operationalSummary` | Calendário de São Paulo, centavos e deduplicação |
| `ProfileReadiness` | Checklist persistido: nome, bio, cidade, foto, rede e publicação |
| `ArtisticProfile` | Entrada canônica e carregamento sob demanda dos editores |
| `ArtistProfileEditor` / `InstrumentalistProfileEditor` | Formulários existentes, permissões e mídias preservadas |
| `Profiles` | Gerenciar identidades e formações da mesma conta |
| `Hire` | Evento, descoberta, disponibilidade e convite |
| `MarketplaceCatalog` | Catálogo, favoritos, recomendados e contatos anteriores |

## Rotas e compatibilidade

| Caminho anterior | Destino / comportamento |
|---|---|
| `/painel` | Home operacional |
| `/eventos` | Agenda existente; `?novo=1` abre cadastro |
| `/eventos?novo=1&continuar=contratar` | Após salvar, segue a `/contratar?evento=ID` |
| `/eventos?novo=1&casa=ID` | Usa somente casa pertencente à conta autenticada |
| `/meu-perfil-artistico` | Redireciona a `/perfil-artistico` |
| `/meu-perfil-artistico?aba=pro` | Redireciona a `/perfil-artistico?aba=midia` |
| `/meu-perfil-artistico/site-profissional` | Redireciona a `/perfil-artistico?aba=midia` |
| `/meu-portfolio` | Redireciona a `/perfil-artistico?aba=instrumentista` |
| `/meu-perfil-artistico/solicitacoes` | Inbox privado existente, preservado |
| `/USERNAME`, `/musico/SLUG`, `/pro/USERNAME` | Endereços públicos e redirecionamento anteriores, preservados |
| `/perfis` | Identidades adicionais e grupos |
| `/perfil-artistico?perfil=ID` | Gestão de identidade adicional selecionada, sempre filtrada pelo proprietário |
| `/contratar?evento=ID` | Fluxo com evento próprio pré-selecionado |
| `/marketplace` | Continua “Em breve” |
| `/marketplace/preview` | Continua exigindo autorização; filtros opcionais `estilo`, `cidade`, `busca`, `aba=favoritos/historico` |

As novas rotas privadas foram adicionadas ao robots. A migração recusa instalação se `perfil-artistico`, `perfis` ou `contratar` já pertencerem a um artista. Não renomeia usuários automaticamente.

## Banco: migração aditiva

Arquivo: `supabase/migrations/20261028044643_operational_experience_profiles.sql`, gerado pelo CLI e preenchido com o contrato versionado.

- `stage_performance_profiles`: relação N:1 com a conta existente (`profiles`), tipos, nome, bio, cidade, formação, integrantes e casa vinculada.
- `stage_invitation_performance_identity`: snapshot da identidade contratada, referenciando o convite existente.
- RPC de criação/edição verifica `auth.uid()`, propriedade e função de produtor para casas; limita quantidade e tamanho dos dados. Não permite mover uma identidade entre contas.
- RLS habilitada e grants explícitos. Sem INSERT/UPDATE direto nas novas tabelas. Leitura de perfis privados apenas pelo proprietário; snapshot apenas pelo organizador e destinatário do convite.
- Descoberta e convite mantêm `stage_marketplace_gate()`. Nenhum acesso público novo ao catálogo.
- Disponibilidade usa intervalos reais, inclusive meia-noite e bloqueios semanais. Revalida no envio e no aceite, com lock da conta responsável para evitar confirmações simultâneas conflitantes.
- O aceite de um convite de identidade artística exige cachê acordado e cria o registro financeiro correspondente. Não cria transferência, cobrança Asaas ou pagamento bancário.
- O perfil artístico congelado e os destinatários do contrato não podem ser reatribuídos após o convite.
- Os dados legados não são alterados ou apagados. Os grupos não concedem acesso aos integrantes citados.

## Plano de migração e rollback

1. Conferir o HEAD da `main` e o CI. Auditar colisão dos três novos caminhos com usernames existentes.
2. Em PostgreSQL descartável, aplicar fixture, negociação existente, migração e testes de isolamento. Verificar os testes de navegador com as respostas sintéticas.
3. Revisar índices e planos de consulta para o volume real. Rodar os advisors de segurança do projeto correto antes de aplicar em produção.
4. Aplicar a migração manualmente no projeto oficial após autorização específica. A aplicação não abre Marketplace nem altera plano.
5. Conferir quantidade de contas/convites/eventos antes e depois; testar duas contas reais autorizadas com permissões diferentes, sem dados financeiros reais em evidências.
6. Publicar manualmente o código após autorização específica. Verificar links antigos e novos, edição, criação de grupo, conflito e aceite.
7. Rollback de interface: voltar ao commit anterior, mantendo tabelas aditivas e snapshots. Não apagar contratos criados. Nenhuma migração destrutiva é necessária para o rollback visual.

Não há backfill que duplique as funções legadas em identidades adicionais. A conta atual continua sendo a identidade padrão; as adicionais nascem explicitamente. Financeiro e convites continuam consolidados por conta responsável, sem fingir isolamento por perfil.

## Limites explícitos desta versão

- Oportunidades por casa ou vaga de evento não têm uma fonte publicada no banco atual. A Home oferece buscas reais por estilo; não inventa contratantes, ofertas ou compatibilidade. Essa seção não é um motor de vagas.
- Integrantes são a formação declarada pelo líder. Não são membros autorizados de uma organização e suas agendas individuais não são bloqueadas automaticamente.
- A restrição legada `unique(event_id,musician_id)` continua preservada: uma mesma conta não recebe duas contratações distintas para o mesmo evento, mesmo representando dois grupos. O segundo envio informa que já existe convite.
- As identidades adicionais têm apresentação e formação próprias; galerias, temas e URLs públicas continuam nos editores legados de cantor/instrumentista. Não foi criada uma segunda infraestrutura de mídia/publicação para grupos.
- “Próximos recebimentos” usa saldo registrado e data do show. Não existe vencimento bancário novo nem confirmação automática de liquidação.
- O catálogo público continua fechado, conforme decisão anterior. Nacionalização exige validar migração, contratos e volume antes da liberação; este commit não declara o produto pronto para lançamento.

## Validação e evidências

- 224 testes Node aprovados localmente após a reorganização; as verificações existentes de autorização dos editores foram mantidas, acompanhando sua extração em componentes.
- TypeScript e build de produção local aprovados com endpoint fictício.
- `tests/operational-db/isolation.sql`: criação, isolamento, formação imutável, lançamento restrito, casas comuns, cachê obrigatório, registro financeiro e conflito.
- `tests/browser/operational-home.mjs`: Home em 360/768/1280 px, navegação, redirecionamento, falha financeira, grupo e convite; apenas fixtures.
- Workflow `operational-ux.yml`: PostgreSQL temporário e navegador. Não possui segredos nem etapa de deploy.
- Wireframes em `docs/wireframes/dashboard-desktop.svg` e `dashboard-mobile.svg`: desenho de referência, dados ilustrativos, não capturas de produção.
