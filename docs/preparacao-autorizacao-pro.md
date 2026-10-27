# StageFlow — preparação da autorização Pro

Status: planejamento de migração, **não aplicado no Supabase**.

## Regras de produto
- Contabilidade básica continua gratuita para cantor, músico e produtor.
- Relatórios financeiros consolidados, portfólio avançado e site profissional do cantor exigem autorização Pro no servidor.
- Nenhuma alteração de UI deve ser interpretada como concessão de assinatura.
- Músicos de apoio continuam com portfólio gratuito e cadastro sem convite.
- O subdomínio será benefício do plano pago após provisionamento, sem contratação avulsa.
- A página /assinatura não recebe pagamentos até configurar checkout e webhooks.

## Pré-requisitos antes de ativar o Pro
1. Confirmar a instalação das migrações `pro_artist_publication_migration.sql` e `finance_dashboard_migration.sql` em QA, na ordem correta.
2. Implementar autorização server-side por `auth.uid()` e `stage_pro_site_is_entitled`, verificando acesso apenas à conta do solicitante.
3. Separar a consulta de relatório avançado da RPC básica: não confiar em blur, cadeado ou `reportAccess` do React para restringir dados premium.
4. Testar casos: cantor Free, cantor Pro, músico, produtor, sem login e revogação do plano.
5. Validar RLS, grants, ausência de operações financeiras e logs sem informações sensíveis.
6. Corrigir o CI da `develop` antes de deploy.
7. Só depois disso integrar checkout e webhooks, sem habilitar cobrança em produção sem revisão.

## Estado nesta etapa
A tentativa de criar a migração Pro pelo conector foi bloqueada pela configuração de segurança da ferramenta. Não houve execução SQL nem modificação de dados do Supabase.


## Instalação da inbox do Asaas no QA (27/10/2026)

- Aplicadas ao projeto QA `zycuprhymoukhnuamtit` as migrações `asaas_webhook_inbox` e `asaas_webhook_inbox_integrity`.
- Verificação em QA: RLS ativo, 5 constraints de integridade e 1 índice único (chave primária do evento).
- Tabela `public.stage_asaas_webhook_inbox` mantém os eventos separados de perfis, assinaturas e pagamentos financeiros. Nenhuma assinatura foi liberada.
- O endpoint QA agora usa `ASAAS_WEBHOOK_AUTH_TOKEN` e `STAGE_ASAAS_INGEST_TOKEN` (segredos somente no servidor). O último tem apenas seu hash no banco. Não utiliza `SUPABASE_SERVICE_ROLE_KEY` na Vercel QA.
- O código da fila e do verificador foi publicado no deploy QA `dpl_v9SDRkpqCLgfhSYUhK7ZfYDHjRET` (READY). O teste de gravação e duplicata foi confirmado no banco. A entrega HTTP real do Asaas ainda depende da configuração do webhook na conta Sandbox.
- Para registrar sucesso, o endpoint invoca a RPC `stage_asaas_ingest_verified_event` com segredo privado; o banco usa `ON CONFLICT (event_id) DO NOTHING`. O processamento idempotente posterior e a validação da titularidade da assinatura seguem pendentes.


## Teste de entrada do webhook no Sandbox (próxima etapa)

- Script `scripts/asaas-sandbox-smoke.mjs` prepara um evento artificial `PAYMENT_CREATED` com IDs únicos; **não cria cobranças nem autoriza Pro**.
- Só aceita a URL de homologação `stage-flow-homologacao.vercel.app` e recusa outros hosts.
- Sem credenciais, testa que a rota não aceita chamadas sem autenticação (HTTP 401 ou 503).
- Com `SANDBOX_WEBHOOK_TEST_TOKEN` de teste, verifica armazenamento e reentrega duplicada; o token precisa coincidir com `ASAAS_WEBHOOK_AUTH_TOKEN` configurado apenas no ambiente QA.
- A versão está publicada na Vercel QA. O teste autenticado HTTP ainda não foi executado por falta de acesso HTTP aos deployments protegidos nesta sessão. Nunca usar token de produção.
- O teste valida recebimento idempotente, mas **não demonstra confirmação de pagamentos**. A vinculação entre assinatura, titularidade e recurso Pro segue pendente.
- CI testa o contrato estático do script, não envia tráfego nem eventos para o banco.

**Atualização de homologação:** veja [Asaas Sandbox — homologação StageFlow](./asaas-sandbox-homologacao.md) para o estado atual e o guia de ativação. As instruções anteriores refletem etapas históricas.
