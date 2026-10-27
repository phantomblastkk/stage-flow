# StageFlow — Parte 6: cálculos e exportação financeira

Base: `cc2b16bee868762eefb4a5b51f058cc75ca0d28c`. Alterações somente na `main`.
Sem develop, homologação, acesso a banco remoto, migration ou deploy.

## Problema → impacto → código aplicado

| Problema | Impacto | Correção |
|---|---|---|
| Fórmulas repetidas no resumo, mês, cartões e CSV | Divergências entre apresentação e arquivo exportado | Modelo puro `model/finance-report.ts`, consumido por todas as apresentações |
| Valores somados como decimais binários | Possíveis diferenças de centavos | Conversão de cada valor para centavos inteiros antes das operações, checagem de precisão/overflow e formatação apenas na saída |
| Zero, ausência e erro misturados | Receita desconhecida poderia parecer conhecida | `null` permanece desconhecido, zero permanece zero; dado inválido gera erro recuperável e bloqueia exportação |
| CSV com ponto decimal e negativos tratados como texto perigoso | Importação inadequada em planilhas brasileiras | Decimal com vírgula, separador ponto e vírgula, UTF-8/BOM; negativos calculados permanecem numéricos |
| Texto livre em células CSV | Fórmulas e quebras de célula indevidas | Texto com prefixo de fórmula é protegido; aspas, separadores e quebras de linha são escapados; células monetárias são geradas a partir de inteiros validados |
| Exportação e seleção de período tinham lógica própria | Arquivo poderia divergir do filtro ou das contas dos cartões | CSV recebe o mesmo relatório derivado, já filtrado e sem shows cancelados |
| Cada cálculo era executado em meio ao componente | Dificuldade de testar resultados e reaproveitar no servidor | Funções sem React, rede ou mutação dos snapshots; relatórios recalculados só quando dados/filtros mudam |

## Arquivos

- `src/domains/billing/model/money.ts`: centavos, valores desconhecidos, entrada/saída decimal e meses de São Paulo.
- `src/domains/billing/model/finance-report.ts`: filtros, totais, categorias, agrupamento mensal e contas por show.
- `src/domains/billing/model/finance-csv.ts`: exportação do relatório filtrado.
- `src/domains/billing/contracts/finance-summary.ts`: contrato futuro versionado, sem instalar/chamar nova RPC.
- `app/financeiro/page.tsx`: renderização e ações; fórmulas financeiras extraídas e erros de dados recuperáveis.
- `tests/finance-report.test.mjs`: casos numéricos, filtros, CSV, imutabilidade e validação de contrato.
- `tests/browser/agenda-finance.mjs`: download real de CSV e recuperação de dados inválidos em navegador.
- `docs/contrato-resumo-financeiro-v1.md`: regras para a futura implementação de agregação no servidor.

## Invariantes preservadas

- Valores lançados manualmente não equivalem a liquidação bancária; nenhum pagamento é enviado.
- Totais previstos são distintos do caixa registrado. Despesas pessoais continuam seguindo o contrato anterior, sem inventar estado de pagamento adicional.
- Valores ausentes sinalizam resultado parcial; custos conhecidos continuam reduzindo a projeção parcial do mês.
- Filtros por papel, ano e mês usam o fuso de São Paulo e excluem cancelados.
- Relatórios avançados e exportação mantêm os controles Pro existentes.
- Os limites históricos conhecidos das RPCs antigas continuam sinalizados e pausando a exportação quando não se comprova cobertura completa.

## Validação

- 178 testes Node aprovados localmente, incluindo 14 casos novos de cálculos/CSV/contrato.
- TypeScript e build Next.js verificados.
- Testes de navegador em 360/768/1280 px ampliados para baixar o CSV, verificar arquivo e valores e confirmar que um snapshot inválido não mostra zeros ou permite exportar.
- Conferir o workflow do commit desta parte para o resultado real de navegador.

Os testes usam somente fixtures e API sintética no CI. Não houve teste com dados
ou contas reais, nem medição de carga. O contrato de agregação no servidor foi
preparado, não publicado: os limites das RPCs existentes ainda precisam de uma
implementação SQL separada e autorizada.

## Próxima etapa

Unificar identidade e contexto de conta entre o shell e as telas, com limpeza de
estado ao sair/trocar de conta e redução das consultas duplicadas de perfil.
Manter autorização em RLS/RPCs, sem cache global de dados privados. Depois,
avançar na consolidação de convites/conversas no domínio `booking`.
