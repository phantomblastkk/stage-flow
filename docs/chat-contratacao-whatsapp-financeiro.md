# Stage Flow — chat de contratação + avisos WhatsApp + central financeira

## Situação e isolamento
- Código na branch `develop`; **nenhum merge para `main`**.
- Banco homologação `zycuprhymoukhnuamtit` recebeu as migrações abaixo; não foi aplicado no banco oficial.
- Marketplace público permanece na página **Em breve**. O chat começa no catálogo **/marketplace/preview** quando um músico elegível é aberto.
- Rota `/conversas` é a caixa de entrada dos dois participantes. `/financeiro` é o painel geral pessoal. Ambos estão ligados em `/painel`.
- O chat usa atualização a cada ~8 segundos quando uma conversa está aberta e ~22 segundos para atualizar a lista. **Não usa push**, e não depende de Apple/Google Store.
- Não apresenta o número pessoal do músico no chat; a API WhatsApp manda apenas um aviso genérico para voltar ao Stage Flow.

## Ordem das migrações de QA
1. Migrações normais de perfil/agenda/eventos/convites.
2. `private_fee_negotiations_migration.sql`, `event_financial_summary_migration.sql`, `event_revenue_expenses_migration.sql`, `show_history_reports_migration.sql`.
3. `hiring_chat_whatsapp_migration.sql`.
4. `finance_dashboard_migration.sql`.

No QA, todos os requisitos e as migrações 3 e 4 foram executados. `stage_hiring_control.released` permanece **false**; uma única conta administrativa foi cadastrada em `stage_hiring_access` para iniciar chats de teste. Só a conta do músico destinatário pode responder sobre disponibilidade. **Não alterar o flag `released` até o marketplace ser lançado.**

### Fluxo de contratação
- No preview do marketplace, abrir o card e clicar **Conversar e consultar disponibilidade**. Filtro de data selecionado é encaminhado ao chat. Se houver evento selecionado, ele também fica vinculado.
- Quem iniciou a conversa escreve uma mensagem sobre data e cachê. O músico responde na conversa e pode marcar **Disponível / Indisponível / A combinar**.
- O botão de convite existente continua sendo a próxima etapa formal, separada da negociação por chat. O chat **não reserva automaticamente a data**, não gera contrato e não marca pagamento.
- Conversas são privadas e paginadas a 200 mensagens recentes por vez. O banco limita novas conversas a 15/dia/conta e mensagens a 20/min/conta.
- Ambas as partes precisam ter conta para receber/enviar. Um gerente de casa pode abrir chats como qualquer usuário permitido, mas a permissão de administrador da casa **não concede** acesso a conversas alheias.
- Depois do teste com a primeira conta, criar **uma segunda conta Auth legítima de músico na homologação** para completar um teste de envio, recebimento, disponibilidade e isolamento. Não criar contas fictícias por SQL direto no Auth nem permitir que contas de teste acessem produção.

### Segurança e privacidade
- `stage_hiring_start`, `stage_hiring_list`, `stage_hiring_messages`, `stage_hiring_send` validam `auth.uid()` no banco; nenhuma tabela do chat concede acesso direto aos usuários ou visitantes.
- `stage_hiring_whatsapp_preferences` armazena número + consentimento *só para avisos do chat*. Nunca expõe esse telefone por RPC ao contratante. Consentimento é revogável, desligado por padrão.
- Outbox limita avisos por conversa/destinatário a 1/10 min e mensagens pendentes vencem em 20 min. Não envia retroativamente avisos velhos quando a API for conectada.
- Mensagens do usuário não são inseridas no template WhatsApp; o aviso contém somente texto genérico.
- **Não usar `NEXT_PUBLIC_` para tokens Meta ou Supabase service-role.**

## Ativação futura da API oficial WhatsApp Cloud (NÃO ativada agora)
É necessária uma conta empresarial Meta com WhatsApp Business Platform configurada, número remetente vinculado, token com permissão, consentimento dos destinatários e **template previamente aprovado pela Meta** (modelo sem variáveis, como `stage_flow_nova_mensagem`, idioma `pt_BR`, categoria aprovada conforme o conteúdo de utilidade). A API não manda mensagens livres fora da janela de atendimento de 24 horas.

Rota servidor: `GET /api/stage-chat/whatsapp-dispatch`, exigindo `Authorization: Bearer <cron-secret>`. Sem configuração retorna apenas `disabled`.

Criar as seguintes **variáveis de ambiente do servidor do projeto Vercel correto**, quando for conectar:

```env
STAGE_CHAT_WHATSAPP_ENABLED=false
STAGE_CHAT_CRON_SECRET=<segredo_longo_aleatorio>
SUPABASE_SERVICE_ROLE_KEY=<chave_privada_do_SUPABASE_DESTE_AMBIENTE>
WHATSAPP_CLOUD_ACCESS_TOKEN=<token_oficial_Meta>
WHATSAPP_CLOUD_PHONE_NUMBER_ID=<id_numero_remetente>
WHATSAPP_CLOUD_TEMPLATE_NAME=stage_flow_nova_mensagem
WHATSAPP_GRAPH_API_VERSION=v26.0
```

**Jamais commitar valores reais.** A URL pública do Supabase `NEXT_PUBLIC_SUPABASE_URL` já faz parte do ambiente do site. Escolher nomes/idioma exatamente iguais ao template aprovado e não supor que o nome do exemplo já está cadastrado.

Depois:
1. Validar com destinatários de teste que deram consentimento, número no formato internacional, templates aprovados e política do WhatsApp.
2. Configurar Cron na Vercel para chamar a rota **GET** com segredo; a frequência pode ser a cada 1–5 minutos conforme o plano, respeitando limites e preço por mensagem.
3. Somente então mudar `STAGE_CHAT_WHATSAPP_ENABLED=true` em homologação e validar fila, erros, custos e desativação do consentimento.
4. O retorno `accepted_by_provider` significa que a Cloud API aceitou a requisição, **não** que o aparelho recebeu ou leu. Webhooks de entrega/erro, métricas e política de retenção podem ser incluídos antes de produção.

Sem API Meta conectada não haverá alertas WhatsApp automáticos; chat e preferências continuam funcionando no navegador.

## Central financeira `/financeiro`
- Reutiliza `stage_event_budget` para receita contratada/recebida; `stage_event_expenses` para transporte, alimentação, equipamento, equipe externa e outras despesas; e `stage_fee_negotiations` para cachês da banda.
- `stage_finance_musician_payments` anota valores que o **organizador declarou ter pago** a cada músico com convite aceito; a função de gravação exige `auth.uid() = events.producer_id` e não permite pagar acima do cachê registrado.
- Participações como músico continuam usando os lançamentos pessoais de `stage_show_participation_finance` da tela `/meus-shows`; cada pessoa enxerga os próprios valores, não a folha da banda.
- Cartões: receita bruta contratada, recebido manualmente, despesas, cachês acordados, saldo de caixa registrado e **resultado líquido estimado**. Com valores desconhecidos há aviso de totais parciais. O saldo de caixa não é extrato bancário nem comprova pagamento.
- Filtros por ano, mês, papel. Resumo mensal baseado na **data do show**, não na data do recebimento. Categorias de custo com barras, detalhes por show e exportação CSV com sanitização para evitar fórmulas em planilhas.
- Clique **Editar financeiro e pagamentos** para abrir o `EventBudgetPanel` existente e registrar quanto a equipe recebeu (controle manual). Use **Atualizar** após editar receitas/despesas se os cartões estiverem com cache.
- Shows cancelados não entram nos totais. Páginas de casas parceiras continuam com calendário, não recebem essa central financeira.

## Checklist de publicação QA
1. `npm run test:venue-security`, `npm run test:show-history`, `npm run test:chat-finance`, `npx tsc --noEmit`, `npm run build`.
2. Vercel de homologação: publicar o último commit `develop` (publicação automática desativada), mantendo `NEXT_PUBLIC_STAGE_FLOW_ENV=homologation`.
3. Testar: login → `/conversas` → cadastro WhatsApp opt-in/off → conversa com segunda conta → responder disponibilidade → somente participantes visualizam mensagens.
4. Testar `/financeiro`: show próprio → preencher valor contratado e gasto Transporte → registrar recebido → registrar pagamento do músico aceito → conferir resultado mensal/CSV e privacidade de outra conta.
5. Não habilitar fornecedor WhatsApp com segredo antes do teste explícito; não publicar marketplace nem aplicar migrações de QA no banco oficial.
