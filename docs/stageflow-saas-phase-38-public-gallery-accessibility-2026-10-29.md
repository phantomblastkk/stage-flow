# StageFlow — Parte 38: acessibilidade da galeria pública

Data: 29/10/2026. Base: dbc822b0908ccc4565eb3713ab95f787085ed8c5.

## Problema, impacto e solução aplicada

O visualizador anunciava um modal, mas não isolava o fundo, não prendia a navegação
por Tab e não devolvia foco à miniatura. A seleção por índice podia apontar para
outra imagem após atualização da lista; uma foto sem prévia podia fechar a navegação.
Isso prejudicava teclado, leitor de tela e uso no celular.

- Dialog HTML nativo aberto por showModal: camada modal e fundo inerte.
- Renderização em portal no body, com centralização explícita e limites do viewport,
  isolando a janela da disposição da prévia.
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
novas consultas de dados de domínio por abrir, navegar ou fechar fotos. Sem deploy.

## Validação

266 testes Node, TypeScript e build aprovados localmente e no CI. Código final
validado: 2f94b662d7573554592ecd5726e698703b5c5918.
Jornadas sintéticas em 360/768/1280 px cobrem uma/várias fotos, falta de prévia,
Tab/Shift+Tab, setas/ciclo, foco/restauração, fechamento por três caminhos,
reordenação e remoção durante leitura, retorno da foto e rota pública real.
Contadores verificam ausência de mutações e de consultas privadas no perfil público.

## Evidências finais

- [Diff da etapa](https://github.com/phantomblastkk/stage-flow/compare/dbc822b0908ccc4565eb3713ab95f787085ed8c5...2f94b662d7573554592ecd5726e698703b5c5918).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40887043657).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40887043636): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas sintéticas de navegador.
- PASS photo dialog em 360/768/1280 px, incluindo a rota pública /cantor-teste.
- Artefato operational-ux-evidence ID 12902603983: 117 PNGs e seis JPGs; seis novas capturas do visualizador na prévia e no perfil público.
- A revisão das primeiras capturas identificou deslocamento na prévia que o teste inicial não cobria. Adicionados portal no body, centralização explícita, interrupção da rolagem suave pendente e altura reservada para a imagem. A verificação agora espera a imagem carregar e mede os limites antes e depois da captura.
- No código final, logs registram top=87,5 e bottom=812,5 em viewport de 900 px nos três tamanhos, após a captura da prévia; a rota pública também tem verificação dos limites.
- Revisão visual final: prévia em 1280 px e perfil público em 360 px, com diálogo centralizado e controles inteiros. Área reservada evita salto ao carregar a imagem; a interrupção da rolagem pendente estabiliza a abertura por teclado.
- O hook de dados e todo o editor anterior ao showcase são textualmente idênticos à base, exceto imports. Nenhuma mudança de permissão, publicação ou leitura de dados de domínio.
- Revisão React: hooks antes dos retornos, IDs por instância, efeito de abertura separado da navegação, limpeza de scroll/foco, eventos locais e controles semânticos. Sem nova dependência.

## Continuidade

A migração geral de CSS e a revisão completa de acessibilidade continuam parciais.
Próxima parte: controles e foco do player de vídeo da galeria pública, preservando
carregamento do YouTube somente após ação explícita.
