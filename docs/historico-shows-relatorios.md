# Meus shows e relatórios financeiros — homologação

## Fluxo e papéis
- Rota protegida: `/meus-shows`. Atalho em `/painel` para músico, cantor e produtor; **casas** mantêm somente calendário.
- Músico: participações de convites próprios com aceite; não vê cachês de outros músicos. Pode confirmar privadamente uma apresentação passada e anotar quanto recebeu e gastou.
- Cantor/produtor: eventos criados por sua conta e valores do **orçamento do evento existente** (`stage_event_budget`, `stage_event_expenses`, `stage_fee_negotiations`). Não existe segundo lançamento do mesmo faturamento.
- Papel é por evento/convite, e não apenas por tipo de conta. Um cantor que aceitou um convite vê aquela participação como músico; um músico que organizou um show vê aquele evento como organizador.
- Data passada por si só **não** significa realizado; confirmação manual no histórico ou status `completed` do organizador definem realização. Cancelados não contam. Confirmação manual não altera `events.status` nem o show público.

## Financeiro
- Opcional: na rota, aba `Relatórios financeiros (opcional)`.
- Valores separados entre organização e participação; filtros por ano e tipo.
- Valores acordados não são pagamentos. O valor recebido do organizador vem de `stage_event_budget.received_amount`; o músico informa manualmente `received_amount` e `expense_amount` da sua própria participação.
- Propostas sem aceite financeiro não são acordos: o valor `personal_fee` vem do acordo quando há; senão do `fee_amount` informado no convite e aparece distinguido na tela. Totais financeiros não são comprovantes bancários.
- Resultado parcial do organizador usa receita combinada menos cachês acordados e despesas totais. **Não** representa lucro final porque músicos sem valores fechados e pagamentos não controlados podem faltar.
- Relatório mensal considera show e data da apresentação, não a data de efetivo recebimento; filtrar somente "organizados" ou "participações" evita somar papéis diferentes.

## SQL e privacidade
Aplicar **somente no Supabase de homologação** e nesta ordem:
1. `supabase/private_fee_negotiations_migration.sql`
2. `supabase/event_financial_summary_migration.sql`
3. `supabase/event_revenue_expenses_migration.sql`
4. `supabase/show_history_reports_migration.sql`

No QA `zycuprhymoukhnuamtit` estas migrações já foram aplicadas.

- Leitura: `stage_my_show_history()` filtrada por `auth.uid()`, até 300 eventos próprios mais recentes + 300 convites aceitos por conta. Resposta não inclui outros músicos nem detalhes de convites de terceiros.
- Escrita: `stage_show_set_performed` e `stage_show_save_participation_finance` autorizam por proprietário do evento ou destinatário do convite. `anon` e tabelas diretas não têm acesso.
- Nenhum pagamento real, transferência, PIX ou cobrança é feito aqui.
- A base pública das casas não é alterada.
- Marketplace ainda não está lançado: pedidos que futuramente gerarem `events` ou `invitations` entrarão no mesmo histórico; não foram cadastradas transações do marketplace independentemente nesta etapa.

## Testes antes de publicar
- `npm run test:show-history`, `npm run test:venue-security`, `npx tsc --noEmit`, `npm run build`.
- No QA, o teste SQL transacional com evento passado confirmou que o status não era "realizado" sem marcação, que o dono podia marcar e que um estranho não via nem alterava o histórico. Transação terminada com `ROLLBACK`.
- Teste final com **uma segunda conta real de homologação** ainda precisa ser feito no navegador para comprovar o fluxo de músico, inclusive negociação, recibos e acesso por convite.
- Homologação Vercel não publica automaticamente `develop`: fazer deploy específico dessa branch. Não mergear no `main` nem aplicar no Supabase de produção nesta fase.
