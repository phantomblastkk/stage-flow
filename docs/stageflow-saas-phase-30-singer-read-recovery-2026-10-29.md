# StageFlow — Parte 30: recuperação de leitura do cantor

Base: 43b60143952a0731284450242a47fe9e9a126fbc, diretamente na main.

## Problema, impacto e implementação

| Problema | Impacto | Correção aplicada |
|---|---|---|
| Falha na leitura inicial sem tentativa na própria tela | Usuário precisa sair ou recarregar; mensagens pedem executar SQL | Estado de erro com Tentar novamente e retorno ao painel; nenhuma edição de perfil vazio |
| Conta sem função de artista tratada como falha genérica | Usuário não sabe como resolver | Orientação específica e link para conferir a conta; sem liberar edição |
| Leitura da preferência bloqueava todo o carregamento | Falha acessória atrasa acesso ao perfil | Efeito independente após perfil válido, com carregamento e tentativa próprios |
| Recuperar preferência exige recarregar a página | Risco de perder alterações locais | Repetir somente stage_my_artist_booking_settings, mantendo o rascunho |
| Mensagens exibem SQL ou erro bruto do backend | Confusão e exposição de detalhes de implementação | Textos claros para leitura, preferência, reserva de usuário, upload e gravação; códigos de negócio conhecidos mantêm orientações específicas |

A preferência só se altera após confirmação do servidor. Falhas mantêm o valor
confirmado, não habilitam contratação e liberam a ação para tentar novamente.
Leituras têm descarte de respostas após desmontagem; exceções não deixam o loader
inicial preso. Sessão ausente continua direcionando ao login. Tentativas são
explícitas; não há repetição automática, polling, migration ou novo endpoint.

## Arquivos e diff

- components/artist-profile-editor.tsx: estado de recuperação, leitura independente
  da preferência, proteção de respostas tardias, mensagens e confirmação da preferência.
- app/meu-perfil-artistico/singer-unified-editor.css: ações de recuperação com tokens
  compartilhados e quebra de linha para telas pequenas.
- tests/browser/operational-home.mjs: falhas HTTP 503, perfil ausente, recuperação,
  controle de requisição pendente, preservação de rascunho e rejeições de gravação.

`git diff 43b6014 -- components/artist-profile-editor.tsx app/meu-perfil-artistico/singer-unified-editor.css tests/browser/operational-home.mjs`

## Validação

- 266 testes Node, TypeScript e build aprovados localmente; CI em validação.
- O primeiro teste de navegador detectou que a classe da introdução é ocultada pelo hub.
  A recuperação recebeu uma classe própria; o teste permanece na rota real /perfil-artistico.
- Cenários de navegador acrescentados para 360/768/1280 px: erro inicial sem formulário,
  perfil ausente sem liberação indevida, recuperação explícita, preferência inicialmente
  indisponível, repetição pendente sem duplicação, falso carregado como falso e rascunho
  intacto sem nova leitura/gravação do perfil.
- Rejeição da preferência conserva false e impede liberação do formulário de contratação;
  nova tentativa confirmada libera a ação existente.
- Erro técnico de save não aparece na tela; texto local permanece e a tentativa seguinte
  envia o mesmo payload. Testes prévios de publicação, uploads e cores preservados.
- APIs inteiramente simuladas em example.supabase.co. Sem dados ou credenciais reais.

## Limites e próxima etapa

Não muda Auth, RLS, buckets, payloads nem regras de publicação. Não recupera sessões
ou modifica funções da conta automaticamente. A redução de estilos inline da parte
anterior permanece; a migração geral de CSS continua parcial.

Próxima parte: revisar os controles de aparência e galerias do editor avançado em
blocos pequenos, começando pelos estados de leitura/erro e preservação dos rascunhos.
Mensagens e exceções de outras telas continuam fora desta parte. Validação de teclado
virtual em aparelhos reais permanece necessária.

Sem deploy, migrations ou alterações em produção.
