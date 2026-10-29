# StageFlow — Parte 32: recuperação e proteção da galeria privada

Base: cceb69901c07b42d4db0161bdc1e0e989e05aa9e, diretamente na main.

## Problema, impacto e correção

| Problema | Impacto | Implementação |
|---|---|---|
| Falha de leitura exibida como galeria vazia | Usuário pode repetir cadastro sem conhecer a lista real | Estado de disponibilidade separado de loading; erro com Atualizar galeria; null não é lista vazia |
| Recarregar descartava o contexto da operação | Perda de confiança na lista e nos limites | Itens anteriores mantidos em falhas; ações bloqueadas até reconciliar a lista |
| Título de foto apagado mesmo após falha | Usuário precisa redigitar | Limpeza do campo somente após confirmação de cadastro |
| Resposta incerta da RPC seguida de exclusão do arquivo enviado | Uma foto cadastrada no banco pode perder seu arquivo | Nenhuma exclusão automática após cadastro rejeitado ou incerto; arquivo permanece privado |
| Nova operação permitida enquanto resultado anterior era incerto | Possibilidade de duplicação ou alteração sobre lista antiga | Atualização obrigatória após erro de transporte; trava síncrona e estados separados para leitura e alteração |
| Remoção de item libera a galeria antes da exclusão privada terminar | Operações concorrentes e mensagens incompletas | Trava mantida durante confirmação, atualização e tentativa de exclusão privada |
| Erro de miniatura confundido com falta de arquivo | Imagem parece removida | Mantém registro, avisa sobre miniatura indisponível e permite nova tentativa |
| Galeria indisponível não bloqueia publicação Pro | Possibilidade de publicar sem conhecer a lista | Controle existente recebe loading ou indisponibilidade e conserva seus bloqueios |

Mantidos o bucket privado, expiração de 3600 s para prévias, limites de 3 fotos/3 vídeos,
validação JPG/PNG/WebP de até 5 MB, UUID/pasta por usuário, upsert=false, payloads e RLS.
Vídeos continuam com validação HTTPS e ID do YouTube. Remoção continua exigindo ação
explícita e a confirmação da RPC antes de tentar apagar o arquivo privado.

Depois de gravação confirmada e atualização de lista rejeitada, a mensagem distingue
as duas coisas: a gravação ocorreu; a lista precisa ser atualizada. Os campos são
limpos somente nesse caso confirmado, evitando que o usuário duplique o envio.

## Arquivos e diff

- app/meu-perfil-artistico/site-profissional/premium-media-gallery.tsx: leituras com
  descarte após desmontagem, disponibilidade, tentativa explícita, tratamento de
  exceções, travas, preservação de campos, mensagens e controle nativo de arquivo visível.
- app/meu-perfil-artistico/site-profissional/premium-media-gallery.css: fieldset,
  remoção da regra de arquivo invisível, espaço de ação e alvos/fontes mobile.
- components/singer-pro-editor.tsx: indisponibilidade da galeria bloqueia a publicação.
- tests/browser/operational-home.mjs: galeria com registros, imagens/Storage e RPCs
  inteiramente simulados; sem credenciais ou operações em produção.

`git diff cceb699 -- app/meu-perfil-artistico/site-profissional/premium-media-gallery.tsx app/meu-perfil-artistico/site-profissional/premium-media-gallery.css components/singer-pro-editor.tsx tests/browser/operational-home.mjs`

## Validação

266 testes Node e TypeScript aprovados localmente. Build e CI em validação.

Novos cenários em 360/768/1280 px: leitura rejeitada/ausente, recuperação da assinatura
da miniatura, itens e campos preservados após refresh rejeitado, tentativa pendente,
link de vídeo inválido, cadastro de vídeo incerto sem apagar campos, cadastro confirmado
com falha apenas no refresh, renomeação rejeitada com campo preservado, submissão
concorrente impedida, remoção recusada por mídia publicada sem DELETE, remoção
confirmada com falha na exclusão privada, tipo/tamanho de foto recusados e cadastro
simulado concluído no banco antes de resposta 503. Reconciliar esse último caso não
repete upload nem gravação e não apaga o arquivo. Design e publicação permanecem intactos.

## Limites e próxima etapa

Uploads rejeitados ou incertos podem deixar arquivos privados sem referência.
A limpeza desses arquivos precisa ser feita por processo posterior que confirme ausência
de referências; não foi criada uma rotina destrutiva nesta etapa. Se a exclusão privada
falhar após remoção confirmada, o registro permanece removido e a interface informa
que o arquivo privado ficou pendente. Sem retry automático dessa exclusão.

Não há teste novo de reprodução real do YouTube nem validação de teclado em iOS físico.
Destaque, reordenação e limites continuam com os contratos existentes; os novos cenários
priorizam recuperação, cadastros, renomeação e remoção. A migração geral de CSS continua parcial.

Próxima parte: revisão dos estados de leitura/erro do controle de publicação Pro,
com confirmação, permissões e preservação de rascunhos antes de publicar ou desativar.

Sem deploy, migration ou alterações em dados de produção.
