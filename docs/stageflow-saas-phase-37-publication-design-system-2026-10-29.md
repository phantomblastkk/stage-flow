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

266 testes Node, TypeScript e build aprovados localmente e no CI. Código testado:
ec2987ecae8634b14bf17b7ee761f9f911822da9.
As jornadas existentes verificam falha/status inválido, rejeição de permissão,
confirmação cancelada, escrita incerta, desativação/republicação e resposta antiga.
Novas verificações cobrem avisos compartilhados, foco visível, controles de 44 px,
link canônico, cancelamento das três ações, cópia bem-sucedida e erro de clipboard
em 360/768/1280 px, com fixtures sintéticas e sem dados de produção.

## Evidências finais

- [Diff da etapa](https://github.com/phantomblastkk/stage-flow/compare/c18ff0f63392db2304c61bf621fd06f0db04ae41...ec2987ecae8634b14bf17b7ee761f9f911822da9).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40883025395).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40883025505): 266 testes, TypeScript, build, PostgreSQL temporário e jornadas sintéticas de navegador.
- Logs PASS publication recovery e PASS publication controls nos três tamanhos.
- Artefato operational-ux-evidence ID 12902160266: 111 PNGs e seis JPGs. Três capturas novas mostram ações compartilhadas, foco e aviso de falha de clipboard.
- Revisão visual de controles em 360 e 1280 px. As capturas incluem a navegação global fixa, que pode sobrepor trechos da imagem de componente. Foco, toque e ausência de overflow também foram verificados automaticamente.
- pro-publish-controls.css: 144 → 99 linhas. premium-media-gallery.css: 464 → 453 linhas. Não há medição de redução de bundle ou latência nesta parte.
- Revisão React: sem novo hook, listener ou dependência; botões com type nativo padrão, link semântico, ícones decorativos e feedback alert/status preservados.

## Limites e continuidade

A migração geral de CSS continua parcial. Sem alteração de banco, Auth, RLS,
Storage, permissões ou cobrança. Sem deploy; auto deploy permanece desabilitado.
Próxima parte: acessibilidade da galeria pública e do visualizador de fotos,
incluindo navegação por teclado e retorno de foco ao fechar.
