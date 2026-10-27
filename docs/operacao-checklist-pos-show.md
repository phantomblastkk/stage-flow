# Stage Flow — Operação por show / Checklist e Pós-Show

## Ambientes
- **Código:** branch `develop` do repositório `phantomblastkk/stage-flow`.
- **Banco QA:** `zycuprhymoukhnuamtit`.
- **Não alterar:** GitHub `main`, Supabase de produção `bmudkggwjybyjuhgefvw`, Vercel de produção.
- **Vercel QA:** publicar manualmente no projeto/dominio de homologação correto, após confirmar o vínculo com o Supabase QA. O domínio de QA anterior ainda não foi localizado na equipe Vercel conectada.

## Implementação
- Nova tela `/eventos/operacao?evento=<id>`, acessível a partir de **Agenda de shows**, **Meus shows** e **Shows recorrentes**.
- Organizador pode organizar horários de chegada, passagem de som e abertura das portas, ponto de encontro, contato no local, instruções de transporte e equipamentos, e notas de produção privadas.
- **Checklist:** modelo opcional de oito tarefas (confirmação de local, equipe, transporte, equipamento, passagem de som, chegada, financeiro e encerramento). Templates idempotentes: clicar novamente não duplica atividades. Pode cadastrar tarefas próprias, atribuir nome de responsável, prazo, observações, marcar/desmarcar conclusão, editar e remover. Limite de cem tarefas por show.
- **Pós-show:** registro de resumo privado e data de fechamento operacional, podendo reabrir. É permitido fechar somente após o início do show e quando todas as tarefas de categoria `closing` estiverem feitas. O fechamento **não altera** o status `completed` do evento, não gera pagamento, nem declara receita recebida.
- **Financeiro:** `EventBudgetPanel` pré-existente, embutido sob demanda; reutiliza `stage_event_budget` e `stage_event_expenses`, evitando valores e despesas duplicados.
- **Músico com convite aceito:** vê briefing de chegada, som, portas, local, responsável e instruções de transporte/equipamento. **Não vê** checklist interno, notas privadas, conclusão operacional ou custos de outros músicos. Convites cancelados/recusados não concedem acesso.
- Campos ficam acessíveis somente ao dono do show após seu cancelamento, em modo leitura. O encerramento operacional é distinto do status de realização do evento já implementado.

## Banco QA
Migration aplicada somente a `zycuprhymoukhnuamtit`:
`supabase/show_operations_migration.sql`.

Tabelas protegidas:
- `public.stage_show_operations` (um briefing operacional por `event_id`).
- `public.stage_show_operation_tasks` (tarefas por apresentação, categorias, responsáveis e conclusão).

Ambas usam RLS habilitada e **nenhum privilégio direto** para `anon` ou `authenticated`. RPCs `SECURITY DEFINER` sempre verificam `auth.uid()` + `producer_id`; a leitura de briefing também valida um convite `accepted` válido. Triggers externos, contas reais e produção não foram modificados.

RPCs:
- `stage_show_ops_overview`: briefing de dono ou participante, com níveis de acesso separados.
- `stage_show_ops_save`: cria/atualiza horários e notas de operação.
- `stage_show_ops_seed`: importa o checklist inicial, sem duplicar.
- `stage_show_ops_task_save`, `stage_show_ops_task_toggle`, `stage_show_ops_task_remove`.
- `stage_show_ops_close`: encerra/reabre a operação.

## Testes e próximos cuidados
- `npm run test:show-operations` está integrado ao CI da branch `develop` antes de TypeScript e build.
- Banco QA: teste transacional de criação, checklist 8/8, idempotência, edição/conclusão/remoção, bloqueio do fechamento incompleto, fechamento correto, isolamento entre proprietários e acesso do músico convidado ao briefing sem dados financeiros. Todos realizados com `ROLLBACK`: **sem eventos ou dados de teste persistidos**.
- Testar manualmente após deploy correto: mobile, entradas com duas contas reais, formulário de horários, tarefas concluídas, links do histórico, fechamento e despesas.
- Não há notificações automáticas de mudança de horário nesta versão; o músico deve conferir o briefing ao acessar seu show. A central de notificações e os avisos WhatsApp futuros permanecem módulos separados.
