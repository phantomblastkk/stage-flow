# StageFlow — Parte 8: convites, conversas e continuidade da contratação

Base verificada na `main`: `11b00674c891d872516dd0f1cb00177555c047a4`.
Continuação da [Parte 7](stageflow-saas-phase-7-account-context-2026-10-27.md).
Sem develop, homologação, banco remoto, migrations ou deploy.

## Problema → impacto → solução aplicada

| Problema | Impacto | Alteração |
|---|---|---|
| Tipos, regras de links e chamadas RPC ficavam dentro das páginas | Contratos difíceis de testar e reaproveitar | Novo domínio `booking` com tipos, links e serviços de convites/conversas |
| Mensagens antigas podiam terminar depois da seleção de outra conversa | Conteúdo de A aparecia sob o nome de B | Hook cancela a leitura, verifica seleção e mascara o snapshot anterior já no render |
| Texto digitado era compartilhado entre conversas | Risco de enviar um rascunho ao destinatário errado | Rascunhos por ID da conversa, somente na memória; limpos pela desmontagem do contexto de conta |
| A conversa selecionada era consultada no bootstrap e no efeito | Duas leituras iniciais das mesmas mensagens | Uma única leitura inicial; polling não inicia outra enquanto há consulta pendente e pausa em abas ocultas |
| Erros de leitura eram ignorados ou pareciam uma caixa vazia | Usuário não sabia se faltava informação | Erro recuperável nas mensagens, lista e convites; retry explícito, sem detalhes SQL/migrations no fluxo |
| Preferência opcional de WhatsApp podia bloquear a abertura da conversa | Configuração secundária interrompia contratação | Carregamento separado; falha fica no formulário opcional, que não permite salvar antes de carregar o estado |
| Lista e conversa ficavam empilhadas em uma tela estreita | Rolagem e perda de espaço para responder | Até 750 px, navegação lista → conversa → “Todas as conversas”; alvos principais com mínimo de 44 px |
| Limite fixo de altura cortava o compositor com cabeçalhos/propostas maiores | Campo de mensagem e envio podiam ficar inacessíveis, especialmente em 768 px | Painel cresce com os controles; a área de mensagens mantém sua rolagem limitada; regressão verifica o botão dentro dos limites do painel |
| Convite aceito abria a agenda geral; proposta aceita levava o músico ao histórico | Usuário precisava procurar o show novamente | Links com o ID exato do evento; seleção de conversa também fica na URL para reabertura |
| A agenda resolvia links apenas para o produtor | Link de um músico não encontrava sua participação | Resolução primeiro pela consulta do proprietário e depois pela RPC de participações aceitas, limitada a um ID; pin independente do mês e da página carregados |
| O destaque podia aparecer antes de iniciar a consulta do novo mês | Show selecionado sumia durante a transição | Leitura do mês anterior é cancelada e o carregamento começa junto da mudança de mês, antes do efeito de consulta |

## Código aplicado

- `src/domains/booking/types.ts`: contratos de convite, conversa e mensagem.
- `model/booking-links.ts`: IDs UUID, links de continuidade e validação de datas reais.
- `services/booking-service.ts`: leituras abortáveis pelas RPCs existentes; mutações validam conta atual, IDs, mensagem e data; preservam resultados de cachê pendente, convite respondido e limite de envio.
- `hooks/use-conversation-messages.ts`: isolamento de requisições/rascunhos, carregamento, retry e polling visível.
- `app/conversas/page.tsx`: consome os serviços e hook, preserva propostas privadas, disponibilidade e preferências existentes; erro de mensagem não reutiliza conteúdo de outra conversa.
- `app/conversas/conversas.css`: lista/conversa no celular, largura mínima dos controles e quebra de nomes longos.
- `app/meus-convites/page.tsx`: usa conta compartilhada, serviço de convites e retry; aborta leituras concorrentes ao responder, mantendo negociação de cachê antes da confirmação.
- `components/hiring-proposals.tsx`: proposta aceita pelo músico aponta para a participação específica quando há evento vinculado.
- `src/domains/events/services/agenda-service.ts` e `app/eventos/page.tsx`: abertura de show próprio/participação aceita e destaque do item sem conceder controles de produtor ao músico.

## Autorizações preservadas

Nenhum endpoint novo, tabela, política RLS ou função SQL foi criado/modificado.
As RPCs existentes continuam validando participantes, convites, propostas e
disponibilidade no banco. As mutações extraídas também conferem o usuário Auth
atual contra a conta apresentada; email/metadados editáveis não concedem acesso.

O link não autoriza acesso. Conversa recebida pela URL precisa estar na lista
privada antes de consultar mensagens. O fallback da agenda usa somente
`stage_accepted_shows`, filtrado pelo evento; não faz leitura pública do evento
nem expõe equipe/financeiro do produtor ao participante. Falha de rede na
consulta do proprietário gera erro, não uma tentativa de contornar o acesso.

Cancelamento protege a apresentação de leituras atrasadas. Não promete desfazer
uma mutação que o servidor já recebeu. Formulários e rascunhos não são persistidos
em cache global, cookies ou localStorage. O WhatsApp continua opcional e não há
ativação de envios automáticos, pagamentos ou mudança de acesso ao marketplace.

## Validação

- 204 testes Node: 10 novos testes executáveis do serviço/links de contratação e três da resolução de participação na agenda.
- Serviços testados com o builder PostgREST real e fetch sintético: parâmetros, datas impossíveis, IDs injetados, resposta inválida, cancelamento, conta divergente, falha transitória Auth, cachê pendente e rate limit.
- TypeScript e build Next.js verificados com URL/chave fictícias.
- Navegador ampliado em 360/768/1280 px: uma leitura inicial, troca A/B com resposta atrasada, rascunhos separados, erro/retry, envio para o ID correto e aceite de proposta até participação selecionada em outro mês.
- No celular: preferência de WhatsApp indisponível não bloqueia inbox; link de conversa alheia não consulta mensagens; convites recuperam de falha sem exibir estado vazio enganoso.
- Os testes anteriores de Agenda, Financeiro, CSV e troca de conta entre abas foram mantidos.
- A primeira rodada aprovada identificou visualmente um recorte do compositor em 768 px; o cenário de regressão agora exige que o botão de envio fique dentro do painel nas três larguras.
- CI/navegador final: registrar o resultado aprovado após verificar o compositor.

Os cenários usam somente contas e respostas sintéticas. Não houve teste com
Auth/RLS reais, alteração de banco ou benchmark de carga. O polling visível ainda
é a implementação de atualização; Realtime/paginação e a migração completa do
editor de propostas/negociação de cachê permanecem para etapas separadas.

## Próxima etapa

Extrair propostas e negociação de cachê para o domínio `booking`, preservando os
contratos de disponibilidade, confirmação e valores. Depois reduzir o custo da
inbox com paginação e uma estratégia de atualização medida com dados de carga.
