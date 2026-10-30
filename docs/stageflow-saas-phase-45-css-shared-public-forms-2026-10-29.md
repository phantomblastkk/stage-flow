# Parte 45 — Inventário CSS e formulários públicos compartilhados

Base da main conferida antes da edição: `013afbe4133d8ed86db2107a110d77ca635107e9`.

## Problema e impacto

O pedido público de contratação e o diálogo de denúncia ainda implementavam campos,
botões e avisos próprios. Fontes de 12–13 px nos campos prejudicavam uso mobile;
o botão de fechar denúncia e checkbox de consentimento tinham áreas pequenas.
A repetição dificultava manter foco, estados e cores consistentes com o Design System.

## Código aplicado

- `artist-booking-form.tsx`: Input, Textarea, Button e InlineNotice compartilhados;
  labels, IDs, limites, autocomplete, consentimento e honeypot preservados.
- `marketplace-report-dialog.tsx`: Select, Textarea, Button e InlineNotice;
  contador ligado ao campo por aria-describedby; ícone de loading compartilhado.
- CSS dos dois componentes: removidas bases locais de campos/botões/alertas;
  mantidos layout, temas e comportamento responsivo. Campos de 16 px, ações >=44 px,
  consentimento com checkbox de 20 px dentro de label com alvo de 44 px e foco visível.
  Diálogo usa limite 92dvh. Link Entrar na conta usa a classe compartilhada de botão.
- `scripts/audit-css.mjs`: inventário somente leitura de arquivos CSS rastreados,
  tamanho de fonte, linhas, blocos heurísticos, grupos legados e candidatos a repetição.
- `docs/stageflow-css-inventory-2026-10-29.md`: inventário reproduzível; 62 arquivos na base desta entrega e 64 após integrar
  as folhas de cadastro e termos do trabalho paralelo.
  Blocos iguais são candidatos, não autorização para fundir seletores de contextos diferentes.

Nenhuma RPC, validação de negócio, política de publicação ou schema foi modificada.
Os testes novos simulam envio; não houve denúncia ou contratação real.

## Validação e limites

266 testes Node locais, TypeScript e build aprovados. CI operacional aprovado no
commit desta entrega, incluindo PostgreSQL temporário e navegador.
Jornadas novas em 360/768/1280 px verificam labels, foco, medidas, campos de 16 px,
contagem acessível, payload exato, rejeição preservando rascunho, confirmação e reset.
Capturas adicionadas para os dois formulários. As jornadas anteriores são mantidas.

A semântica modal existente da denúncia não foi reescrita nesta entrega. O isolamento
completo de foco e a recuperação de transporte de denúncia/contratação ficam explícitos
para a revisão de jornadas; não se afirma que a migração de CSS os resolveu.
Não foi feita medição de bundle ou performance. Esta entrega não adiciona folhas CSS de produto;
folhas específicas de layout não precisam ser eliminadas para compartilhar controles.

## Continuidade

Próxima parte: controles e avisos da fila de moderação, com testes de acesso e comportamento,
e revisão dos padrões repetidos identificados no inventário. Depois, cascata global/legacy.
Estimativa restante após esta parte: 6–10 entregas para o escopo original, sujeita aos achados.
Main direta; auto deploy permanece desabilitado e sem deploy manual.

## Evidências e integração concorrente

- Commit da aplicação validado: `8462b322f3a9a81f3b5f3ad0632a1df4533ce897`.
- [Diff desta entrega](https://github.com/phantomblastkk/stage-flow/compare/013afbe4133d8ed86db2107a110d77ca635107e9...8462b322f3a9a81f3b5f3ad0632a1df4533ce897).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40982801497): 266 testes, TypeScript, build e jornadas antigas/novas.
- PASS public booking shared UI e marketplace report shared UI em 360/768/1280 px.
- Artefato operational-ux-evidence ID 12945223087; seis capturas novas. Revisados visualmente os dois formulários em 360 px: campos legíveis, feedback e ações sem overflow horizontal.
- Fonte CSS de contratação: 2763 → 2347 bytes; denúncia: 3535 → 2650 bytes. Redução combinada de 1301 bytes de fonte, sem alegação de ganho no bundle final.
- Auditoria inicial encontrou 58 grupos de blocos iguais entre arquivos diferentes. Inventário final é uma fotografia da árvore integrada em ab05d256fbb4e5742f8454570c4ae5e5163025e5, incluindo CSS novo de outro trabalho; não atribuir cadastro/termos a esta parte.
- Revisão React: labels e IDs mantidos, sem novos effects/listeners, estados e contratos de envio preservados. Honeypot segue fora do foco e aria-hidden.
- O workflow Integration and build 40982801434 foi cancelado pela concorrência de um push de cadastro, não por falha nesta entrega. A versão integrada posterior apresentou falhas nas asserções de cadastro, corrigidas pelo trabalho paralelo até 340fd7cf058ac10991150d5f46f48be74b7545cc. Reexecutados localmente todos os testes nessa base: 270/270 aprovados. Venue security 40983463033 aprovado; Integration 40983463117 e Operational 40983463030 ainda em andamento no fechamento. A aprovação operacional desta parte se refere exatamente ao commit 8462b32; não se atribui aprovação antecipada aos CIs posteriores.
- Mudanças concorrentes foram preservadas em fast-forward; este fechamento modifica apenas documentação da Parte 45.
