# StageFlow — Parte 33: recuperação do controle de publicação Pro

Base: d08021886aab51d3ddce0c5ccf7896a6ddc69218, diretamente na main.

## Problema, impacto e implementação

| Problema | Impacto | Correção |
|---|---|---|
| Falha de consulta tratada visualmente como Pro não liberado | Informação incorreta sobre o acesso da conta | Estados verificando/indisponível separados de acesso confirmado |
| Dados da consulta aceitos sem validar formato | Retorno incompleto pode liberar ou bloquear ações incorretamente | Exige booleanos e formato esperado antes de habilitar o controle |
| Ausência de descarte de respostas antigas ao mudar de aba | Estado antigo pode substituir uma consulta nova | Versão por leitura, descarte na desmontagem e ao ocultar a aba |
| Falha de publicação permite repetir sem saber o resultado | Risco de publicação/desativação repetida | Resultado incerto exige nova consulta; nenhuma repetição automática da gravação |
| Publicação atualizada de forma otimista | Permissões e estado podem ficar desatualizados | Confirmação da RPC seguida de consulta do estado real; erro de consulta mantém estado indisponível |
| Erros exibem SQL ou detalhes do backend | Usuário não recebe orientação útil | Mensagens claras, códigos de negócio conhecidos e tentativa explícita |
| Ações e feedback de cópia sobrevivem a consultas diferentes | Estado local pode se referir a outro snapshot | Trava síncrona de gravação e reinicialização de feedback ao consultar |

Ativar, republicar e desativar continuam exigindo confirmação. Cancelar não grava.
A permissão continua sendo validada pela RPC existente; não há concessão no navegador.
Sem acesso, não há ativação; o dono pode desativar uma versão já publicada mesmo após
perder o acesso Pro. Perfil gratuito, design e galeria não são alterados pelo controle.

A leitura pode ser refeita sem sair da aba. Se a gravação for confirmada e somente a
consulta seguinte falhar, a interface mantém a confirmação da ação e solicita consultar
o estado antes de oferecer outra alteração. O resultado de uma resposta incerta não
é convertido em sucesso ou em reversão otimista.

## Arquivos e diff

- app/meu-perfil-artistico/site-profissional/pro-publish-controls.tsx: estado validado,
  recuperação, descarte de respostas, travas, confirmação e LoadingState/Button compartilhados.
- app/meu-perfil-artistico/site-profissional/pro-publish-controls.css: retirada de
  estilos de carregamento/verificação substituídos por componentes; alvos de 44 px.
- tests/singer-public-site.test.mjs: contrato da revalidação de aba atualizado com
  dependência estável e invalidação da leitura anterior.
- tests/browser/operational-home.mjs: publicação consultável/mutável por API simulada,
  incluindo resultado aplicado no servidor antes de uma resposta HTTP 503.

`git diff d080218 -- app/meu-perfil-artistico/site-profissional/pro-publish-controls.tsx app/meu-perfil-artistico/site-profissional/pro-publish-controls.css tests/singer-public-site.test.mjs tests/browser/operational-home.mjs`

## Validação

266 testes Node, TypeScript e build aprovados localmente; primeira rodada dos dois CIs aprovada.
A revisão visual detectou o aviso de acesso dividido em colunas pelo flex. O texto
foi agrupado para manter o parágrafo legível; validação final em andamento.

Cenários novos em 360/768/1280 px: status com erro, ausente ou malformado; tentativa
pendente sem duplicação; acesso não liberado e perfil gratuito privado bloqueando
ativação; confirmação cancelada sem gravação; perda de acesso entre leitura e ação;
ativação concluída antes de resposta 503 e reconciliada sem repetir a publicação;
cancelamento e falha de desativação; desativação permitida após revogação de acesso;
gravação confirmada com falha somente na consulta posterior; ativação/republicação
explícitas; resposta antiga da aba oculta descartada após uma consulta nova; manutenção
do tema e dos campos da galeria. Link público continua /cantor-teste no fixture.

## Limites e próxima etapa

Não modifica Auth, RLS, schema, bucket, RPCs, assinatura/cobrança, domínio ou permissões.
Todos os cenários usam conta e API sintéticas; não publicam perfis reais.
Cópia para clipboard e teclado virtual em aparelhos físicos não receberam novo teste.
Não cria limpeza automática de arquivos órfãos privados, pendência da parte anterior.
A migração geral de CSS continua parcial.

Próxima parte: revisão da leitura e recuperação da agenda na prévia avançada,
separando falhas de agenda/flyers do design e da identidade, com consultas limitadas.

Sem deploy nem operações em dados de produção.
