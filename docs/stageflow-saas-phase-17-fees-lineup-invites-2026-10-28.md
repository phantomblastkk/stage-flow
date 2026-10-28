# StageFlow — Parte 17: cachês, escala e convites enviados

Base: `48bf50636894944e645fba28343e6b4bd0affff8`, trabalho direto na main.
Sem deploy, migrations, alterações remotas no banco ou envio de mensagens reais.

## Problema → impacto → alteração aplicada

| Problema | Impacto | Solução |
|---|---|---|
| Convites enviados tinha 47 atributos style | Layout e estados espalhados no JSX | Folha convites.css com classes locais; zero atributos style na página |
| Filtros, formulários e feedback tinham estilos próprios | Foco, labels e mensagens divergiam entre páginas | Button, Input, Select, Textarea, InlineNotice, LoadingState e StatCard compartilhados |
| Resumo de cachês e escala tinham badges diferentes | Estados ativos/inativos difíceis de comparar | StatusChip compartilhado com texto explícito; valores ausentes continuam A definir |
| Cores locais e controles duplicados | Manutenção e contraste inconsistentes | Tokens semânticos em equipe-show.css e event-financial-summary.css; regras substituídas removidas |
| Ações de substituição/histórico eram pequenas | Uso difícil por toque/teclado | Botões compartilhados com 44 px, summary de histórico com 44 px e foco visível |
| Nomes longos e valores disputavam espaço no celular | Cards podiam transbordar | Quebra de nomes/títulos, campos min-width 0 e detalhe monetário abaixo do nome em telas estreitas |

## Comportamento preservado

- Nenhuma alteração em RPCs, serviços de dados, permissões ou cálculos de cachê.
- Cachê acordado não vira pagamento; proposta aberta e convite inativo continuam
  fora do subtotal. Valores ausentes não são convertidos em zero.
- Lembrete continua link de WhatsApp apenas quando músico tem telefone autorizado;
  a ação exige envio no aplicativo externo. Não há mensagem automática.
- Criar posição/importar formação não envia convite; convite e liberação continuam
  com confirmação explícita. Substituição exige motivo e mantém histórico.
- Show passado, cancelado ou concluído mantém os controles de alteração bloqueados.
- IDs dos campos existentes, labels, filtros de evento/status e links foram mantidos.
  Artigos da escala receberam nome acessível por vaga.
- Confirmações nativas foram mantidas. CSS global e outras rotas ainda dependem
  de regras legadas; a migração geral não está concluída.

## Medição

Convites enviados: 47 → 0 atributos style, contados por AST TypeScript.
Escala e resumo já não tinham style inline; esta etapa migrou controles e CSS.
As três folhas locais não usam hexadecimais de cor nem variáveis legadas de cor.
Uma folha adicionada para substituir os estilos inline; nenhuma dependência nova.
Não há alegação de ganho de latência, redução medida de bundle ou certificação de escala.

## Validação

- 262 testes Node, TypeScript e build de produção passaram localmente.
- Mantidos os doze cenários existentes; adicionados três cenários compostos em
  360/768/1280 px, com API sintética, para cachês, convites enviados e escala.
- Resumo: valor acordado, proposta pendente, valor indefinido e convite inativo.
- Convites: filtros de evento/status, link autorizado, botão sem autorização
  desabilitado e erro de leitura explícito, sem acionar WhatsApp.
- Escala: criação sem convite implícito, confirmação cancelada/aceita, mensagem,
  motivo mínimo, liberação cancelada/confirmada, histórico e bloqueio de show encerrado.
- Verificação de overflow e contraste do aviso de erro nos estados exercitados.
- Revisão React: componentes compartilhados declarativos, sem novos efeitos,
  listeners ou consultas em produção.
- CI e inspeção visual: registrar após a execução.

## Continuidade

Próxima fatia: formulários de formações salvas e shows recorrentes. Remover estilos
globais somente após conferir os consumidores restantes; manter as regras de
convite, cachê e cancelamento sob teste ao longo da migração.
