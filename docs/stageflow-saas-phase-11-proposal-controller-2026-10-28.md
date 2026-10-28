# StageFlow — Parte 11: controlador de propostas formais

Base verificada: `41555d6340cc17d4e9640cf4d22fe816b1b1143d`. Trabalho na main.
Sem develop, homologação, banco remoto, migrations ou deploy.

## Problema → impacto → correção

| Problema | Impacto | Código aplicado |
|---|---|---|
| Editor misturava rede, formulário e renderização | Difícil recuperar erros e reaproveitar regras | `hooks/use-hiring-proposals.ts` controla formulário, prefill, disponibilidade e operações; componente conserva a apresentação |
| Polling ignorava falhas e podia sobrepor consultas | Informação incompleta parecia ausência de propostas | Leitura abortável, erro separado de lista vazia, atualização explícita; polling somente na aba visível, sem consulta concorrente ou mutação em andamento |
| Respostas antigas sobreviviam à troca de conversa | Atualizações e callbacks sem contexto atual | Cleanup de requisições, verificação de montagem e chave por conversa |
| Prefill tardio podia substituir um rascunho | Perda de título/local digitados pelo usuário | Primeiro campo editado impede aplicação posterior do prefill; falha opcional não impede preenchimento manual |
| Consulta de agenda voltava após alterar horário | Indicador de disponibilidade referia-se à data anterior | Alterar horário cancela a consulta e volta ao estado idle; mutações também invalidam a consulta anterior |
| Mutações dependiam só do busy renderizado | Cliques concorrentes podiam iniciar mais de uma operação | Lock síncrono e liberação em finally; campos desabilitados durante escrita; rascunho preservado quando envio falha |
| JSON sem validação detalhada | Status, datas ou links inválidos poderiam aparecer como proposta | `model/proposal-snapshot.ts` verifica contrato antes da renderização; `proposal-types.ts` centraliza os tipos |

## Contratos preservados

Envio, decisão, retirada, conflitos e autorizações continuam nas RPCs existentes.
Cachê desconhecido permanece null; não vira zero. Recusar/retirar mantém histórico.
O aceite continua sendo uma decisão atômica no banco; a checagem prévia da agenda
não substitui a validação no momento de aceitar/enviar. Links de show aceito
continuam passando pelos controles da agenda.

Cancelamento protege leituras e apresentação. Não desfaz mutações já recebidas
pelo servidor. Não há cache global, persistência de rascunhos no navegador,
pagamentos, WhatsApp ou liberação de marketplace nesta etapa.

## Verificação

- 216 testes Node, incluindo três novos contratos de snapshot: vazio versus erro,
  cachê desconhecido/acordo vinculado e rejeição de valores/datas/status/links inválidos.
- TypeScript e build Next.js com URL/chave fictícias.
- Cenários existentes em 360/768/1280 px ampliados para resposta de proposta
  atrasada ao trocar conversa e leitura com falha/retry antes do aceite.
- Novo cenário de editor contratante em 360 px: prefill atrasado não substitui o
  título; alterar horário invalida consulta; conflito preserva o rascunho; retry
  envia cachê desconhecido como null; retirada mantém o registro no histórico.
- Os dez cenários de navegador anteriores foram preservados.
- CI final: registrar o resultado aprovado antes da entrega.

Somente fixtures sintéticas. Sem contas reais, banco remoto ou benchmark de carga.

## Próxima fatia

Paginação da inbox e dos históricos, com contrato de completude e atualização
medida; preparar qualquer mudança SQL separadamente, sem aplicação automática.
