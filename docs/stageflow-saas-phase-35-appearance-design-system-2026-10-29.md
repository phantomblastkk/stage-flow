# StageFlow — Parte 35: controles de aparência no Design System

Base: 36af509d89237b5116ebfd99715048ae9dc93921, diretamente na main.

## Problema, impacto e implementação

| Problema | Impacto | Correção |
|---|---|---|
| Botões de tema, cor, recolhimento, restauração e salvamento com estilos próprios | Duplicação de CSS e estados de interação diferentes | Button compartilhado em todas as ações deste bloco; preservadas amostras e layout específicos dos temas |
| Setas de reordenação com 30×30 px | Alvo pequeno no celular | Botões de 44×44 px; rótulos de checkbox com área de toque de 44 px |
| Tema e cor agrupados apenas por títulos | Leitura dos grupos menos clara em tecnologia assistiva | Fieldset/legend para Tema do perfil, Cor de destaque e Organizar seções |
| Controles sem foco consistente | Navegação por teclado pouco perceptível | Foco do Button compartilhado e regra equivalente para os checkboxes nativos |
| Recolhimento sem relação explícita com as opções | Relação entre ação e conteúdo pouco clara | aria-expanded/aria-controls e conteúdo oculto com hidden, mantendo escolhas e bloqueios |
| Avisos do design com painel próprio | Estilos de feedback duplicados | InlineNotice compartilhado, mantendo os textos e papéis de erro/status |

Somente apresentação e composição foram alteradas. Comparação textual do componente
antes do retorno principal confirma hooks, carregamento, handlers e payloads idênticos
à base. Permanecem os três temas, cinco cores, IDs das seções e as regras de publicação.

O botão Restaurar padrão continua mudando apenas a prévia local. É necessário salvar
explicitamente. Mudar tema, cor, visibilidade ou ordem não grava nem publica. A última
seção visível continua protegida, e recolher/abrir não contorna um save pendente.

## Arquivos e diff

- components/singer-pro-editor.tsx: Button/InlineNotice compartilhados, grupos
  nativos, ícones decorativos, relação de recolhimento e campo de opções ocultável.
- app/meu-perfil-artistico/site-profissional/premium-preview.css: retirada de bases
  de botão/feedback duplicadas; composição local, tokens, foco e alvos de toque.
- tests/browser/operational-home.mjs: controles por teclado, grupos acessíveis,
  amostras selecionadas, prévia, restauração e salvamento explícito com API simulada.

`git diff 36af509 -- components/singer-pro-editor.tsx app/meu-perfil-artistico/site-profissional/premium-preview.css tests/browser/operational-home.mjs`

## Validação

266 testes Node, TypeScript e build aprovados localmente e nos dois CIs.

Cenários novos em 360/768/1280 px: três temas e cinco cores por teclado com uma única
opção selecionada em cada grupo; classe correspondente na prévia; botões compartilhados
com type=button e alvos de 44 px; foco visível nas setas e checkboxes; área de toque dos
rótulos; última seção preservada; ordem alterada por teclado; recolhimento preservando
tema/cor/ordem; restauração sem save automático; recolher/abrir durante save pendente
mantendo os controles bloqueados; payload padrão gravado somente na ação explícita;
nenhuma publicação ou consulta extra introduzida pelos controles.

## Evidências finais

- Código testado: d92697a439471df834313a65d4dba89e25e1d5a3.
- [Diff completo](https://github.com/phantomblastkk/stage-flow/compare/36af509d89237b5116ebfd99715048ae9dc93921...d92697a439471df834313a65d4dba89e25e1d5a3).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40875817224).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40875817214): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas de navegador com API simulada.
- Logs registram PASS appearance controls em 360/768/1280 px. Nenhuma consulta adicional ou publicação introduzida pelo uso dos controles.
- Artefato operational-ux-evidence ID 12898576053: 102 PNGs e seis JPGs. Seis capturas novas dos controles e da navegação por teclado nos três tamanhos.
- Revisão visual das capturas em 360 e 1280 px; alvos de botão e rótulo de pelo menos 44 px, foco, agrupamento e ausência de overflow também verificados no navegador. Capturas de componentes incluem a navegação global fixa.
- premium-preview.css: 561 → 539 linhas, retirando estilos de base de botão e feedback substituídos pelo Design System. Isso não representa redução medida de bundle.
- Comparação textual dos hooks e handlers anteriores ao render principal: idênticos à base.
- Revisão React: sem novo hook, listener, consulta ou dependência; agrupamento nativo, type=button, aria-pressed, ícones decorativos e hidden com foco indisponível no conteúdo recolhido.

## Limites e continuidade

Sem alterações em Auth, RLS, schema, RPC, buckets, permissões ou dados de produção.
Nenhuma alteração nos temas públicos ou na paleta de dados; as amostras continuam
específicas da aparência do perfil. Não há medição de latência ou bundle nesta parte.

A migração geral de CSS continua parcial. Próxima parte: padronizar os formulários e
as ações da galeria (campos de foto/vídeo, renomeação e remoção), mantendo a recuperação
e a proteção de respostas incertas já testadas.

Sem deploy.
