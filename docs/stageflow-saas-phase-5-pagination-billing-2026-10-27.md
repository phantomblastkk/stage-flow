# StageFlow — Parte 5: paginação da Agenda e domínio financeiro

Base: `352291fabbac9d5181ece810c8e0e764714ee7ec`, branch `main`.
Trabalho feito exclusivamente na main, sem usar develop e sem acessar ambientes de homologação.
Nenhum deploy, migration ou alteração de dados/schema em banco remoto nesta parte.

## Problemas, impacto e código aplicado

| Problema | Impacto | Alteração |
|---|---|---|
| Agenda consultava todos os shows | Transferência e renderização cresciam com o histórico | Filtro remoto pelo mês ou dia selecionado; páginas de 20 com um item sentinela para saber se existe próxima página |
| Paginação por posição é sensível a exclusões | Remover uma linha pode deslocar a próxima página | Cursor composto por `starts_at` e UUID; ordem determinística, sem OFFSET; microssegundos PostgreSQL preservados |
| Uma lista paginada não contém todos os dias do mês | Marcação do calendário poderia omitir datas de páginas seguintes | Consulta separada apenas das datas, limitada a 500 por origem mais sentinela; aviso explícito se esse limite for ultrapassado |
| Link de show pode apontar a outro mês/página | Convite/contratação abriria uma agenda sem o show | Consulta direta limitada ao proprietário validado, seleção do mês e destaque do show sem duplicação; rolagem automática uma única vez |
| Show recém-criado pode cair fora dos 20 primeiros | Cadastro salvo parecia não existir | INSERT retorna o registro autorizado; o mês correto é selecionado e o show fica em destaque |
| Financeiro misturava rede, autorização e tela | Mudanças difíceis de testar e risco de resposta antiga | `src/domains/billing/services/finance-service.ts` e `types.ts`; leituras abortáveis e respostas tardias descartadas |
| Uma falha de Auth encerrava a navegação do Financeiro | Erro temporário confundido com sessão inexistente | Estados distintos para sessão ausente e validação temporariamente indisponível |
| Relatórios atuais têm limites internos de 400/300 | Histórico parcial poderia ser tratado como total e exportado | Detecção conservadora do limite conhecido; aviso de cobertura e exportação pausada nesse caso; sem calcular totais de uma página isolada |
| Mês do servidor pode divergir do mês local do navegador | Erro de hidratação e reconstrução do calendário | Mês definido no cliente após a montagem, com estado inicial de carregamento idêntico no servidor e navegador |
| Filtros financeiros eram recriados a cada edição de campo | Recalculava também o agrupamento mensal | Filtros memorizados por dados, atuação e período; agrupamento mensal mantém referências estáveis |

## Arquivos principais

- `src/domains/events/services/agenda-service.ts`: período, cursores, páginas, marcações e busca pontual de show.
- `src/domains/events/types.ts`: contratos de janela, cursor e origem.
- `app/eventos/page.tsx`: paginação independente de shows próprios e participações, erros recuperáveis e cancelamento ao trocar período.
- `app/eventos/agenda.css`: controles de carregamento com suporte mobile.
- `src/domains/billing/services/finance-service.ts`: leitura privada, Pro, equipe e registro manual de pagamentos pelas RPCs existentes.
- `src/domains/billing/types.ts`: DTOs financeiros.
- `app/financeiro/page.tsx`: consome os serviços; sem chamadas diretas a `.rpc()` ou tabelas.

As RPCs continuam autorizando no banco; menu e código de navegador não concedem acesso.
Nenhuma chave privilegiada, checkout ou transferência foi introduzida. A gravação de
pagamentos continua sendo apenas o lançamento manual existente, validado no servidor.

## Limites técnicos explícitos

- O filtro de eventos próprios pode usar o índice existente `(producer_id, starts_at)`.
- A função antiga `stage_accepted_shows()` é SECURITY DEFINER. Filtros e LIMIT aplicados pelo PostgREST limitam a resposta da API; **não comprovam** que o corpo da função deixa de processar todo o histórico. O próximo ajuste SQL deve receber período/cursor dentro da função, com índices e plano medidos, em uma release autorizada.
- O calendário não transfere títulos ou descrições para marcar datas; passa a indicar quando as marcações são parciais. As listas por dia continuam pagináveis nesse caso.
- O limite financeiro pertence às RPCs JSON antigas. A nova camada não altera esse contrato, não finge paginação sobre JSON e não trata uma página como total completo. Agregações por período no servidor permanecem pendentes.
- Valores, planos e pagamentos continuam sob as regras anteriores. Não houve medição de carga/p95 ou certificação para 100 mil usuários.

## Validação

- 164 testes Node locais aprovados: cursor com horários iguais, microssegundos, limites de período, marcações, links diretos, titularidade, falhas parciais, cobertura financeira, Pro, valor decimal e cancelamento.
- TypeScript e build de produção locais verificados.
- Testes de navegador ampliados em `tests/browser/agenda-finance.mjs`: 22 shows no mês mais outro em dezembro, paginação, troca de mês, link fora da primeira página, cadastro e Financeiro em 360/768/1280 px.
- O navegador do CI usa somente API fictícia `example.supabase.co`, sem contas reais nem bancos remotos.
- Conferir o workflow do commit desta parte para o resultado real dos testes de navegador.

## Próxima parte

1. Separar cálculos e exportação financeira em funções puras com testes numéricos; preparar contrato de agregação por período no servidor.
2. Unificar contexto de identidade do shell e telas, com invalidação ao trocar/sair da conta e sem cache global entre usuários.
3. Extrair fluxos de contratação para `booking` e consolidar a experiência de convites/conversas.
4. Tratar otimizações de banco como release separada; nenhum commit autoriza aplicação automática em produção.
