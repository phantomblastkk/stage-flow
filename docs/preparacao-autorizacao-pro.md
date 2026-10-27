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
- O endpoint ainda depende de `ASAAS_WEBHOOK_AUTH_TOKEN` e `SUPABASE_SERVICE_ROLE_KEY` configurados **apenas** no servidor QA; nunca enviar essas chaves pelo chat, commitar ou expor via NEXT_PUBLIC.
- O site QA continua sem publicação deste código mais recente. Não configurar webhook real até haver deploy QA, credenciais de sandbox e teste de entrega/duplicata.
- Para registrar sucesso, o endpoint faz upsert com `ignoreDuplicates: true`, preservando o primeiro evento recebido. O processamento idempotente posterior e a validação da titularidade da assinatura seguem pendentes.
