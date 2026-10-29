# StageFlow — Parte 42: convite individual do Marketplace

Data: 29/10/2026. Base: 22673ec709f98f55fe1aa192a598b25d21c17029.

## Problema, impacto e solução aplicada

O painel declarava um modal sem conter foco ou devolver foco à origem. A leitura
falha de shows podia sugerir agenda vazia. O envio tinha apenas bloqueio por estado
React, sem finally, e podia perder o contexto de uma resposta incerta.

- Cabeçalho com fechar permanece visível durante rolagem. Feedback do convite fica
  junto do formulário e recebe foco após a resposta, separado das avaliações.
- Dialog HTML nativo em portal no body, com fundo inerte, Tab/Shift+Tab, Escape,
  clique no fundo, bloqueio/restauração de scroll e retorno ao botão de origem.
- Fechamento e ações concorrentes bloqueados durante convite/avaliação pendentes.
  Finally também libera o estado de avaliação se sua chamada lançar exceção; a revisão
  completa de leitura/publicação de avaliações continua na próxima parte.
  Encaminhar uma denúncia fecha o painel nativo antes de abrir o diálogo existente.
- Select/Textarea/Button compartilhados, rótulos e fonte de 16 px; campos de convite
  bloqueados durante envio e quando uma resposta incerta precisa ser reconciliada.
- Shows distinguem carregamento, falha, resposta inválida, agenda vazia e agenda válida.
  Retentativa/atualização preservam os valores do formulário e não refazem catálogo.
- Confirmação nativa preservada; lock síncrono antes da confirmação, try/catch/finally,
  verificação de montagem/versão e snapshot do payload.
- Cancelar confirmação não envia. Erro de negócio preserva show/mensagem. Transporte
  ou resposta desconhecida não anunciam sucesso; confirmação seguinte repete exatamente
  o mesmo payload. Não há reenvio automático.
- Sucesso sent limpa a mensagem. already_exists preserva o texto e informa que nenhuma
  nova mensagem foi enviada. Pares já confirmados ficam bloqueados no painel atual.

## Contrato e limites

Mantido stage_marketplace_invite_musician com event_id/musician_id/message e
stage_marketplace_my_events. Revisado o SQL existente em
supabase/marketplace_moderation_migration.sql: autorização por auth.uid, show próprio,
regras de disponibilidade e on conflict(event_id,musician_id) do nothing, com retorno
already_exists. Nenhuma migration ou consulta de produção foi executada.

O browser simula o contrato de unicidade; não atesta a instalação dessa migration
no banco de produção. A retomada explícita de resposta incerta depende desse contrato
já existente. Não há envio real externo ou pagamento nos testes.

## Validação

266 testes Node, TypeScript e build aprovados no CI do código final
eb5b8d2898ffdb799a106e7f5d497a64685cc496. Verificações locais também passaram; o CI
final inclui os ajustes de pares, foco do feedback e limpeza de avaliação.
Jornadas sintéticas em 360/768/1280 px cobrem foco, fechamento, shows falhos/inválidos,
confirmação cancelada, envio pendente, tentativa duplicada, erro de negócio, sucesso,
resposta de commit incerta, mesmo payload, already_exists, preservação de mensagem,
agenda vazia válida, limites do viewport e encaminhamento para denúncia sem envio.

## Evidências finais

- [Diff da etapa](https://github.com/phantomblastkk/stage-flow/compare/22673ec709f98f55fe1aa192a598b25d21c17029...eb5b8d2898ffdb799a106e7f5d497a64685cc496).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40963933320).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40963933321): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas sintéticas de navegador.
- PASS marketplace invitation em 360/768/1280 px. Quatro chamadas simuladas cobrem rejeição, sucesso, commit com resposta perdida e confirmação por already_exists; dois pares únicos criados no fixture, sem duplicação.
- Artefato operational-ux-evidence ID 12936988165: 141 PNGs e seis JPGs, com seis capturas novas do convite incerto e confirmado.
- Revisão visual final em 360 e 1280 px: erro/sucesso junto do formulário, mensagem preservada, foco visível e fechamento no cabeçalho. As primeiras capturas revelaram feedback distante do formulário; essa posição foi corrigida e a visibilidade passou a ser testada.
- marketplace-catalog.css: 714 → 710 linhas; remoção de estilos antigos do modal/campos e inclusão das regras do diálogo nativo. Sem medição de bundle ou latência.
- Revisão React: efeito de modal depende da identidade selecionada, portal isolado, limpeza de scroll/foco e proteção de respostas por montagem/versão. Lock síncrono do envio e pares confirmados em ref; eventos sem listeners globais novos.
- O caminho completo de exceção/publicação de avaliações ainda não tem jornada específica nesta parte; sua limpeza foi revisada e compilada, e a cobertura de avaliações é o próximo passo.

## Continuidade

Revisão e migração de CSS seguem parciais. Próxima parte: avaliações verificadas no
mesmo painel — leitura separada de vazio, recuperação e proteção de publicação sem
perder nota/comentário. Sem deploy; auto deploy permanece desabilitado.
