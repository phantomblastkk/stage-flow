# StageFlow — Parte 31: recuperação segura do rascunho avançado

Base: ae01d2afb9aba0506eb589af57df67621c671757, diretamente na main.

## Problema → impacto → solução aplicada

| Problema | Impacto | Implementação |
|---|---|---|
| Falha na leitura do design deixava os valores padrão editáveis e salváveis | Risco de sobrescrever um design existente que não foi carregado | Estado de leitura explícito; opções e ação de salvar só aparecem após obter um objeto de rascunho válido; handler também bloqueia gravações prematuras |
| Ausência de tentativa de recuperar a prévia ou o design | Usuário precisa recarregar toda a página | Tentativa da identidade quando a prévia não abre; tentativa independente de stage_my_premium_site_draft |
| Erros exibem nomes de SQL, códigos e mensagens do backend | Orientação confusa para o artista | Textos claros nas leituras de identidade/design/agenda e na gravação do design |
| Possibilidade de alterar controles durante uma gravação pendente | Diferença entre o que está sendo salvo e a prévia visível | Fieldset bloqueado durante o save e liberação em finally |
| Atualização de identidade podia rejeitar sem tratamento | Erro de promessa e risco de confusão ao voltar para a aba | Rejeição tratada; mantém identidade e design atuais |

A leitura do design foi separada de identidade, agenda e galeria. Repetir essa leitura
não reinicia as outras consultas. Depois de uma leitura válida, não há botão para
recarregar por cima de mudanças locais. O editor continua montado ao alternar abas.
A publicação Pro conserva seus bloqueios existentes e continua sendo uma ação separada.

Mantida a atualização de rascunhos legados com seção portfolio separada em Fotos e
Vídeos; a mensagem orienta conferir e salvar as escolhas, sem pedir execução de SQL.
O backend continua validando o mesmo payload e as mesmas permissões.

## Arquivos e diff

- components/singer-pro-editor.tsx: leituras, recuperação, bloqueio de rascunho desconhecido,
  descarte de respostas após desmontagem, tratamento de falhas e LoadingState compartilhado.
- app/meu-perfil-artistico/site-profissional/premium-preview.css: normalização do fieldset,
  preservando o espaçamento do grid existente; estado bloqueado e carregamento.
- tests/browser/operational-home.mjs: cenários avançados pela rota /perfil-artistico e
  abas reais, com conta e APIs inteiramente simuladas.

`git diff ae01d2a -- components/singer-pro-editor.tsx app/meu-perfil-artistico/site-profissional/premium-preview.css tests/browser/operational-home.mjs`

## Validação

266 testes Node, TypeScript e build aprovados localmente e no CI.
A primeira rodada de navegador passou; a revisão visual levou a ocultar opções
padrão durante a falha, para destacar o aviso e a tentativa de recuperação.

Novos cenários em 360/768/1280 px: falha de identidade sem consulta de design;
recuperação da identidade; design com erro HTTP e depois ausente sem edição/save;
tentativa pendente sem duplicação; recuperação de tema Ivory, cor Dourado e visibilidade
salvos no servidor simulado; mudança para Concert/Coral e reordenação de Vídeos;
alternância de abas preservando o design mesmo com atualização de identidade rejeitada;
falha no save seguida de tentativa com payload idêntico; nenhuma publicação automática.
Consultas de eventos continuam limitadas a 40, ao proprietário, públicos e publicados.

## Evidências finais

- Implementação inicial: a2c0b49ba6754d5de7164771dd96b99e51b0f9d6.
- Versão final testada: 46f28088f79132da556ef1a765ee6a1022a10cf9.
- [Diff completo](https://github.com/phantomblastkk/stage-flow/compare/ae01d2afb9aba0506eb589af57df67621c671757...46f28088f79132da556ef1a765ee6a1022a10cf9).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40825405701).
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40825405494): 266 testes, PostgreSQL temporário, TypeScript, build e jornadas reais de navegador com APIs sintéticas.
- Artefato operational-ux-evidence, ID 12875399765: 75 capturas PNG; seis novas capturas do design com falha e recuperado em três larguras.
- Logs confirmam PASS advanced draft em 360, 768 e 1280 px, incluindo bloqueio de sobrescrita, escolhas salvas, persistência entre abas, nova tentativa com payload idêntico e nenhuma publicação.
- Revisão visual das capturas do componente em 360 px e das opções recuperadas em 1280 px; ausência de overflow também verificada no navegador. As capturas de componente incluem os elementos fixos da navegação global.
- Revisão React: efeitos de leitura independentes com descarte na desmontagem, dependência booleana de identidade para não reinicializar o design ao atualizar o perfil, fieldset nativo e ações type=button.

## Limites e continuidade

Nenhuma migration, RLS, assinatura de RPC, bucket ou payload foi modificado. Não foi
alterado o comportamento de publicação/assinaturas nem a operação de fotos e vídeos.
A galeria e o controle de publicação ainda possuem mensagens técnicas e estados de
recuperação próprios que precisam de revisão em etapas futuras. A agenda continua
sem tentativa independente nesta parte. A migração geral de CSS continua parcial.

Próxima etapa: recuperação de leitura da galeria e proteção de alterações de mídia,
com testes de erro/tentativa e sem apagar ou publicar arquivos automaticamente.

Sem deploy nem acesso a dados de produção.
