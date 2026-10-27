# Stage Flow — Central interna de notificações (homologação)

## Entrega e escopo
- Desenvolvida na branch **develop**, apenas Supabase **QA** `zycuprhymoukhnuamtit`.
- Rota protegida: `/notificacoes`, com atalho no painel e sininho com contador de não lidas.
- Avisos de: convites para shows recebidos, aceites, recusas, cancelamentos; propostas de contratação recebidas, aceitas, recusadas ou retiradas; novas mensagens no chat de contratação.
- Mensagens de chat são **agrupadas por conversa** (uma notificação reaberta por conversa): não criamos uma linha nova por cada texto. Mensagens automáticas de proposta têm alerta próprio e são suprimidas do agrupamento.
- Atualização por **polling apenas no navegador**: sininho cerca de 25 s e caixa de entrada cerca de 20 s quando a aba está visível. **Sem Web Push, sem aplicativo, sem chamadas ou avisos WhatsApp.**

## Banco QA
Migração `supabase/internal_notifications_migration.sql` aplicada em homologação após as migrações de `invitations`, `stage_hiring_proposals`, `stage_hiring_messages` e `stage_hiring_threads`.

Tabela privada `stage_internal_notifications` com RLS e sem acesso direto a `anon` ou `authenticated`.

As notificações são criadas por três triggers transacionais: `invitations`, `stage_hiring_proposals`, `stage_hiring_messages`. A alteração de status e o aviso são confirmados ou revertidos juntos. Todas as funções de trigger usam `SECURITY DEFINER` com `search_path=''` e `EXECUTE` revogado de roles públicos.

Leitura e modificação exclusivamente pelas RPCs:
- `stage_notifications_list(p_filter,p_limit)` filtra por `auth.uid()`, máximo 100 registros por chamada, aceita todos ou apenas não lidos.
- `stage_notifications_mark(p_ids,p_all)` marca somente registros do destinatário atual como lidos.
- `stage_notifications_unread_count()` retorna apenas a quantidade não lida da própria conta.

Nenhuma notificação exibe o WhatsApp, telefone, email ou o cachê de outro músico. Os links para assuntos são derivados dos identificadores de evento e conversa, não de URLs arbitrárias no banco, e os próprios módulos validam quem pode abrir cada assunto.

## Comportamentos
- Convite pendente novo => notifica o músico. Convite aceito ou recusado => notifica o organizador. Convite cancelado => notifica o músico, inclusive em substituição de equipe.
- Proposta pendente => notifica o músico. Proposta aceita ou recusada => notifica quem contratou. Proposta retirada => notifica o músico.
- Nova mensagem no chat => notifica somente o outro participante; a conversa é aberta por `/conversas?conversa=<thread_id>`, validando que pertence à conta.
- Eventos antigos, gerados **antes** da migração, **não recebem notificações retroativas**. A central registra somente acontecimentos novos.
- Marcar um aviso como lido não altera estado do convite, proposta ou mensagem. Marcações são individuais e irreversíveis nesta versão.
- São mostrados até 100 avisos mais recentes, por filtro. Paginação e controle de retenção poderão ser implementados no refinamento.
- Por enquanto não há painel de configuração de categorias ou horas silenciosas; isso pode ser acrescentado no futuro.

## Testes e limites
- `npm run test:notifications` incluído no CI, junto com TypeScript, Next build e testes anteriores.
- Teste QA transacional realizado com duas contas de exemplo: convite novo, aceito, recusado, cancelado, proposta recebida/aceita, duas mensagens de chat agrupadas, leitura, contador, isolamento entre contas e acesso RPC anônimo negado. `ROLLBACK` no final; nenhum registro de teste persistido.
- **Pendência para homologação integrada:** navegar com duas contas reais e conferir chegada das notificações, deep links, marcação como lida, acessibilidade no mobile e tempos percebidos.
- Notificações não implicam aceite, pagamento, entrega de WhatsApp ou push. A estrutura futura da Meta continua **desligada** por padrão.
- A Vercel de homologação precisa receber manualmente o último commit aprovado em `develop`. A produção e o marketplace público não foram alterados.
