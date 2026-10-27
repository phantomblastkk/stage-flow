# Contrato proposto — resumo financeiro por período v1

Preparado em `src/domains/billing/contracts/finance-summary.ts`, com construtor de
requisição e validador de resposta. **Não existe uma nova RPC instalada ou conectada
à tela nesta entrega.** A tela continua usando os serviços e RPCs atuais.

## Requisição

```json
{
  "version": 1,
  "currency": "BRL",
  "timeZone": "America/Sao_Paulo",
  "mode": "all",
  "period": {
    "from": "2026-11-01T03:00:00.000Z",
    "to": "2026-12-01T03:00:00.000Z"
  }
}
```

- `from` inclusivo, `to` exclusivo, timestamps UTC normalizados; intervalo positivo de até 366 dias.
- `mode`: `all`, `organizer` ou `musician`.
- A requisição **não contém usuário, organizador ou destinatário editável**. O servidor deve derivar o proprietário de `auth.uid()`.
- A seleção do mês considera São Paulo, inclusive na virada de mês em UTC. O consumidor envia os limites UTC correspondentes ao período local.

## Resposta

A resposta repete versão, moeda, fuso, modo e período. Acrescenta:

| Campo | Contrato |
|---|---|
| `subject` | UUID de Auth do proprietário, preenchido pelo servidor; o consumidor compara com a identidade autenticada esperada |
| `totals.gross` | Receita conhecida, em centavos |
| `totals.received` | Recebido manualmente registrado, em centavos |
| `totals.extras` / `extrasPaid` | Despesas dos shows próprios: previstas/pagas, em centavos |
| `totals.teamAgreed` / `teamPaid` | Cachês de equipe acordados/pagos, em centavos |
| `totals.personalCost` | Despesas pessoais das participações, em centavos |
| `totals.cashFlow` | `received − extrasPaid − teamPaid − personalCost` |
| `totals.projected` | `gross − extras − teamAgreed − personalCost` |
| `totals.pendingReceivables` | Soma dos saldos individuais a receber, limitados a zero por registro |
| `totals.pendingPayables` | Soma dos saldos individuais a pagar, limitados a zero por registro |
| `counts.shows` | Shows incluídos, sem cancelados |
| `counts.missingRevenue` | Shows com receita/cachê não informado, distinto de valor zero |
| `counts.unpricedFees` | Músicos da equipe ainda sem cachê definido |
| `coverage.historyComplete` | Se todo o conjunto solicitado foi agregado; não confundir com ausência de valores informados |

Os valores devem ser inteiros seguros em centavos. Somente `cashFlow` e `projected`
podem ser negativos. O validador rejeita identidade/período divergentes, campos
monetários fracionários, contagens inválidas e inconsistência nas duas fórmulas.
Receita desconhecida contribui zero apenas para o subtotal conhecido, com contagem
explícita de valores ausentes; não vira uma receita conhecida de zero.

## Implementação posterior no servidor

1. Autorizar pela identidade Auth e permissões do banco; consultar entitlement Pro no servidor quando o módulo exigir, sem confiar em estado de UI, username, e-mail ou metadata editável.
2. Filtrar período e titularidade **antes** de agregar, usando índices adequados, sem o LIMIT histórico de 400/300 dentro das fontes.
3. Somar valores `numeric` e converter para centavos sem ponto flutuante. Comparar saldo pendente por registro antes da soma.
4. Excluir cancelados e impedir duplicação de shows próprios como participações.
5. Gerar agregados mensais e dados exportáveis sob os mesmos filtros, com paginação de detalhes separada dos totais completos.
6. Validar RLS, EXECUTE e search_path, planos com volumes representativos e comparação com os casos numéricos do modelo puro.
7. Preparar SQL revisável e recuperação. Aplicação ao banco oficial e publicação permanecem releases explicitamente autorizadas, separadas do commit na main.

Nenhuma conexão, dado ou conta de homologação foi usada para este contrato.
