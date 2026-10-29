# StageFlow — Parte 37: publicação e avisos compartilhados

Data: 29/10/2026. Base: c18ff0f63392db2304c61bf621fd06f0db04ae41.

## Problema, impacto e solução aplicada

O controle de publicação mantinha botões, cores e avisos próprios, apesar de já
possuir verificação de status e confirmação explícita. A galeria também duplicava
estilos de erro, sucesso e limite. Isso dificultava manter foco, toque e feedback
consistentes com o restante do Perfil Artístico.

- Ativação, republicação, desativação e cópia usam Button compartilhado.
- A ação de desativar usa variant danger; todos os bloqueios existentes permanecem.
- O link de abrir o perfil usa os estilos compartilhados, preservando a semântica
  de link, o endereço canônico, nova aba e noopener/noreferrer.
- Publicação usa InlineNotice para orientação, erro e sucesso.
- Galeria usa InlineNotice para erro de leitura/ação, miniaturas indisponíveis,
  sucesso e limites de mídia. Preservados role alert/status e mensagens humanas.
- Retirados estilos locais de base de botões, links e avisos; ícones decorativos
  não duplicam o nome acessível das ações.

## Invariantes preservadas

Comparação textual: tipos, hooks e handlers de publicação idênticos à base.
Hook de galeria e showcase público também idênticos. Sem novo listener, consulta
ou dependência. Nenhuma publicação automática: confirmação nativa, status validado,
controle de permissão, rascunho salvo e galeria pronta continuam obrigatórios.
Resposta incerta exige nova consulta e não vira sucesso otimista. Desativação segue
permitida ao proprietário após revogação do acesso Pro. Copiar não publica.

## Validação

266 testes Node e TypeScript aprovados localmente. Build e CI em validação.
As jornadas existentes verificam falha/status inválido, rejeição de permissão,
confirmação cancelada, escrita incerta, desativação/republicação e resposta antiga.
Novas verificações cobrem avisos compartilhados, foco visível, controles de 44 px,
link canônico, cancelamento das três ações, cópia bem-sucedida e erro de clipboard
em 360/768/1280 px, com fixtures sintéticas e sem dados de produção.

## Limites e continuidade

A migração geral de CSS continua parcial. Sem alteração de banco, Auth, RLS,
Storage, permissões ou cobrança. Sem deploy; auto deploy permanece desabilitado.
Próxima parte: acessibilidade da galeria pública e do visualizador de fotos,
incluindo navegação por teclado e retorno de foco ao fechar.
