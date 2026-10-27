# Asaas Sandbox — homologação StageFlow

Status em 27/10/2026: receiver e armazenamento em QA instalados e validados no banco. Nenhuma compra ou assinatura foi ativada.

## Ambientes e isolamento

- GitHub: somente branch `develop`.
- Vercel QA: projeto `stage-flow-homologacao` (ID `prj_5QIrtYibgORgIHuRIUIZ50Jawwgr`).
- Supabase QA: `zycuprhymoukhnuamtit`.
- URL do webhook de homologação: `https://stage-flow-homologacao.vercel.app/api/asaas/webhook`.
- Nunca configurar o webhook de produção para essa URL ou usar credenciais de produção para testar.
- O projeto QA tem suas próprias variáveis de ambiente classificadas como `production` *dentro do projeto de homologação*. Isso não é o projeto de produção StageFlow.

## Implementado e validado

1. Tabela `stage_asaas_webhook_inbox` protegida por RLS, com chave única `event_id`.
2. RPC `stage_asaas_ingest_verified_event` instalada pela migração `supabase/asaas_private_ingest_migration.sql`, que verifica SHA-256 do segredo interno e executa `INSERT ... ON CONFLICT DO NOTHING`.
3. Hash do segredo interno guardado em `stage_asaas_webhook_credentials`, sem acesso direto por `anon` ou `authenticated`.
4. Vercel QA: variáveis privadas `ASAAS_WEBHOOK_AUTH_TOKEN` (autenticidade do envio Asaas) e `STAGE_ASAAS_INGEST_TOKEN` (autorização da escrita no banco).
5. Teste diretamente no Supabase QA: token inválido → `unauthorized`; primeiro evento sintético `PAYMENT_CREATED` → `stored`; reenvio do mesmo identificador → `duplicate`; somente 1 registro. Nunca foram criados pagamentos reais.
6. A rota Next.js responde HTTP 200 **apenas depois** do retorno `stored` ou `duplicate`; não cria cobranças nem dá direitos Pro.
7. A RPC `SECURITY DEFINER` executável por `anon` é intencional **somente** para escrita com segredo de alta entropia: sua superfície deve ser reavaliada antes de uso em produção, preferindo recepção por Edge Function/serviço interno, com auditoria de rate limiting e autenticação.

## Configuração restante no painel Asaas **Sandbox**

O Asaas ainda **não foi conectado** a este assistente: nenhuma configuração foi gravada na conta Asaas nem existe API Key de Sandbox conectada.

Na conta **Sandbox**, em Integrações → Webhooks → Criar:

- URL: `https://stage-flow-homologacao.vercel.app/api/asaas/webhook`
- API Version: 3.
- Tipo de envio: sequencial (recomendado durante testes).
- Token de autenticação: **exatamente** o segredo `ASAAS_WEBHOOK_AUTH_TOKEN` da Vercel QA, não a chave de API Asaas. Não publicar esse token em tickets, documentos, commits ou conversas.
- E-mail de alerta: endereço operacional da própria conta (precisa ser escolhido pelo titular).
- Eventos: inicialmente `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_UPDATED` e `PAYMENT_DELETED`, conforme os eventos efetivamente usados na integração.
- Validar a acessibilidade HTTP da URL pública, pois o acesso automatizado ao deployment por URL temporária foi negado pela proteção da Vercel nesta sessão.

Antes de habilitar um webhook efetivo, testar o recebimento com:

```bash
SANDBOX_WEBHOOK_TEST_TOKEN="<token-privado-da-Vercel-QA>" \
  node scripts/asaas-sandbox-smoke.mjs
```

Esse script cria apenas identificadores sintéticos `PAYMENT_CREATED`, sem gerar cobrança no Asaas. Confira na inbox QA se o mesmo evento existe uma única vez. **Não** rode o script em produção.

## O que este fluxo ainda NÃO faz

- Não cria clientes, cobranças, checkout, assinaturas ou pagamentos no Asaas.
- Não comprova se uma notificação corresponde a uma cobrança real ou titularidade de assinatura.
- Não processa recebimentos para liberar perfis ou planos Pro.
- Não realiza transações ou aciona WhatsApp.
- Para o fluxo financeiro real serão necessárias API Key *Sandbox*, identidade de conta, configuração de ofertas e lógica idempotente de vinculação/validação das assinaturas no servidor. Não pedir ao usuário que cole chaves privadas no chat.

## Segurança e observações

- `NEXT_PUBLIC_*` não pode conter segredos. Os dois segredos criados para webhook são privados, usados apenas pelo servidor do projeto QA.
- Nenhum `SUPABASE_SERVICE_ROLE_KEY` foi adicionado à Vercel. A função SQL verifica um segundo segredo independente.
- O advisor de segurança Supabase sinaliza a função privilegiada executável por `anon`; risco limitado ao armazenamento de eventos com autenticação forte, **sem** ativação de assinaturas. Reavaliar antes de produção.
- O teste ponta a ponta via HTTP externo não foi executado nesta sessão porque a ferramenta de acesso ao deployment protegido foi negada e o runtime de terminal não tinha acesso de rede.
- Antes de qualquer ativação comercial: validar webhooks Asaas reais em Sandbox, idempotência do processamento, comparação com API Asaas, vinculação ao titular e regras de cancelamento/estorno.

Referências: https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook e https://docs.asaas.com/reference/criar-novo-webhook.
