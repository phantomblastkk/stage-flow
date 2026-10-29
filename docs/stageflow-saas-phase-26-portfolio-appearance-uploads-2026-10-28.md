# StageFlow — Parte 26: aparência, uploads e publicação do editor

Base: `023920673409728efe8a66c53eba136268cf64c5`, diretamente na main.

## Problema → impacto → implementação

| Problema | Impacto | Solução aplicada |
|---|---|---|
| Inputs de arquivo invisíveis sobrepostos ao rótulo | Foco e área de interação pouco claros | Input type=file compartilhado, visível, com label/hint associados e aria-busy |
| Rótulos de tema/cor/layout não associados formalmente | Grupos difíceis de interpretar por tecnologia assistiva | Fieldset e legend, mantendo botões com aria-pressed |
| Cartões e amostras de cor usavam botões próprios | Alvos e comportamento visual divergentes | Button do Design System, layouts locais e alvos mínimos de 44 px |
| JSX concentrava estilos de apresentação | Alterações visuais espalhadas pelo componente | Classes do domínio para hero, fotos, publicação, ações e cabeçalho da prévia |
| Checkbox de publicação tinha apresentação inline | Instrução e interação menos padronizadas | Controle nativo com área de rótulo e descrição associada, estilo local com tokens |
| Regras locais de .field e mp-file-upload ficaram sem consumidores | CSS duplicado após a migração | Sete regras obsoletas removidas da folha moderna do editor |

## Diff aplicado

- components/instrumentalist-profile-editor.tsx: uploads via Input compartilhado,
  grupos com legend, botões de opções compartilhados, classes no lugar dos estilos
  inline estáticos e descrição explícita da publicação. Botões da prévia com ref
  permanecem nativos para preservar foco e trap de teclado.
- src/domains/artists/styles/musician-portfolio-editor.css: composição local dos
  cartões, grupos e publicação; paletas de tema por data-theme; regras do layout
  retiradas do JSX. Sem mexer nos oito segmentos de compatibilidade do layout.
- tests/browser/operational-home.mjs: uploads completamente simulados por contexto,
  validação de extensão/tamanho, estado ocupado, retirada local das fotos e
  seleção de publicação por teclado, antes dos cenários existentes de salvamento.

Diff: `git diff 0239206 -- components/instrumentalist-profile-editor.tsx src/domains/artists/styles/musician-portfolio-editor.css tests/browser/operational-home.mjs`.

## Regras preservadas e verificação de segurança

Comparação textual do corpo do componente antes do primeiro retorno de renderização:
sem alterações em hooks, uploadPhoto, save, Auth, Storage ou validações. Mantidos:
JPG/PNG/WebP até 5 MB, preparação do retrato quadrado, pasta por usuário e UUID,
cacheControl 3600, upsert=false, envio bloqueando save/outro upload, e gravação
separada de upload. Remover da página continua mudando somente o rascunho local;
não exclui objetos armazenados. Selecionar publicação não grava automaticamente.

Integração existente conferida com a documentação oficial:
https://supabase.com/docs/reference/javascript/storage-from-upload . O índice
changelog.md não pôde ser lido pela ferramenta por tipo de conteúdo não suportado;
nenhuma API, dependência Supabase, chave, bucket, RLS ou permissão foi modificada.
Nenhum teste usou usuário, Storage ou banco de produção. O mock usa exclusivamente
example.supabase.co e confere bucket, pasta do ator, UUID e header x-upsert=false.

## Medição e limite

Atributos style no componente, por AST: 31 → 3 (28 removidos).
Restam apenas largura do progresso, cor da amostra selecionável e imagem de capa,
com valores calculados a partir do estado. O restante da plataforma ainda contém
estilos legados; não há declaração de migração geral concluída ou ganho de bundle.
A paleta decorativa dos três temas continua específica do domínio, enquanto foco,
seleção, espaçamento e controles usam tokens e componentes compartilhados.

## Validação

- 265 testes Node, TypeScript e build aprovados localmente. No commit
  `5520272c23b86619474886daaddda3cbb6bda3f8`, ambos os workflows passaram:
  [Integration and build](https://github.com/phantomblastkk/stage-flow/actions/runs/40800540180)
  e [Operational UX](https://github.com/phantomblastkk/stage-flow/actions/runs/40800540066),
  incluindo os 265 testes e PostgreSQL temporário no operacional.
- Todos os três cenários novos de upload passaram, além dos cenários anteriores
  de formulário, temas e jornada operacional. Evidência:
  [36 PNGs e log](https://github.com/phantomblastkk/stage-flow/actions/runs/40800540066/artifacts/12865976039).
  Inspeção visual dos uploads em 360/1280 px: labels, inputs nativos, imagem e capa
  anexadas, botões de retirada e textos associados. Capturas de página incluem
  controles fixos do workspace; sem teste em Safari físico.
- Os 24 cenários PASS de agenda-finance também passaram:
  [Artefato](https://github.com/phantomblastkk/stage-flow/actions/runs/40800540180/artifacts/12865204011).
  Retenção de sete dias para artefatos de navegador.
- Três novos cenários de upload em 360/768/1280 px: input nativo visível/focável,
  tipo inválido e arquivo acima de 5 MB recusados antes de Storage; envio simulado
  com retrato JPG, busy bloqueando capa/submit, capa enviada sem publicar e retirada
  das duas imagens sem chamada DELETE.
- Publicação selecionada/desmarcada por Space sem gravar; rascunho continua privado
  no cenário de formulário já existente. Temas, layouts, erro/retry, payload de todos
  os campos e prévia ampliada continuam sendo exercitados.
- Revisão React: mesmas fronteiras client/server, sem novos hooks/queries; controles
  mantêm values, callbacks, IDs e estado. Button continua type=button nas opções.

## Próxima etapa

Revisar as preferências antigas do Marketplace e o contato para contratação dentro
do editor, incluindo a cópia de lançamento futuro que ainda aparece nesse bloco.
Migrar seus controles sem mudar consentimentos, disponibilidade ou permissões.
Continuar a retirada gradual dos consumidores de .field/.btn por jornada.

Sem deploy, migrations, alterações de credenciais, regras comerciais ou pagamentos.
