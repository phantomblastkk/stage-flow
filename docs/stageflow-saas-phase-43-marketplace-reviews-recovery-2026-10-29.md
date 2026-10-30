# StageFlow — Parte 43: avaliações verificadas do Marketplace

Data: 29/10/2026. Base: 10f21909eab92fa587f1147e296277ae5ed5829c.

## Problema, impacto e solução aplicada

As leituras de avaliações e apresentações elegíveis convertiam falhas em listas
vazias. O envio usava apenas estado React, e uma resposta perdida podia permitir
nova publicação sem antes conferir o que foi registrado.

- Leituras extraídas para src/domains/marketplace/hooks/use-marketplace-reviews.ts.
  Estados independentes de carregamento, erro, dados válidos e vazio; schema mínimo
  dos registros validado antes da renderização. Nome de organizador null tem fallback.
- Dados públicos vinculados ao músico; elegibilidade vinculada também ao ID da conta
  autenticada, sem usar esse ID como autorização. RPC e políticas seguem responsáveis
  por validar acesso. Mudança de músico/conta invalida resultados antigos.
- Retentativa/atualização de cada leitura sem apagar nota, evento ou comentário.
- Select/Textarea/Button/InlineNotice/LoadingState compartilhados no formulário.
  Fonte de 16 px, foco visível e feedback junto da ação.
- Envio com lock síncrono, snapshot do payload, validação local, finally e proteção
  de montagem/versão. Somente apresentações não avaliadas da leitura válida permitem enviar.
- Transporte ou resposta desconhecida preservam campos, bloqueiam nova publicação
  e oferecem Verificar avaliação (somente leitura). Se já avaliada, bloqueia o par e
  preserva texto; se ainda disponível, libera uma nova ação explícita de publicação.
- saved confirma e limpa comentário. already_reviewed não limpa o texto. Falha no
  refresh após saved não transforma o sucesso confirmado em resposta incerta.
- Refresh após confirmação invalida leitura antiga em andamento; não há reenvio automático.

## Contrato e limites

Mesmos RPCs: stage_marketplace_reviews_for_musician, stage_marketplace_my_reviewable
e stage_marketplace_submit_review. Mantidos limite público de 30 no SQL existente,
show concluído, convite aceito, autorização no servidor, nota 1–5 e comentário até
450 caracteres. O SQL existente retorna already_reviewed também em unique_violation.
Nenhuma migration, alteração de política ou consulta de produção foi executada.

O browser simula as regras e respostas; não prova a instalação das migrations em
produção. O texto preservado ao encontrar avaliação existente não é considerado
prova de que a avaliação publicada contém exatamente aquele texto.

## Validação

266 testes Node, TypeScript e build aprovados no CI final
f583a6fb65afe0f86e5e8ad35e927897c438f0d0. Verificações locais também passaram.
Browser em 360/768/1280 px cobre leituras independentes, null/registros inválidos,
campos preservados, tentativa duplicada enquanto publica, erro de negócio, resposta
incerta com/sem commit, verificação sem escrita, already_reviewed, saved seguido de
refresh falho, formatação mobile e resposta antiga de outro músico. Fixtures sintéticas.

## Evidências finais

- [Diff da etapa](https://github.com/phantomblastkk/stage-flow/compare/10f21909eab92fa587f1147e296277ae5ed5829c...f583a6fb65afe0f86e5e8ad35e927897c438f0d0).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40979673149).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40979673152): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas sintéticas de navegador.
- PASS marketplace reviews em 360/768/1280 px. Seis chamadas simuladas cobrem rejeição, commit com resposta perdida, saved, already_reviewed, transporte sem commit e nova publicação explícita após leitura de verificação.
- Artefato operational-ux-evidence ID 12943478981: 150 PNGs e seis JPGs; nove capturas novas de falha das leituras, avaliação incerta e avaliação confirmada.
- Revisão visual: falhas de leitura em 360 px, modal incerto em 360 px e modal confirmado em 1280 px. Retorno em foco e botão de fechar visíveis. Capturas de envio usam a janela visível para evitar capturar conteúdo da seção fora da área recortada do modal.
- marketplace-catalog.css: 710 → 707 linhas. Estilos próprios de campos substituídos pelos controles compartilhados; sem medição de bundle ou latência.
- Revisão React: callbacks estáveis por músico/conta, versões de leitura, limpeza na troca/desmontagem, lock de publicação, atualização após confirmação e feedback isolado do convite. Sem listener global ou dependência nova.
- A instalação e os efeitos das migrations em produção não foram validados nesta parte. Todos os envios de teste são fixtures; nenhuma avaliação real foi publicada.

## Continuidade

A migração de CSS e arquitetura segue parcial. Próxima parte: extrair também o fluxo
de convite do componente do catálogo para o domínio Marketplace, preservando o contrato
e os cenários já verificados, reduzindo a concentração de lógica nessa tela.
Sem deploy; auto deploy permanece desabilitado.
