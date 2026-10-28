# StageFlow — Parte 15: CSS de Agenda e Financeiro

Base: `160d10aa5b5cf08f0ab58c4e31012b154672f4fe`, trabalho direto na main.
Sem deploy, alterações no banco ou ativação das RPCs candidatas da Parte 13.

## Problema, impacto e solução aplicada

| Problema | Impacto | Código aplicado |
|---|---|---|
| Agenda tinha 56 atributos style | Layout e estados difíceis de manter | Classes com escopo agenda em agenda.css, seleção via aria-pressed e destaque via is-highlighted |
| Financeiro misturava controles locais e compartilhados | Foco, dimensões e feedback inconsistentes | Select para atuação/ano/mês, Input para pagamento e Button para ações |
| CSS financeiro mantinha regras de controles e KPI antigos | Sobrescritas e manutenção duplicadas | Remoção dos seletores substituídos e consolidação da grade de indicadores |
| Cores locais divergentes | Estados de erro e destaque variavam por tela | Tokens de superfície, borda, texto, marca, sucesso e erro; InlineNotice reutilizado |
| Sugestões de local/cidade sem limite visual | Lista podia crescer sobre o formulário | Altura limitada com rolagem, alvos de pelo menos 44 px e texto com quebra |
| Pagamento inválido sem alerta semântico | Erro podia passar despercebido por leitor de tela | InlineNotice danger com role alert, mantendo validação e bloqueio de escrita existentes |

## Medição

Contagem por AST TypeScript comparada com a base:

| Página | Atributos style antes | Depois |
|---|---:|---:|
| app/eventos/page.tsx | 56 | 0 |
| app/financeiro/page.tsx | 4 | 1 |

59 atributos style removidos. O único restante é largura calculada da barra de
categorias financeiras: dado dinâmico, mantido deliberadamente.
As duas folhas locais não usam cores hexadecimais nem variáveis legadas
bg/panel/line/muted/text/lime. Não foram adicionadas folhas CSS ou dependências.
O globals.css continua com 52.008 bytes: outras páginas e componentes filhos
continuam usando seletores legados, portanto sua remoção exigirá migrar esses consumidores.
Não há alegação de redução de bundle ou ganho de latência medido.

## Comportamento preservado

- Serviços, hooks, cálculos, filtros, exportação CSV, permissões e requisições não mudaram.
- Datas, seleção do mês, cursores, links para show específico e confirmação de exclusão mantidos.
- Pagamentos continuam sendo registros manuais, sem transferência e sem alterar recebimento pessoal do músico.
- Inputs mantêm IDs/labels, eventos e valores; selects têm labels vinculados por ID.
- Botões nativos do calendário/sugestões e gatilho com ref mantêm seu comportamento; ações comuns usam o Design System.
- Painéis filhos EventBudgetPanel, EventTeamInvites e flyer continuam com seus estilos existentes.
  Esta etapa não declara a migração desses editores como concluída.

## Validação

- 220 testes Node passaram localmente; TypeScript e build de produção passaram.
- Cenários existentes de navegador mantidos em 360/768/1280 px.
- Ampliada verificação de teclado Atuação → Ano → Mês e pagamento → Salvar.
- Pagamento inválido não envia escrita; aviso de erro e ação principal têm contraste calculado mínimo de 4,5 nos pares exercitados.
- Formulário de agenda aberto sem overflow e captura nas três larguras.
- Campo de pagamento usa ao menos 16 px no celular e botão Salvar tem ao menos 44 px.
- Revisão React: nenhum novo efeito, controlador, fetch ou dependência; componentes comuns declarativos.
- CI aprovado para `56e78350d3b4ab1363d90c214ffceda96c19d4b6`:
  [execução 40632875281](https://github.com/phantomblastkk/stage-flow/actions/runs/40632875281).
  Doze cenários de navegador passaram; artefato contém 23 PNGs e log do servidor.
- Inspeção visual do formulário de agenda em 360/1280 px e do editor financeiro
  em 360 px: campos, calendário, avisos e ações permanecem dentro dos painéis.
  Comparação com capturas da Parte 14 realizada. Painéis filhos continuam com
  identidade visual legada; barra inferior e elementos fixos aparecem na posição
  da viewport nas capturas de página inteira.
- Capturas [antes](https://github.com/phantomblastkk/stage-flow/actions/runs/40631805523/artifacts/12791677457)
  e [depois](https://github.com/phantomblastkk/stage-flow/actions/runs/40632875281/artifacts/12792746194).
  Retenção dos artefatos: sete dias.
- [Diff da implementação](https://github.com/phantomblastkk/stage-flow/compare/160d10aa5b5cf08f0ab58c4e31012b154672f4fe...56e78350d3b4ab1363d90c214ffceda96c19d4b6).

Testes de navegador usam API sintética; não são testes com contas ou dispositivos reais.

## Próxima fatia

Migrar editores compartilhados de equipe/orçamento antes de remover seus seletores
legados. Depois continuar perfis, portfólios e editores públicos. Consolidação
geral do CSS segue parcial, sem apagar estilos ainda usados por outras rotas.
