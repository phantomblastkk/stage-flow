# StageFlow — Parte 38: acessibilidade da galeria pública

Data: 29/10/2026. Base: dbc822b0908ccc4565eb3713ab95f787085ed8c5.

## Problema, impacto e solução aplicada

O visualizador anunciava um modal, mas não isolava o fundo, não prendia a navegação
por Tab e não devolvia foco à miniatura. A seleção por índice podia apontar para
outra imagem após atualização da lista; uma foto sem prévia podia fechar a navegação.
Isso prejudicava teclado, leitor de tela e uso no celular.

- Dialog HTML nativo aberto por showModal: camada modal e fundo inerte.
- Tab/Shift+Tab circulam pelos controles; Escape, botão de fechar e clique no
  fundo fecham a janela. O foco volta à miniatura original se ela ainda existir.
- A rolagem de fundo é bloqueada e restaurada ao fechar ou desmontar.
- Seleção pela identidade da mídia, preservada em reordenação. Remover a foto ativa
  fecha o modal; reaparecer depois não deve reabrir uma seleção antiga.
- Setas e botões navegam circularmente apenas entre fotos com URL de prévia.
- Contador/título anunciados como status, instrução de teclado associada ao diálogo.
- Controles usam Button compartilhado, foco visível e alvo mínimo de 44 px.
- IDs dos títulos da galeria são únicos por instância. Ícones decorativos ocultos
  da árvore acessível; identificadores de seção e comportamento dos vídeos mantidos.

## Arquitetura e limites

PremiumGalleryShowcase é compartilhado pela prévia do editor e pelo perfil público.
O modal especializado usa a semântica nativa de diálogo e os controles do Design
System. Não altera o Modal genérico de outros fluxos. O efeito depende apenas da
abertura: trocar de foto não reinicia foco, trava de rolagem ou miniatura de origem.
Eventos de teclado ficam no diálogo, sem listener global.

Hook da galeria e operações de leitura/escrita permanecem idênticos à base.
Sem mudança de Supabase, Auth, RLS, Storage, permissões ou dependências. Não há
novas consultas por abrir, navegar ou fechar fotos. Sem deploy.

## Validação

266 testes Node, TypeScript e build aprovados localmente. CI e navegador em validação.
Jornadas sintéticas em 360/768/1280 px cobrem uma/várias fotos, falta de prévia,
Tab/Shift+Tab, setas/ciclo, foco/restauração, fechamento por três caminhos,
reordenação e remoção durante leitura, retorno da foto e rota pública real.
Contadores verificam ausência de mutações e de consultas privadas no perfil público.

## Continuidade

A migração geral de CSS e a revisão completa de acessibilidade continuam parciais.
Próxima parte: controles e foco do player de vídeo da galeria pública, preservando
carregamento do YouTube somente após ação explícita.
