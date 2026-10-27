# Stage Flow — Escala e substituição de músicos por show

## Estado da entrega
Repositório `phantomblastkk/stage-flow`, somente branch `develop`. Banco atualizado exclusivamente no projeto QA `zycuprhymoukhnuamtit`, com a migração `supabase/show_team_lineup_migration.sql`. Nenhuma alteração no banco de produção `bmudkggwjybyjuhgefvw`.

Página: `/eventos/equipe?evento=<ID do show>`. Há acesso a partir do painel **Montar a equipe** de cada show em `/eventos` e de cada ocorrência em `/shows-recorrentes`.

## Como funciona
- O proprietário do evento importa posições de uma formação já salva em `/equipes` ou adiciona manualmente quantas vagas precisar (até 40 por evento).
- Uma equipe importada sugere o músico original e o instrumento, mas **não envia convite**. Importar a mesma formação novamente não duplica as posições.
- Cada vaga aceita um convite individual, ou pode reutilizar convite já pendente/aceito daquele músico para a apresentação. Um convite não pode ocupar duas vagas ao mesmo tempo.
- O painel mostra confirmação, aguardando resposta, recusa, cancelamento e posições abertas. Convites feitos por outros fluxos aparecem em **Convites fora da escala**, sem serem omitidos da contagem.
- A resposta do músico é lida da tabela original `invitations`. Nenhum status é inventado. Cachês continuam no financeiro do evento e não são copiados para tabelas de formação.
- Para substituir um músico que recusou, sua vaga permite convidar outro músico conhecido. Se o convite estiver pendente ou aceito, o organizador precisa entrar em **Liberar vaga / substituir músico**, informar um **motivo de 5–250 caracteres** e confirmar o cancelamento explícito. O sistema muda o convite anterior para `cancelled`, registra o motivo no histórico da posição e libera a vaga. O músico passará a ver o convite como cancelado no Stage Flow.
- Nenhum WhatsApp é enviado automaticamente; para uma participação aceita, recomenda-se confirmar diretamente com o músico antes de cancelar. Cancela o convite dentro do sistema; não rescinde automaticamente contratos externos ou executa estorno financeiro.
- A vaga não pode ser apagada se houver convite ou histórico de substituição. Isso preserva a trilha de alterações. Eventos cancelados, concluídos ou com horário já passado ficam somente para consulta.

## Privacidade e limites
- Duas tabelas privadas com RLS habilitado: `stage_show_lineup_slots`, `stage_show_lineup_assignments`, sem `SELECT` direto para `anon` ou `authenticated`.
- RPCs `stage_show_lineup_overview`, `stage_show_lineup_add_slot`, `stage_show_lineup_import_team`, `stage_show_lineup_invite`, `stage_show_lineup_release`, `stage_show_lineup_remove_slot`. Todas exigem proprietário do show; gravações serializam sobre o evento para impedir substituições concorrentes.
- Seleção de músicos exige que a pessoa seja artista, que tenha colaboração anterior com o organizador ou faça parte de equipe salva pelo mesmo dono. Nenhum número de telefone, email, API token ou dado financeiro de terceiros é retornado.
- A troca de músico não altera automaticamente a disponibilidade nem cancela compromissos semanais do substituto: antes de convidar, confirmar a agenda no Stage Flow. O fluxo antigo de convites ainda exige extensão das verificações de conflito para lançamento.
- Funções do histórico e dos relatórios existentes são reutilizadas; convite `cancelled` não é contado como contratação ativa. Valores anteriormente pagos não são automaticamente apagados nem estornados.

## Verificação
- Contratos automatizados em `tests/show-team-lineup.test.mjs`, comando `npm run test:show-team-lineup`, integrado ao build do GitHub.
- SQL de homologação testado em transação: dono cria, lista e remove vaga; valida motivo; visitante não lê ou modifica escala; permissões das tabelas não permitem leitura direta. `ROLLBACK` ao final; nenhum show fictício persistido.
- Pendente para rodada de QA completa: fluxo real de convite/aceite/cancelamento/substituição envolvendo **duas contas**, validação manual das notificações internas, interação com cachês já recebidos e checagem de calendário do substituto.
- Não publicar em produção nesta etapa. A Vercel de homologação deve receber manualmente o último commit aprovado da `develop`.
