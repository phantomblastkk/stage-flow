# Stage Flow — Shows recorrentes e equipes fixas (homologação)

## O que foi entregue
- Nova rota privada `/shows-recorrentes`, com atalhos em `/painel`, `/eventos` e `/equipes`.
- Organizador ou cantor pode criar uma **temporada semanal**, informando título, dia da semana, horário, data inicial/final, duração prevista, local, cidade, descrição e uma equipe salva opcional.
- A criação cadastra o modelo + gera **até oito datas** como eventos **rascunhos e privados** (`events.status='draft',show_publicly=false`). Podem ser geradas mais oito datas por clique, até 52 por série, em um período de até 180 dias.
- Eventos gerados são eventos convencionais do Stage Flow, com ID próprio e compatíveis com o calendário e com o financeiro/convites por evento.
- O sistema **não cadastra convites automaticamente**. O botão **Convidar equipe** aparece em cada evento com uma equipe vinculada e usa o RPC já existente `stage_invite_team_to_event`, com confirmação explícita. Cada integrante recebe convite individual e negocia o próprio cachê.
- Pausar a série interrompe somente a geração de novas datas; preserva todos os shows já criados, os convites, o histórico e o financeiro. Para mudar dados da temporada, crie outra série e pause a anterior.
- Datas que já possuem outro evento do mesmo organizador exatamente na mesma hora são ignoradas. A série evita duplicar a mesma ocorrência em cliques repetidos usando **unique(series_id,occurrence_day)** e lock por série. O conflito detectado nessa etapa é apenas coincidência exata de horário, **não** todas as sobreposições.
- O sistema não cria tarefas em background nem depende do marketplace público, do WhatsApp ou do aplicativo nas lojas. A próxima leva é gerada a partir de uma ação do usuário, não por Cron.

## Migrações
Somente **Supabase de homologação** `zycuprhymoukhnuamtit`:
1. `supabase/fixed_teams_migration.sql` — existente no repositório, mas ainda não estava instalado em QA; foi aplicado nesta etapa.
2. `supabase/recurring_show_series_migration.sql` — foi aplicado somente em QA.

A produção **não foi alterada**. Não aplicar esses SQLs ao banco oficial ainda.

## Segurança e tratamento de dados
- `stage_recurring_show_series` e `stage_recurring_show_occurrences` com RLS ligado, nenhum acesso direto a `anon`/`authenticated`.
- RPCs de leitura, criação, geração e pausa exigem `auth.uid()` e validam proprietário. Equipe deve pertencer ao mesmo organizador.
- Somente perfis de artista ou produtor criam séries. Há limites de até 100 séries por conta, 180 dias/temporada, 52 eventos/série, oito eventos por lote.
- Não são feitas transações Pix, pagamentos, mensagens WhatsApp nem publicação automática do calendário.
- Ao enviar convite de equipe, não se presume aceite do músico nem disponibilidade. O fluxo antigo de convite deve passar pelas regras adicionais de conflito antes do lançamento (a validação atômica do chat já existe, mas esta função anterior ainda não foi integrada ao guard).
- Todas as datas/horas geradas usam a referência de fuso `America/Sao_Paulo`.
- Fotos, flyer e faturamento dos novos shows continuam configurados individualmente no evento.

## Testes
- `npm run test:recurring-shows` está no CI, junto com os testes de agenda, contratações e finanças.
- Teste no banco de **homologação** executado em transação revertida: um dono criou série com equipe própria, gerou oito rascunhos, gerou mais datas, verificou ausência de convites automáticos, pausou sem apagar eventos e confirmou que outra conta não podia ler/gerar/reativar sua série. `ROLLBACK` preservou QA sem séries, equipes ou eventos fictícios.
- Depois do build, publicar manualmente o último commit `develop` no projeto Vercel de homologação. A produção permanece isolada.
- A rodada de testes completa com duas contas, aceitabilidade de convites, conflitos reais e relatórios financeiros segue para o refinamento, conforme preferência do projeto.
