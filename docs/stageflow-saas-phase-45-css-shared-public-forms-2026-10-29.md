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
- `docs/stageflow-css-inventory-2026-10-29.md`: inventário reproduzível de 62 arquivos.
  Blocos iguais são candidatos, não autorização para fundir seletores de contextos diferentes.

Nenhuma RPC, validação de negócio, política de publicação ou schema foi modificada.
Os testes novos simulam envio; não houve denúncia ou contratação real.

## Validação e limites

266 testes Node locais e TypeScript aprovados. Build e CI serão registrados após conclusão.
Jornadas novas em 360/768/1280 px verificam labels, foco, medidas, campos de 16 px,
contagem acessível, payload exato, rejeição preservando rascunho, confirmação e reset.
Capturas adicionadas para os dois formulários. As jornadas anteriores são mantidas.

A semântica modal existente da denúncia não foi reescrita nesta entrega. O isolamento
completo de foco e a recuperação de transporte de denúncia/contratação ficam explícitos
para a revisão de jornadas; não se afirma que a migração de CSS os resolveu.
Não foi feita medição de bundle ou performance. O número total de CSS continua 62:
folhas específicas de layout não precisam ser eliminadas para compartilhar controles.

## Continuidade

Próxima parte: controles e avisos da fila de moderação, com testes de acesso e comportamento,
e revisão dos padrões repetidos identificados no inventário. Depois, cascata global/legacy.
Estimativa restante após esta parte: 6–10 entregas para o escopo original, sujeita aos achados.
Main direta; auto deploy permanece desabilitado e sem deploy manual.
