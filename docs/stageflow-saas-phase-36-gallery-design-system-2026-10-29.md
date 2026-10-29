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

266 testes Node e TypeScript aprovados localmente. Build e navegador em validação.
A cobertura existente exercita leitura falha, URL assinada, inserção incerta,
renomeação serializada, remoção rejeitada e arquivo privado. Novas verificações
cobrem componentes compartilhados, toque de 44 px, foco, validação required,
cancelamento sem escrita, IDs dos campos, overflow e ausência de leituras/publicação
adicionais em 360/768/1280 px. Fixtures sintéticas; sem acesso a dados de produção.

## Limites e continuidade

A migração geral de CSS continua parcial. Sem mudanças de banco, Auth, RLS,
permissões, Storage ou dependências. Sem deploy e com auto deploy desabilitado.
Próxima parte: padronizar os controles de publicação Pro e os avisos da galeria,
preservando confirmação explícita e verificação de status.
