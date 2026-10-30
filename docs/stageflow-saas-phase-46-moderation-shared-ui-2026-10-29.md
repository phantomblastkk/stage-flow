# Parte 46 — Fila privada de moderação com UI compartilhada

Main conferida inicialmente em ba186ea6611dffa55cd921b3a92bb75aa1b8152e;
integrada em fast-forward a correção concorrente de teste c5a395fe8075453be4a24731eb5f584d3b729725 antes do commit.

## Problema, impacto e código aplicado

A fila usava estilos próprios para botões, formulários, avisos, loading e status;
o filtro ativo ainda era verde e os campos tinham 12 px. Isso aumentava manutenção
e dificultava leitura/toque no celular.

- `app/marketplace/moderacao/page.tsx`: Button, Select, Textarea, InlineNotice,
  LoadingState, Badge e StatusChip compartilhados. Labels e IDs preservados;
  contador da justificativa associado por aria-describedby.
- Cada ocorrência recebe nome acessível pelo título, distinguindo formulários.
- Retorno para `/marketplace`, sem nomenclatura antiga de laboratório nas instruções.
- `moderation.css`: removidas bases duplicadas de campos, botões, loading e status;
  cores substituídas pelos tokens; mantidos layouts específicos da fila.
- Filtros em duas colunas no celular, campos de 16 px, ações de 44 px, foco visível,
  paginação com quebra e espaço inferior para navegação mobile.
- `tests/browser/operational-home.mjs`: fixtures de permissão e fila privada, paginação
  com limite 30, filtros, confirmação cancelada, rejeição com rascunho preservado,
  envio pendente, retorno saved e atualização. Decisões exclusivamente sintéticas.
- Inventário CSS atualizado pelo script da Parte 45.

Não foram alterados RPCs, permissões, schema, SQL, limites ou regras de decisão.
A autorização segue no servidor e não é concedida por este componente.
O teste de acesso negado comprova que a UI não solicita a fila privada nessa condição;
não substitui auditoria de isolamento no banco real.

## Validação e limites

270 testes Node locais, TypeScript e build aprovados. CI e capturas desta parte
serão registrados após conclusão. Cenários de navegador em 360/768/1280 px.
CSS da fila: 6860 → 5125 bytes de fonte, sem medição de bundle ou latência.

Esta é uma migração de apresentação. Tratamento legado de transporte/respostas
malformadas e confirmação incerta das decisões administrativas ainda requer revisão
específica; não se afirma que novos controles resolvem esses comportamentos.
Nenhum conteúdo real foi moderado. Nenhum deploy ou mudança no banco de produção.

## Continuidade

Próxima parte: mapear importações/cascata dos CSS globais e legacy e remover somente
regras comprovadamente redundantes, com regressão das telas consumidoras.
Limpeza CSS segue parcial. Estimativa restante de 5–9 entregas para o escopo original,
sujeita aos achados das jornadas e auditoria de segurança/performance.
Auto deploy continua desabilitado para todas as branches.
