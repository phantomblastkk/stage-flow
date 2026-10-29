# StageFlow — Parte 41: feedback e recuperação do Marketplace

Data: 29/10/2026. Base: ef80b769ab0a22f9b08eacd33c00be66fbac9062.

## Problema, impacto e solução aplicada

Falhas de consulta exibiam mensagens técnicas e podiam aparecer junto do estado de
catálogo vazio. Exceções podiam deixar o carregamento pendente. Busca e destaques
não possuíam uma retentativa própria, preservando o contexto de cada leitura.

- Erro da busca separado dos erros de ações; erro não é anunciado como zero resultados.
- Dados ausentes/incompletos, items sem array ou total inválido não viram vazio válido.
- Busca/destaques com try/catch/finally e proteção contra resposta antiga/desmontagem.
- Retentativas explícitas e independentes, bloqueadas durante leitura. Tentar a busca
  mantém filtros aplicados, ordenação, offset e texto ainda não enviado nos campos.
- Foco vai ao resumo da busca ou título dos destaques após a retentativa.
- LoadingState/InlineNotice/Button compartilhados; estado vazio somente após resposta
  válida. Removidos estilos próprios de avisos e skeleton antigo dos destaques.
- Erros de transporte em busca, destaques, convite e avaliação usam texto humano,
  sem mensagem SQL/RPC do backend. Motivos de negócio conhecidos permanecem.

## Invariantes e limites

Mesmos RPCs, payloads, limite de 12, paginação e limite de seis destaques. Retry não
escreve dados nem recarrega o outro bloco. Refresh já existente após ações continua
funcionando; nenhuma retentativa automática de mutação. Estados de campos/aplicados
permanecem separados. Sem mudança de banco, Auth, RLS, Storage ou produção.

Validação da resposta nesta parte cobre envelope, lista e total; não substitui
validação das políticas e de cada registro no servidor. Modais e o fluxo completo
de envio de convites/avaliações ainda precisam de revisão própria de recuperação.

## Validação

266 testes Node, TypeScript e build aprovados localmente e no CI. Código validado:
a4b5598c0babb48cc5407f09f64284ac52d03d21.
Browser sintético em 360/768/1280 px cobre transporte, null/lista/total inválidos,
falha na segunda página, preservação do payload e de edição não aplicada, retentativa
pendente, independência, foco, resposta antiga, vazio válido e ausência de detalhes
internos na tela. Cobertura anterior de filtros, perfil e galeria preservada.

## Evidências finais

- [Diff da etapa](https://github.com/phantomblastkk/stage-flow/compare/ef80b769ab0a22f9b08eacd33c00be66fbac9062...a4b5598c0babb48cc5407f09f64284ac52d03d21).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40896497347).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40896497396): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas sintéticas de navegador.
- PASS marketplace recovery em 360/768/1280 px. Retry da busca preserva p_offset=12 e payload aplicado, mesmo com texto novo ainda não enviado no campo.
- Artefato operational-ux-evidence ID 12908051087: 135 PNGs e seis JPGs, incluindo seis capturas novas de falha da busca e destaques recuperados.
- Revisão visual: falha da busca em 360 px e destaques recuperados em 1280 px. Botão de retentativa com foco visível; sem título de vazio junto do erro.
- marketplace-catalog.css: 730 → 714 linhas. Removidos avisos próprios e skeleton sem uso; não há medição de ganho de bundle ou latência.
- Revisão React: proteção active em todos os caminhos assíncronos, finally condicionado à leitura ativa, locks síncronos de retentativa e efeitos de foco após conclusão. Sem novo listener ou dependência.
- Build aprovado com avisos já existentes de ferramentas/CSS; não há alegação de build sem avisos.

## Continuidade

A migração geral de CSS continua parcial. Próxima parte: revisar o modal de convite
no Marketplace, com foco, confirmação de envio, bloqueio contra duplicação e recuperação
sem perder show e mensagem escolhidos. Sem deploy; auto deploy permanece desabilitado.
