# Stage Flow — Avisos sobre alterações na operação do show (QA)

## Escopo e ambientes
- Alterações só na branch **develop** do repositório `phantomblastkk/stage-flow` e no Supabase QA `zycuprhymoukhnuamtit`.
- A produção (GitHub `main`, Supabase `bmudkggwjybyjuhgefvw` e Vercel oficial) permanece intocada.
- O projeto/dominio correto de homologação da Vercel continua sem conexão nesta sessão. Não fazer deploy no projeto `stage-flow` acessível se estiver ligado a configurações de produção.
- **Sem** push, WhatsApp, SMS, e-mail, cron ou integração externa.

## O que foi implementado
Migração aplicada em QA: `supabase/show_operations_alerts_migration.sql` após `internal_notifications_migration.sql` e `show_operations_migration.sql`.

As informações logísticas editadas pelo organizador em `/eventos/operacao?evento=<id>` são comparadas no banco. Mudanças relevantes em chegada, passagem de som, abertura das portas, ponto de encontro, contato da produção, transporte ou equipamentos geram avisos **somente** para participantes com convite `accepted` ainda ativo em shows futuros não cancelados.

O aviso usa a tabela privada existente `stage_internal_notifications` e o novo `source_type='operations'`, `event_code='show_briefing_changed'`. Os detalhes das novas instruções **não são copiados** para a notificação: apenas os nomes dos campos alterados e o título resumido do show. O músico abre o briefing atualizado na rota original, onde o acesso é revalidado com `stage_show_ops_overview`.

- **Não notificar** convites pendentes, recusados ou cancelados.
- **Não notificar** alterações apenas em `backstage_notes`, `closing_notes`, `closed_at` e no checklist de tarefas. Não houve mudança nos custos ou nos pagamentos.
- Não gerar aviso se nenhum campo logístico mudou, inclusive quando o formulário for salvo repetidamente.
- Avisos do mesmo evento são agrupados: uma linha por músico e por evento. Nova mudança altera o resumo, atualiza a ordem cronológica e marca como **não lida** novamente.
- Quando o convite deixa de estar aceito, não são geradas novas atualizações. Avisos anteriores ainda podem aparecer no histórico do destinatário, mas o briefing não fica acessível após a revogação.
- A criação ou atualização do briefing e seus avisos ocorrem dentro da mesma transação Postgres. Nenhum envio externo.
- Notificações anteriores não são geradas retroativamente, somente alterações posteriores à migração.

## Front-end
- Central completa: `app/notificacoes/page.tsx`, novo ícone/categoria e link direto para `/eventos/operacao?evento=<id>`.
- Mini painel do sininho: `components/notification-bell.tsx`, inclusive nos cinco avisos mais recentes.
- Tela de operação: explicação curta informando quem recebe as alterações e que notas internas não disparam mensagens.

## Verificação
- `npm run test:show-operations-alerts`, ligado ao CI.
- Teste SQL de homologação em transação: dois músicos confirmados, um convite pendente e o organizador; criação gera aviso para confirmados; verificação de ausência de notas privadas; leitura e marcação; salvar notas privadas ou dados logísticos iguais não gera outro aviso; alterar som reabre o mesmo aviso; revogar convite impede novos avisos e acesso ao briefing.
- O teste foi revertido com `ROLLBACK`; nenhuma conta, apresentação ou notificação fictícia permaneceu.
- Depois do deploy correto no ambiente QA, testar visualmente com duas sessões reais, em desktop e celular, inclusive contador, mini painel, link, atualização de horários e revogação de convite.

## Limitações para refinar
- Sem e-mail/WhatsApp/push; não se sabe se o músico estava online ao atualizar.
- Alertas usam polling do painel/central enquanto a aba está visível; não é entrega garantida em tempo real.
- Aviso agrupado reflete somente **os últimos campos modificados**. O briefing aberto é a fonte atualizada de verdade.
- Não há envio automático de horários a músicos convidados mas ainda pendentes, nem alertas de todas as tarefas internas.
