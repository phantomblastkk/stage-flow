# Stage Flow — atividades e contratacoes na campainha

**28/10/2026.** A notificacao interna passa a unificar os eventos de contratacao e as atividades importantes.

## Eventos
- **Pedido pelo formulario publico do cantor/artistico**: ao gravar um pedido valido, notificar exclusivamente o titular, com link direto `/meu-perfil-artistico/solicitacoes?pedido=<uuid>`. O mesmo vale para artista que tambem e musico; nao criar um perfil ou caixa adicional.
- **Convites do Marketplace a musicos**, respostas, propostas formais e mensagens: continuam os triggers ja instalados, sem notificacao duplicada.
- **Avaliacao de show concluido**: uma notificacao real ao musico avaliado.
- **Selo Stage Flow de cantor/musico**: notificacao ao titular quando o banco registra a verificacao.
- **Recebimentos** de participacao e de evento: alertar apenas quando o valor recebido e maior que zero e realmente se altera; uma notificacao por registro pode ser reaberta em alteracao posterior.
- **Alteracoes importantes da operacao de shows e cortesias Pro**: regras anteriores preservadas.
- **Historico pendente**: pedidos novos e selos recentes (ate 30 dias) entram de modo idempotente na caixa; nao replicar todo historico antigo.

## Seguranca
- Trigger transacional, sem chamadas externas e sem publicacao de chaves, email, telefone ou mensagens de contato na notificacao.
- `stage_internal_notifications` continua sem SELECT/INSERT direto para anon/authenticated, com RLS; lista, contador e marcacao de leitura permanecem RPCs validadas por `auth.uid()`.
- Destinatarios derivados da tabela efetiva, nunca de ID enviado pelo cliente. Unicidade `(recipient_id, source_type, source_id, event_code)` evita avisos fantasma/duplicados.
- Central `/notificacoes` e campainha exibem e encaminham cada categoria.
- A campainha atualiza automaticamente por consulta periodica e quando a aba volta a ficar visivel (sem push nativo).

## Implantacao
- SQL: `supabase/stage_important_activity_notifications_20261028.sql`.
- Testes: `tests/important-activity-notifications.test.mjs`, TypeScript, build e testes navegador.
- Deploy automatico continua desligado: publicar frontend apenas por deploy manual explicitamente autorizado.
