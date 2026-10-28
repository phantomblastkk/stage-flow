# Stage Flow — chat de contratacao liberado em 28/10/2026

O Marketplace ja foi aberto e a ativacao do chat foi autorizada expressamente. No banco oficial `public.stage_hiring_control.released=true` permite que usuarios autenticados iniciem novas conversas.

## Protecoes
- O destino deve ter `musician_portfolios.is_published=true`, `stage_marketplace_musician_settings.listed=true`, ser artista e nao constar de bloqueios na tabela de moderacao.
- A autenticação e o limite antigo de ate 15 novas conversas por 24h permanecem. Mensagens so podem ser lidas e escritas por participantes. A tabela de mensagens nao e publica.
- O fluxo de conversa do Marketplace aguarda a sessao do account-store chegar a `ready`; nao inicia com `accountId` vazio.
- O chat usa a rota `/conversas` e notifica novas mensagens na campainha pelo trigger existente.
- Nenhum envio externo ou cobranca: WhatsApp Cloud API segue desligado; propostas formais sao opcionais e eventos/pagamentos nao sao criados automaticamente por mensagens comuns.

## Verificacao
Teste de banco feito dentro de BEGIN/ROLLBACK no oficial, com abertura autorizada, mensagem, leitura pelo destinatario e bloqueio de conta estranha e de destino nao listado. A alteracao de flag e persistente apenas apos passar na verificacao. Deploy frontend e separado, sempre manual.
