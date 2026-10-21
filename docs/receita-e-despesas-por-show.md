# Stage Flow | Receita, despesas e resultado parcial por show

## O que foi implementado

Na área privada do organizador, abra `/eventos`, escolha um show próprio e clique em **Equipe, convites e financeiro**. O novo painel **Receita e despesas do show** aparece junto do quadro existente de cachês da banda.

Recursos:

- **Valor combinado com o contratante**, que pode ficar vazio quando ainda não há acordo; campo específico para **quanto já foi recebido** (manual).
- **Saldo a receber** = valor combinado − recebido; não considera depósitos/parcelas ou vencimentos individualizados.
- Despesas extras: descrição, categoria (transporte, equipamentos, serviços externos, alimentação, outros), valor total e quanto já foi pago (parcial ou total). Pode adicionar, editar e excluir cada despesa. Limite de 60 por show.
- **Resultado parcial previsto** = valor combinado − cachês acordados (convites ativos) − despesas extras previstas.
- Indicação destacada quando algum músico convidado ainda não tem cachê acordado. Nesse caso, o resultado previsto pode diminuir ao concluir as negociações.
- Os cachês da banda são trazidos da mesma rotina já existente `stage_event_financial_summary`. **Não** são cadastrados novamente na lista de despesas extras, para evitar contagem dupla.
- O painel de cachês e as telas de convites/negociação permanecem independentes: nenhum valor é automaticamente acordado por causa de um lançamento financeiro.

## Privacidade e segurança

- A migração cria `stage_event_budget` (registro do valor combinado/recebido por show) e `stage_event_expenses` (despesas manuais).
- As tabelas estão com RLS habilitada, sem acesso direto a clientes anônimos/autenticados, e nenhuma policy liberando SELECT ou escrita pública.
- As RPCs `stage_my_event_budget`, `stage_save_event_budget`, `stage_save_event_expense` e `stage_delete_event_expense` usam `security definer`, `search_path = ''` e conferem que `auth.uid()` é proprietário de `events.producer_id`.
- Valores de outro organizador não podem ser consultados nem editados por essas RPCs. Nenhum dado do novo financeiro é incluído na página gratuita do cantor ou no rascunho do site profissional premium.
- Ao remover um show, seus registros financeiros são excluídos por `on delete cascade`.

## Atenção às definições

**Valor combinado** é a receita prevista contratada. **Recebido** representa o que o organizador declarou ter recebido, sem comprovante bancário. **Despesa paga** é um controle manual, não um pagamento disparado pelo sistema.

**Resultado parcial previsto não é lucro final**: não considera cachês ainda não acordados, impostos, taxas, custos não lançados, pagamentos pendentes nem regras de sociedade/comissão. Se não existe valor combinado, o resultado aparece como **A definir**. A soma de cachês acordados inclui convites ativos pendentes ou aceitos, mas exclui recusados e cancelados. O acompanhamento de **pagamentos aos músicos ainda não está implementado**; não confundir cachê acordado com cachê pago.

## Migração

No **Supabase → SQL Editor**, execute **somente**:

`supabase/event_revenue_expenses_migration.sql`

Prerequisitos: esquema inicial já instalado, convites, negociação privada e `event_financial_summary_migration.sql` executados. O arquivo é idempotente para instalações já preparadas; **não reexecute `schema.sql`**.

## Checklist para testar

1. Faça login no Stage Flow como dono de um evento; abra `/eventos` → **Equipe, convites e financeiro**.
2. Informe **Valor combinado R$ 5.000,00** e **Já recebido R$ 1.500,00**. Salve, atualize e confira **A receber R$ 3.500,00**.
3. Adicione **Transporte R$ 300,00, pago R$ 100,00** e **Alimentação R$ 200,00, pago R$ 0,00**. Confira extra previsto R$ 500,00 e extra pago R$ 100,00.
4. Com cachês acordados somando R$ 1.800,00, o **resultado parcial previsto** deve ser R$ 2.700,00 (R$ 5.000 − R$ 1.800 − R$ 500). Sem cachês acordados, R$ 4.500,00, mas isso **não** é lucro final.
5. Atualize uma despesa e confira recalculado; exclua uma despesa e confirme que os totais mudaram.
6. Tente registrar recebido acima do combinado ou despesa paga acima do valor previsto; o formulário e as RPCs devem rejeitar.
7. Entre com outra conta ou abra a página pública: dados financeiros da banda e receita/despesas não devem aparecer.
8. Atualize a página e confira persistência do orçamento e das despesas. Teste o botão de atualização do painel depois de negociar um novo cachê.

## Evolução futura

Registro opcional e privado de pagamentos individuais aos músicos, impostos/taxas e parcelamento de recebíveis. Essas operações precisariam de verificações adicionais; nada disso foi ativado nesta migração.
