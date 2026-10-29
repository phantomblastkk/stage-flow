# StageFlow — Parte 36: controles da galeria

Data: 29/10/2026. Base verificada: a20dddf6bd24df67200b3d0fa8dd040ffa5db8a7.

## Problema, impacto e solução aplicada

O editor de fotos e vídeos ainda usava inputs e botões próprios. A renomeação não
mostrava seu rótulo e a linha de miniatura reduzia o espaço das ações no celular.
Isso dificultava o toque, o foco por teclado e a confirmação de remoção.

- Campos de nome da foto, título/link do vídeo e renomeação usam Input compartilhado.
- Todas as ações do editor usam Button, com confirmação de remoção em variant danger.
- Foco e estados disabled vêm dos componentes compartilhados. Cancelar edição/remoção
  também fica bloqueado durante operações, preservando o contexto da resposta.
- Rótulo de renomeação visível, campo em linha própria, alvos de botão de 44 px.
- Até 560 px os itens usam uma coluna, sem comprimir as ações ao lado da miniatura.
- Campos têm texto de 16 px; ícones decorativos ficam fora da árvore acessível.
- IDs dos campos de foto/vídeo não colidem com os títulos da prévia pública.
- Retirados estilos locais de base de input, botão, hover, disabled e confirmação.

## Código e invariantes

Arquivos: premium-media-gallery.tsx, premium-media-gallery.css e
tests/browser/operational-home.mjs. Os hooks de dados e PremiumGalleryShowcase são
textualmente idênticos à base. Mantidos validação nativa, envio explícito, campo
preservado em falha, reconciliação após resposta incerta, serialização de mutações,
proteção de mídia publicada e exclusão física só após remoção confirmada.

## Validação

266 testes Node, TypeScript e build aprovados localmente. Ambos os CIs aprovados
no código final 29468282d0e6af5d127a886363143ac48cbe8e50.
A cobertura existente exercita leitura falha, URL assinada, inserção incerta,
renomeação serializada, remoção rejeitada e arquivo privado. Novas verificações
cobrem componentes compartilhados, toque de 44 px, foco, validação required,
cancelamento sem escrita, IDs dos campos, overflow e ausência de leituras/publicação
adicionais em 360/768/1280 px. Fixtures sintéticas; sem acesso a dados de produção.

## Evidências finais

- [Diff da etapa](https://github.com/phantomblastkk/stage-flow/compare/a20dddf6bd24df67200b3d0fa8dd040ffa5db8a7...29468282d0e6af5d127a886363143ac48cbe8e50).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40880699466).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40880699225): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas sintéticas no navegador.
- Logs PASS gallery recovery e PASS gallery controls nos três tamanhos: 360, 768 e 1280 px.
- Artefato operational-ux-evidence ID 12899679305: 108 PNGs e seis JPGs, incluindo seis capturas novas de renomeação e confirmação de remoção.
- Revisão visual: edição em 360 px e confirmação em 1280 px. Capturas incluem a navegação global fixa. Toque, foco e overflow também têm verificações automáticas.
- Hook da galeria e showcase público textualmente idênticos à base, sem novo hook, listener, consulta ou dependência. Revisão React: rótulos associados, type explícito, ícones decorativos e bloqueios nativos preservados.
- premium-media-gallery.css: 483 → 464 linhas; remoção localizada de estilos substituídos pelo Design System.
- A primeira execução identificou seletor de teste com ID antigo; corrigido antes da execução final aprovada. O ID novo evita colisão com títulos do showcase.
- Build local passou; o ajuste posterior de align-items para flex-end foi verificado no build final do CI. Permanecem avisos já existentes de ferramentas; não há medição de ganho de bundle nesta parte.

## Limites e continuidade

A migração geral de CSS continua parcial. Sem mudanças de banco, Auth, RLS,
permissões, Storage ou dependências. Sem deploy e com auto deploy desabilitado.
Próxima parte: padronizar os controles de publicação Pro e os avisos da galeria,
preservando confirmação explícita e verificação de status.
