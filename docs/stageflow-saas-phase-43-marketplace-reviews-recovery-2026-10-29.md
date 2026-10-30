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

266 testes Node, TypeScript e build aprovados localmente. TypeScript também passou
após ajuste do escopo de conta; CI em validação do código completo.
Browser em 360/768/1280 px cobre leituras independentes, null/registros inválidos,
campos preservados, tentativa duplicada enquanto publica, erro de negócio, resposta
incerta com/sem commit, verificação sem escrita, already_reviewed, saved seguido de
refresh falho, formatação mobile e resposta antiga de outro músico. Fixtures sintéticas.

## Continuidade

A migração de CSS e arquitetura segue parcial. Próxima parte: extrair também o fluxo
de convite do componente do catálogo para o domínio Marketplace, preservando o contrato
e os cenários já verificados, reduzindo a concentração de lógica nessa tela.
Sem deploy; auto deploy permanece desabilitado.
