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

266 testes Node, TypeScript e build aprovados localmente e no CI. Código validado:
081e60b2e8648ef7428baa1ff4178bb7267d8e47.
Browser sintético em 360/768/1280 px cobre foco, fechamento/reabertura com valores
preservados, toque, rótulos, ausência de overflow, payload exato de filtros, offset,
reinício ao ordenar, cachê inválido, falha/reenvio e recuperação de resultado vazio.
As verificações existentes de 320/375/430 px também continuam na jornada.

## Evidências finais

- [Diff da etapa](https://github.com/phantomblastkk/stage-flow/compare/a84c5b7a91273eeac9dcd1deea10e35b507a3a7b...081e60b2e8648ef7428baa1ff4178bb7267d8e47).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40890999611).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40890999615): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas sintéticas.
- PASS marketplace controls em 360/768/1280 px. Payload exato de filtros e limites confirmado; editar não consulta e os destaques são carregados uma única vez nessa jornada.
- Artefato operational-ux-evidence ID 12905565813: 129 PNGs e seis JPGs. Seis capturas novas de filtros/ordenação nos três tamanhos.
- Revisão visual: filtros em 360 px e ordenação em 360/1280 px. Capturas de componente podem incluir navegação global fixa; toque, foco e overflow também possuem verificações de navegador.
- marketplace-catalog.css: 782 → 730 linhas. Limpeza localizada de estilos substituídos pelos componentes compartilhados; sem medição de bundle ou latência.
- Comparação textual da consulta e dos handlers apply/clear: idênticos à base. Revisão React: efeito de foco isolado, limpeza segura no fechamento, campos nativos associados a rótulos e sem listener/dependência adicional.
- Build aprovado com avisos já existentes de ferramentas/CSS; não há alegação de build sem avisos.

## Continuidade

A migração geral de CSS segue parcial. Próxima parte: feedback e recuperação de
falhas do Marketplace; ainda há mensagens técnicas e avisos próprios na lógica atual
fora do escopo de apresentação desta etapa. Revisar sem alterar regras de busca.
