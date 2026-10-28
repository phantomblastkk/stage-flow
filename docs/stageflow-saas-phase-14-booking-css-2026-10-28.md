# StageFlow — Parte 14: CSS e Design System de Contratações

Base verificada: `ced2e04af6eab5750e17ba01551426e6533a6131`. Branch exclusiva main.
Sem homologação, banco remoto, migration, ativação de RPC ou deploy.

## Escopo executado

Meus convites, negociação de cachê, propostas formais e conversas. A alteração
é de apresentação; serviços, controladores, permissões e regras de aceite foram
preservados. A paginação candidata da Parte 13 continua sem ativação remota.

## Problema → impacto → código

| Problema | Impacto | Alteração |
|---|---|---|
| 72 atributos style nas telas/componentes selecionados | Estilos repetidos e difíceis de padronizar | Classes com escopo em `booking/components/booking-ui.css`; componentes sem style inline |
| Botões/campos/avisos montados de formas diferentes | Estados e foco inconsistentes | Button/Input/Textarea/StatCard/StatusChip/Avatar/Badge/EmptyState/LoadingState reutilizados; novo InlineNotice compartilhado |
| Cores de erro/sucesso/bordas repetidas nos CSS locais | Variações visuais entre conversa e proposta | Tokens semânticos de estado, superfície, foco, raios e tipografia em `src/components/ui/tokens.css` |
| Formulários dependiam de regras globais .field/.btn/.feature | Estilos de outras áreas podiam interferir | Controles comuns usam sf-ui; layout de convites/cachê usa sf-booking; listas e bolhas mantêm classes locais |
| Cores fixas e controles duplicados em conversas/propostas | Manutenção repetida e textos pequenos | CSS locais tokenizados, regras de controles substituídas pelo Design System e estilos sem consumidores retirados |
| Feedback e filtros sem apresentação uniforme | Difícil identificar próxima ação | Avisos persistentes por estado, filtros com aria-pressed e grupo rotulado, status visual comum |

## Medição antes/depois

Contagem feita no AST TypeScript de atributos JSX, comparando a base com o código final:

| Arquivo | Atributos style antes | Depois |
|---|---:|---:|
| components/fee-negotiation.tsx | 30 | 0 |
| app/meus-convites/page.tsx | 41 | 0 |
| components/hiring-proposals.tsx | 1 | 0 |
| app/conversas/page.tsx | 0 | 0 |

Os dois CSS locais de conversas/propostas e o novo layout compartilhado não
possuem hexadecimais de cor nem variáveis legadas bg/panel/line/text/muted.
Isso não significa que todo o projeto foi migrado: `app/globals.css` continua
com 52.008 bytes, pois outras páginas ainda dependem dos seus seletores.

A contagem de arquivos CSS passa de 49 a 50 com a nova folha compartilhada.
Não foi usada redução de quantidade de arquivos como critério de qualidade.
Os quatro arquivos TSX selecionados têm aproximadamente 3,9 KB a menos de código
fonte, sem alegar redução equivalente do bundle ou ganho medido de latência.

## Componentes e acessibilidade

- InlineNotice separa mensagem persistente de Toast; danger usa role alert e os
  demais estados role status. Cores de Badge e avisos compartilham tokens.
- Inputs mantêm IDs, labels, tipos, limites e eventos; telefone/cachê/observações
  mantêm a ligação por label. Submit é explícito; ações secundárias continuam button.
- Foco visível, campos desabilitados durante escrita e ordem de teclado são mantidos.
- Histórico privado, confirmação separada do cachê, preferências opcionais e
  links para o show específico preservados.
- Navegação entre conversas e seus botões estruturais mantêm CSS próprio; não se
  substitui uma linha de navegação por um botão genérico apenas para remover classes.

## Validação

- 220 testes Node existentes, TypeScript e build de produção verificados localmente.
- Os doze cenários de navegador foram mantidos em 360/768/1280 px conforme escopo
  anterior e ampliados com screenshots do formulário de contraproposta e do editor.
- Tab/Shift+Tab entre valor e mensagem; ação principal com pelo menos 44 px;
  ausência de overflow no formulário; compositor dentro do painel.
- Contraste calculado de pelo menos 4,5 nos pares texto/fundo exercitados para
  ação primária e avisos de sucesso/erro. Isso não é certificação completa de acessibilidade.
- Revisão React: não há novas consultas, listeners, dependências ou controladores;
  o novo componente de aviso é declarativo e reutilizável.
- CI aprovado para `ec45f71d42207208f2ed13ddd21d05d7cbdf0df6`:
  [execução 40631805523](https://github.com/phantomblastkk/stage-flow/actions/runs/40631805523).
  Todos os doze cenários de navegador passaram; artefato contém 20 PNGs e log do servidor.
- Comparação visual realizada em convites/cachê (360 px) e conversas (768 px),
  além dos formulários abertos de contraproposta e proposta formal (360 px).
  Campos, ações e textos mantêm quebra dentro dos painéis; avisos usam estados
  semânticos e controles usam a mesma apresentação. A barra inferior fixa existente
  aparece no meio das capturas de página inteira por estar presa à viewport.
- Evidências [antes](https://github.com/phantomblastkk/stage-flow/actions/runs/40629819082/artifacts/12790877618)
  e [depois](https://github.com/phantomblastkk/stage-flow/actions/runs/40631805523/artifacts/12791677457).
  Artefatos do Actions têm retenção limitada a sete dias.
- [Diff completo da implementação](https://github.com/phantomblastkk/stage-flow/compare/ced2e04af6eab5750e17ba01551426e6533a6131...ec45f71d42207208f2ed13ddd21d05d7cbdf0df6).

Testes usam API sintética; não há validação com contas reais ou dispositivos iOS/Android reais.

## Continuidade

A consolidação geral de CSS ainda não terminou. Próximas fatias: Agenda e
Financeiro, depois perfis/portfólios e editores. Migrar consumidores antes de
remover regras globais; não apagar folhas antigas usadas por rotas fora deste escopo.
