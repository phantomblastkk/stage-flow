# StageFlow — Parte 39: controles e foco do player de vídeo

Data: 29/10/2026. Base: 09e494fc5571054ab353b86508c3e0b3eccaf439.

## Problema, impacto e solução aplicada

Ao reproduzir pelo cartaz, o botão era substituído pelo iframe sem definir um
controle de foco. Fechar podia deixar o foco perdido. O booleano de reprodução
também podia iniciar o próximo vídeo caso a mídia ativa saísse da lista, contrariando
a exigência de reprodução somente após ação explícita.

- Reprodução vinculada ao ID da mídia e ao ID do YouTube escolhidos pelo usuário.
  Remoção ou troca da origem interrompem a reprodução; o fallback continua no cartaz.
- Abrir move o foco para Fechar player; fechar volta à miniatura de origem ou ao
  cartaz recriado. Scroll respeita prefers-reduced-motion e não adiciona listener.
- Fechar player usa Button. Link externo usa os estilos compartilhados, preservando
  semântica, endereço correto, nova aba e noopener/noreferrer. Alvos de 44 px.
- Região do player nomeada, grupo de miniaturas acessível, estado selecionado e
  aria-controls associados à área de reprodução. Status informa quando reproduz.
- Iframe continua ausente antes da ação explícita. Após a ação, loading eager evita
  adiar a navegação do iframe montado; domínio youtube-nocookie preservado.
- Retirados estilos duplicados dos controles de fechar e link externo.

## Invariantes

Hook de dados e editor de mídia permanecem textualmente idênticos à base. Visualizador de fotos e suas proteções preservados.
Sem nova dependência, chamada de domínio, alteração de banco, Auth, RLS, Storage,
permissões ou dados de produção. Sem deploy e com auto deploy desabilitado.

## Validação

266 testes Node, TypeScript e build aprovados localmente e no CI. Código validado:
58cd2a7b9fccf7a54bba06b2f8196027b84d3126.
Jornadas em 360/768/1280 px: iframe ausente antes de reproduzir, Enter/Space,
foco ao abrir/fechar, seleção, controles compartilhados de 44 px, link externo,
movimento reduzido, remoção/troca da origem durante reprodução e rota pública.
YouTube incorporado respondido por HTML sintético; nenhum vídeo externo é reproduzido.
Contadores verificam ausência de mutações e de leituras privadas no uso público.
A reprodução e disponibilidade reais do YouTube não são avaliadas por esse fixture.

## Evidências finais

- [Diff da etapa](https://github.com/phantomblastkk/stage-flow/compare/09e494fc5571054ab353b86508c3e0b3eccaf439...58cd2a7b9fccf7a54bba06b2f8196027b84d3126).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40889102652).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40889102732): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas sintéticas de navegador.
- Logs PASS video controls em 360/768/1280 px, na prévia e no perfil público.
- Artefato operational-ux-evidence ID 12904531899: 123 PNGs e seis JPGs, com seis novas capturas dos controles de vídeo na prévia e no perfil público.
- Revisão visual: controles no perfil público em 360 px e na prévia em 1280 px, com foco visível e ações inteiras. O conteúdo dentro do iframe é sintético; capturas de componente podem incluir a navegação fixa global.
- premium-media-gallery.css: 453 → 439 linhas. Removidos estilos de base substituídos pelo Design System; sem medição de ganho de bundle ou latência.
- O teste verifica o iframe como DOM e navegação simulada; não atesta disponibilidade, autoplay ou permissões reais de vídeos hospedados no YouTube.
- Revisão React: efeito depende da identidade e da reprodução, sem listener global; campos e operações do editor intocados; foco explícito e links semânticos.

## Continuidade

A migração geral de CSS e a revisão de acessibilidade continuam parciais.
Próxima parte: migrar busca, filtros e ordenação do Marketplace para o Design
System, preservando consultas, limites e recuperação de falhas. A verificação do
código atual encontrou inputs, selects e botões próprios nesse bloco de
components/marketplace-catalog.tsx, com estilos de base em marketplace-catalog.css.
