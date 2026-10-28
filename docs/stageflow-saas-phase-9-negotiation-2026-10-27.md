# StageFlow — Parte 9: serviços de propostas e cachê

Base: `969e1016944823b3f62d640c75ad27ebc07c49a7`. Somente main.
Sem develop, homologação, banco remoto, migration ou deploy.

## Problema, impacto e solução aplicada

| Problema | Impacto | Código |
|---|---|---|
| RPCs de proposta/cachê embutidas nos componentes | Contratos dispersos, difíceis de reaproveitar | `src/domains/booking/services/negotiation-service.ts`: nove operações tipadas para leitura, prefill, disponibilidade, envio, decisão, retirada e cachê |
| Duas validações monetárias diferentes | Negociação aceitava notação científica/hexadecimal por conversão Number | `model/fee-input.ts`: entrada decimal BR/ISO, centavos inteiros, limite positivo de R$ 999.999,99 |
| Ausência de cachê e valor inválido misturados | Risco de trocar valor desconhecido por zero | Proposta formal mantém branco como null; negociação exige valor positivo; zero e formatos inválidos retornam undefined |
| Leituras concorrentes de negociação | Resposta anterior podia atualizar o painel atual | `fee-negotiation.tsx` cancela consulta anterior e ignora resposta abortada; limpa dados/rascunhos na mudança de convite |
| Mensagem de leitura expunha instrução de migration | Usuário recebia detalhe de implementação | Erro recuperável em português, sem instruir execução de SQL |

## Compatibilidade e limites

Os componentes `hiring-proposals.tsx` e `fee-negotiation.tsx` consomem os novos
serviços e o mesmo modelo de entrada. As RPCs, seus parâmetros e seus resultados
foram preservados, incluindo schedule_conflict, waiting_other e aceite de cachê
separado da confirmação da participação. Nenhuma tabela é consultada diretamente.
Autorização, bloqueios de disponibilidade e decisões atômicas continuam no banco.
A extração não concede acesso nem libera recursos restritos do marketplace.

Os serviços encapsulam os contratos existentes; não substituem autorização RLS/RPC.
O editor, estados e mensagens específicas ainda residem nos componentes. Não há
novo cache, pagamento ou envio de WhatsApp. O cancelamento protege leituras; não
promete desfazer mutações já recebidas pelo servidor.

## Verificação

- 210 testes Node, incluindo seis novos casos executáveis de valores e contratos PostgREST.
- Casos: centavos, limite, formato exponencial/hex, zero, branco desconhecido,
  precisão excessiva, parâmetros de proposta/decisão, status de conflito e leitura abortada.
- TypeScript e build de produção com URL/chave fictícias.
- CI mantém os sete cenários de navegador da Parte 8, incluindo aceite de proposta
  até a participação na agenda, isolamento de conversas e conta e compositor mobile.
- Resultado final do CI: pendente de registro antes da entrega.

Somente fixtures; sem contas reais, banco remoto ou teste de carga.

## Próxima etapa

Extrair o controlador de negociação para hooks com estados explícitos de erro e
operação; ampliar o cenário de navegador de contraproposta → cachê acordado →
confirmação. Planejar paginação da inbox sem modificar banco remoto automaticamente.
