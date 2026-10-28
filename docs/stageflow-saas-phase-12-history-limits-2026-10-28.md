# StageFlow — Parte 12: histórico recente com limites explícitos

Base: `bc0ed0c62be0dd65bfbbc1f76c719c71d7bbace6`. Branch main.
Sem develop, homologação, banco remoto, migration ou deploy.

## Achado que define o escopo

O SQL local de `stage_hiring_list` limita a lista a 80 conversas e
`stage_hiring_messages` a 200 mensagens antes de gerar JSON. A segunda também
atualiza o marcador de leitura. Offset/range sobre esse JSON não permitiria buscar
registros anteriores. A implementação desta parte **não é paginação de servidor**.

## Problema → impacto → código aplicado

| Problema | Impacto | Solução |
|---|---|---|
| Todos os registros recebidos eram renderizados imediatamente | Mais nós DOM e navegação longa, principalmente no celular | Janela inicial de 20 conversas e 50 mensagens; expansão explícita dos registros já recebidos |
| Limites de 80/200 não eram apresentados | Histórico parcial podia parecer completo | Avisos ao atingir os limites; igualdade indica possibilidade de truncamento, não prova de que existem registros anteriores |
| Contagem de dados recebidos poderia parecer total da conta | Expectativa incorreta de completude | Rótulos usam “recebidas nesta consulta”; nenhum total global é inventado |
| Link fora da lista limitada era tratado como conversa inexistente na conta | Mensagem incorreta para conversa antiga legítima | Quando o limite é atingido, informar indisponibilidade na lista recente; não consultar mensagens de ID não encontrado |
| Janela poderia esconder a conversa selecionada | Perda de contexto após abrir link ou reordenar lista | Seleção fica fixada junto à janela se estiver entre os registros recebidos, sem duplicação |
| Expandir mensagens de uma conversa poderia afetar outra | Estado de navegação misturado | Janela de mensagens vinculada ao ID ativo; outra conversa começa com as 50 mais recentes |

`src/domains/booking/model/recent-history.ts` centraliza os limites do contrato
legado e a janela imutável. `app/conversas/page.tsx` apresenta avisos, contagens e
controles. Nenhuma consulta extra é disparada pelos botões de expansão; eles não
prometem buscar uma página do servidor.

## Próxima API preparada como contrato

[Contrato de paginação v1](contrato-paginacao-booking-v1.md) descreve RPCs novas,
keyset com timestamp/UUID, microssegundos, confirmação de leitura separada,
concorrência de inbox mutável, isolamento e critérios de teste. O contrato não
é código SQL aplicado nem uma API disponível. Nenhum dado além dos snapshots
legados passa a estar acessível nesta etapa.

## Verificação

- 220 testes Node, quatro novos: fronteiras 79/80 e 199/200, ordenação cronológica,
  expansão sem mutação/duplicação, vazio e limites inválidos.
- TypeScript e build de produção com URL/chave fictícias.
- Novo cenário de navegador em 360 px recebe 80 conversas/200 mensagens: abre a
  conversa antiga por link, expande todos os registros recebidos, mostra avisos,
  verifica contagem DOM, ausência de consulta extra na expansão e reinício da
  janela ao trocar conversa. ID fora da lista limitada não consulta mensagens.
- Os onze cenários anteriores foram mantidos.
- CI aprovado no commit `379cf3e0e5c7aa93f8e6ede9a5c9a5869eed7324`: contratos, TypeScript, build e doze cenários de navegador.
- [Workflow aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40628606945).
- [Screenshots e log](https://github.com/phantomblastkk/stage-flow/actions/runs/40628606945/artifacts/12790322551), retenção de sete dias.
- [Diff aplicado](https://github.com/phantomblastkk/stage-flow/compare/bc0ed0c62be0dd65bfbbc1f76c719c71d7bbace6...379cf3e0e5c7aa93f8e6ede9a5c9a5869eed7324).

Somente fixtures sintéticas; sem contas reais ou benchmark. O custo de rede e
banco das RPCs legadas não foi reduzido: a melhoria atual limita renderização e
explicita a cobertura. Paginação real exige implementar/testar a API proposta e
uma mudança de banco autorizada separadamente.
