# StageFlow — Parte 40: busca, filtros e ordenação do Marketplace

Data: 29/10/2026. Base: a84c5b7a91273eeac9dcd1deea10e35b507a3a7b.

## Problema, impacto e solução aplicada

O catálogo usava controles próprios na busca, nos filtros e na ordenação, com
estilos de base repetidos. No celular o texto do botão de pesquisa desaparecia;
abrir o painel não movia o foco até os filtros nem o devolvia ao fechar.

- Input/Select compartilhados para busca, cidade, instrumento, gênero, cachê,
  data e ordenação. Rótulos visíveis, hint do cachê associado ao campo e fonte de 16 px.
- Button nas ações de pesquisar, abrir/fechar/aplicar/limpar filtros, restaurar
  catálogo vazio e paginar. Estados disabled da paginação preservados.
- Painel nomeado; aria-expanded e aria-controls no botão Filtros. Abertura leva o
  foco à cidade; fechamento/aplicação/limpeza devolvem ao botão se ele estiver visível.
- Campos continuam preenchidos ao apenas fechar o painel. Checkboxes com rótulos
  de ao menos 44 px e foco visível. Pesquisar mantém texto no celular.
- Retirados estilos substituídos pelos componentes compartilhados. Estilos de
  market-apply usados em convites/avaliações permanecem até migração desses blocos.

## Invariantes e limites

Handlers de consulta, apply/clear, ordenação e paginação mantidos. Mesmos parâmetros,
limite de 12, offset, disponibilidade, favoritos e filtros de valor/data. Alterar
campos não aplica a busca; ordenar aplica imediatamente e reinicia a primeira página.
Destaques seguem independentes da busca. Sem nova dependência ou listener global.
Nenhuma mudança em Supabase, Auth, RLS, permissões ou dados de produção. Sem deploy.

## Validação

266 testes Node e TypeScript aprovados localmente. Build e CI em validação.
Browser sintético em 360/768/1280 px cobre foco, fechamento/reabertura com valores
preservados, toque, rótulos, ausência de overflow, payload exato de filtros, offset,
reinício ao ordenar, cachê inválido, falha/reenvio e recuperação de resultado vazio.
As verificações existentes de 320/375/430 px também continuam na jornada.

## Continuidade

A migração geral de CSS segue parcial. Próxima parte: feedback e recuperação de
falhas do Marketplace; ainda há mensagens técnicas e avisos próprios na lógica atual
fora do escopo de apresentação desta etapa. Revisar sem alterar regras de busca.
