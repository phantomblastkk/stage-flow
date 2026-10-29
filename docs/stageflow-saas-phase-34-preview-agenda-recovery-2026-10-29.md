# StageFlow — Parte 34: agenda e cartazes independentes na prévia avançada

Base: fe5702a1c039a853b5a6d73164a886e68521025a, diretamente na main.

## Problema, impacto e correção

| Problema | Impacto | Implementação |
|---|---|---|
| Agenda carregada dentro da leitura de identidade | Shows/flyers atrasam abertura de todo o editor | Hook próprio do domínio de eventos, após identificação autenticada |
| Falha de agenda sem recuperação e sem distinguir lista vazia | Usuário pode interpretar indisponibilidade como ausência de shows | Estado de disponibilidade, aviso e Atualizar agenda; mantém últimos shows carregados |
| Consulta de flyers limitada a 40 registros diferentes da lista de shows | Cartazes podem faltar quando há muitos eventos | Metadados consultados somente para os IDs dos até 40 shows carregados |
| Datas iguais sem critério de desempate | Limite pode produzir subconjunto instável | Ordenação por starts_at e id, preservando filtros de proprietário/público/publicado/futuro |
| Falha de metadados não explicada | Show aparece sem cartaz e sem orientação | Erro e atualização de cartazes independentes da agenda |
| Resposta antiga de flyers pode sobrescrever nova agenda | Cartaz desatualizado associado à prévia | Versões de leitura separadas; agenda nova invalida metadados anteriores |
| Falha de assinatura ou de imagem fica no placeholder | Aparência de carregamento interminável | Tentar novamente por cartaz, mantendo o show |
| Rejeição no download pode deixar exportação bloqueada | Botões de Feed/Story ficam indisponíveis | Trava síncrona, catch/finally abrangendo download/renderização e liberação de URL |

A prévia mantém calendário e filtros ao tentar novamente; design, galeria, identidade
e publicação não são recarregados. Sem consultas de metadados quando a agenda está
vazia. Metadados rejeitados preservam os shows e os cartazes já conhecidos. Uma lista
vazia só é apresentada após consulta de agenda bem-sucedida.

## Arquivos e diff

- src/domains/events/hooks/use-artist-preview-agenda.ts: leitura limitada de shows,
  metadados pelos mesmos IDs, descarte de respostas e tentativas independentes.
- src/domains/events/types.ts: tipo compartilhado ArtistPreviewShow.
- components/singer-pro-editor.tsx: retirada da consulta de agenda da identidade,
  integração do hook, estados de recuperação e aviso de limite com link à agenda completa.
- app/meu-perfil-artistico/site-profissional/pro-show-cards.tsx: recuperação de
  cartaz, rejeição de imagem, ícones decorativos ocultos de leitores de tela,
  exportação com trava e finalização garantida.
- premium-preview.css e pro-show-cards.css: ações e recuperação com alvos de toque.
- tests/browser/operational-home.mjs: agenda/flyers/Storage simulados; exports reais
  gerados no navegador a partir de imagem sintética.

`git diff fe5702a -- src/domains/events components/singer-pro-editor.tsx app/meu-perfil-artistico/site-profissional/pro-show-cards.tsx app/meu-perfil-artistico/site-profissional/premium-preview.css app/meu-perfil-artistico/site-profissional/pro-show-cards.css tests/browser/operational-home.mjs`

## Validação

266 testes Node, TypeScript e build aprovados localmente e nos CIs finais.

Cenários novos em 360/768/1280 px: agenda com erro/ausente sem falsa lista vazia;
recuperação sem nova leitura de identidade, design, galeria ou publicação; cartazes
por IDs limitados; seleção de mês/dia preservada; falha de assinatura e de imagem;
falha de metadados mantendo cartaz anterior; download rejeitado com botões liberados;
Feed/Story baixados e decodificados com 1080×1350 e 1080×1920; resposta antiga de
metadados ignorada após agenda nova; lista vazia confirmada sem consulta de flyers;
40 shows acessíveis com expansão local, sem nova consulta ao expandir.

## Evidências finais

- Implementação inicial: e5840ba500241ea726d0144d800360652f2b8d7e.
- Ajuste de acessibilidade dos cards: 008dc3866e0dd020e5911071e00e558681932c57.
- Versão final testada: 92f74abace73f9b4a4c4775726da6fc329e11f99.
- [Diff completo](https://github.com/phantomblastkk/stage-flow/compare/fe5702a1c039a853b5a6d73164a886e68521025a...92f74abace73f9b4a4c4775726da6fc329e11f99).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40868806539).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40868806543): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas de navegador com respostas simuladas.
- Artefato operational-ux-evidence ID 12895097013: 96 PNGs e seis JPGs. Nove capturas novas de agenda indisponível, falha de cartaz e agenda recuperada nos três tamanhos.
- Os seis exports foram decodificados no teste e inspecionados novamente no artefato: Feed 1080×1350 e Story 1080×1920 para cada largura.
- Logs registram PASS preview agenda em 360/768/1280 px, incluindo descarte de metadados antigos, seleção preservada, isolamento de consultas e expansão local dos 40 shows.
- Revisão visual da agenda com erro e recuperada em 360 px e da agenda recuperada em 1280 px. Capturas de componentes incluem a navegação global fixa.
- Revisão React: callbacks por ID primitivo de proprietário, leituras independentes, versões de resposta e descarte na desmontagem; sem novo listener global, polling ou repetição automática de downloads.
- A leitura de identidade deixa de aguardar agenda e cartazes. Não há medição de ganho de latência ou bundle nesta etapa.

## Limites e próxima etapa

Nenhuma migration, RPC, RLS, bucket ou dado de produção alterado. A agenda continua
sendo uma prévia de até 40 shows futuros; a programação completa permanece na Agenda.
O hook usa somente o ID obtido da sessão validada, não um parâmetro de URL.

Não altera o editor de recorte dos flyers, gravação de eventos nem a página pública
inteira do cantor. O componente compartilhado de cards também passa a oferecer a
tentativa de cartaz no perfil público, mantendo as políticas existentes de Storage.
Não há polling, publicação automática ou limpeza de arquivos privados.

A migração geral de CSS continua parcial. Próxima parte: controles de temas, cores e
organização das seções do editor avançado, com componentes compartilhados e revisão
mobile; manter as proteções de recuperação e publicação já testadas.

Sem deploy.
