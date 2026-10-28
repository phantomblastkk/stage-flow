# StageFlow — Parte 10: controlador de cachê e confirmação

Base verificada: `21f020d4eba77ca1326b50a53acf0dadfde2992a`. Branch exclusiva main.
Sem develop, homologação, banco remoto, migration ou deploy.

## Problema → impacto → solução

| Problema | Impacto | Código aplicado |
|---|---|---|
| Rede, estados e JSX de negociação misturados | Recuperação difícil após erros e estados inconsistentes | `hooks/use-fee-negotiation.ts` concentra leitura/mutação e expõe fases idle/loading/ready/mutating/error |
| Operação sem try/finally e bloqueio imediato | Erro inesperado podia deixar busy ativo; cliques concorrentes podiam repetir envio | Lock síncrono por instância e liberação em finally; rascunhos ficam no formulário após falha |
| Respostas antigas e troca de convite | Risco de apresentar dados anteriores | Cancelamento de leitura, verificação de montagem e painel com chave do convite; callbacks antigos não atualizam a nova instância |
| Snapshot JSON tratado como acordo válido sem conferir formato | Valores ausentes poderiam aparecer como NaN ou acordo inexistente | `model/fee-snapshot.ts` valida campos monetários, status, flags e histórico antes de renderizar |
| Contrato TypeScript divergia do SQL sem oferta | Primeira negociação poderia ser bloqueada pela validação | `negotiation-types.ts` aceita last_by_me null somente quando não há oferta, conforme SQL local |
| Falha de leitura mantinha valor fechado visível | Acordo anterior poderia parecer atualizado | Erro remove dados exibidos e oferece atualização; recuperação limpa feedback antigo |
| Alerta de cachê pendente persistia após negociar | Próxima ação ficava confusa | Atualização da negociação limpa o alerta anterior no inbox de convites |

O componente `fee-negotiation.tsx` mantém apresentação, expansão e formulários;
o hook trata a operação. Inputs ficam desabilitados durante a mutação para não
apagar texto digitado enquanto uma requisição ainda está sendo concluída.
Acordar cachê continua separado da confirmação da participação. A autorização
continua exclusivamente nas RPCs existentes; nenhum SQL foi alterado.

## Verificação

- 213 testes Node, incluindo três novos testes de snapshot: acordo pendente/válido,
  resposta inválida/forbidden e convite sem oferta conforme contrato SQL.
- TypeScript e build de produção com URL/chave fictícias.
- Navegador ampliado em 360/768/1280 px: aceitar convite com cachê pendente abre
  negociação; contraproposta usa valor exato; acordo não confirma presença;
  confirmação é uma ação explícita posterior.
- Em 360 px, falha de leitura oculta o acordo anterior e retry recupera a negociação.
- Os sete cenários anteriores de Agenda/Financeiro/contratação/conta foram mantidos.
- CI aprovado no commit `eb266736b88c5c639ccbb3e6f9564d2761063833`: contratos, TypeScript, build e dez cenários de navegador.
- [Workflow aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40624917465).
- [Screenshots e log](https://github.com/phantomblastkk/stage-flow/actions/runs/40624917465/artifacts/12788907254), retenção de sete dias.
- [Diff aplicado](https://github.com/phantomblastkk/stage-flow/compare/21f020d4eba77ca1326b50a53acf0dadfde2992a...eb266736b88c5c639ccbb3e6f9564d2761063833).

Fixtures e respostas sintéticas; sem contas reais, pagamentos, WhatsApp ou testes
de carga. Cancelar leitura não desfaz mutação já recebida pelo servidor. O hook
não persiste dados em cache global ou armazenamento do navegador.

## Continuidade

Próxima fatia: controlador do editor de propostas formais e recuperação dos seus
erros, seguido de paginação e estratégia de atualização medida para a inbox.
A extração deste commit cobre a negociação de cachê, sem declarar o editor formal
inteiro migrado.
