# Stage Flow | Resumo financeiro privado de shows

## O que a funcionalidade entrega

Cada evento próprio em `/eventos` oferece **Equipe, convites e financeiro**. Ao abrir o painel, o organizador vê um resumo dos cachês negociados individualmente pelo Stage Flow. O resumo não permite editar o cachê de outros músicos nem alterar sua negociação; para isso, o organizador usa `/convites?evento=<id>`.

Os valores são separados por estado:

- **Total de cachês acordados (subtotal):** soma dos `agreed_amount` com convites **pendentes ou aceitos**. Exclui recusados e cancelados.
- **Cachês com participação aceita:** soma dos acordos de cachê cujos convites **já foram aceitos** pelos músicos.
- **Cachês acordados, aceite pendente:** soma dos acordos financeiros de músicos que ainda não aceitaram o convite.
- **Propostas em aberto:** soma da última proposta de cada negociação ainda sem acordo, exibida **separadamente**. **Não entra no custo acordado.**
- **Sem cachê fechado:** contagem de convites ativos sem valor acordado, inclusive casos de músico que aceitou o show sem proposta de cachê.

A lista detalhada identifica cada músico, distingue convite pendente/aceito/recusado/cancelado e informa claramente quando um valor é mera proposta ou está indefinido.

**Importante:** essas somas são um **subtotal parcial** dos cachês da banda. Não significam despesas pagas, recebimentos, lucro, cachês de equipe externa nem o custo total do evento. Valores não definidos **não** são tratados como custo zero.

## Segurança

A função `stage_event_financial_summary(p_event_id uuid)` só devolve os dados após verificar `auth.uid()` igual a `events.producer_id`. Usa `security definer`, com `search_path = ''` e acesso restrito a `authenticated`; não expõe dados a outros artistas ou músicos. A consulta é restrita às negociações dos convites do show pertencente ao organizador.

A prévia premium e o perfil público do cantor não consultam nem recebem esses valores. Nenhuma proposta é automaticamente aceita, nenhum pagamento é efetuado e nenhum convite é enviado pelo resumo.

## Como ativar

Execute **somente** o arquivo `supabase/event_financial_summary_migration.sql` no SQL Editor do Supabase, após as migrações já aplicadas de `invitations_migration.sql`, `private_fee_negotiations_migration.sql` e do schema inicial.

Não reexecute `schema.sql` em banco que já está em uso.

## Teste manual

1. Abra **Agenda de shows**, escolha um show próprio e clique em **Equipe, convites e financeiro**.
2. Confirme que o painel apresenta o resumo e que ele não retorna erro de migração.
3. Sem convites, devem aparecer valores de R$ 0 e o aviso de que isso não significa custo final.
4. Gere um convite e, em **Convites**, envie uma proposta de cachê. Atualize o resumo; ela deve surgir como proposta em aberto, sem aumentar o subtotal de cachês acordados.
5. Quando o outro lado aceitar a proposta, atualize o resumo; o acordo entra no subtotal, ainda **aguardando aceite** da participação se o músico não confirmou o show.
6. Quando o músico também aceitar o convite, o valor passa para **Cachês com participação aceita**.
7. Convites recusados/cancelados não entram nos totais; propostas em negociação ou convites aceitos sem acordo continuam visíveis, mas sem valor inventado.
8. Teste com outra conta logada; ela não deve conseguir consultar os dados de um evento pertencente a outro organizador.
9. Confirme que os valores não aparecem no perfil público do cantor nem ativam cobranças, planos ou subdomínios.

## Próximas melhorias possíveis

Registro privado de despesas extras, cachê cobrado do contratante, recebimentos e lucro estimado. Isso exigirá campos e permissões adicionais; não faz parte do resumo atual.
