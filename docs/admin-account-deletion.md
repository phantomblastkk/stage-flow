# StageFlow — exclusão administrativa de contas

Status: **implementado no código da `main`, NÃO ativado em produção**.

## Onde fica

`/admin/central` → **Usuários** → **Gerenciar** → **Excluir conta**.

A listagem mantém pesquisa e paginação. A conta do proprietário mostra “Conta proprietária protegida” em vez de botão. Planos comerciais `artist_plus` e `studio` também exibem orientação para revisão.

## Confirmação e segurança

A exclusão só pode ser realizada pelo proprietário da central (permissão comprovada na origem dos dados, não por texto da UI). O modal mostra nome, e-mail e ID da conta, alerta sobre perda de portfólio/agenda/conversas, exige um checkbox e a frase exata `EXCLUIR <e-mail>` (ou `EXCLUIR <UUID>` se o e-mail for nulo).

A ação `DELETE /api/admin/accounts/[id]`:
- roda **apenas no servidor Node**, com proteção de Origin/same-origin;
- exige JWT autenticado, consultado por `auth.getUser(token)`;
- confirma `stage_owner_admin_status` usando **o token do usuário** antes e imediatamente antes da operação;
- rejeita apagar a própria conta ou qualquer conta na tabela `stage_owner_admins`;
- bloqueia assinaturas que possam ter cobrança ativa; cancelar uma conta **não cancela pagamentos ou cobranças externas**;
- verifica no servidor a frase exata vinculada ao e-mail real obtido de `auth.admin.getUserById`;
- limita a 5 solicitações por hora por proprietário, registra a tentativa ANTES da ação e grava resultado no histórico privado;
- executa `auth.admin.deleteUser(id, false)`. Não tenta apagar manualmente registros dependentes caso o Auth rejeite a remoção por Storage/foreign keys.

A tabela `stage_owner_admin_audit` já é privada (RLS + revogação de grants). A migração incremental `supabase/stage_owner_admin_account_deletion_migration.sql` amplia os tipos de auditoria, sem executar exclusões e sem conceder novos privilégios aos usuários.

## Condições de ativação (sem publicação automática)

1. Revisar o backup, consequências das cascatas e retenção necessária para finanças/obrigações legais.
2. Aplicar a migração incremental do histórico na produção, preferencialmente no mesmo momento da publicação coordenada. Não aplicar isoladamente por antecipação.
3. Configurar no ambiente **Production** da Vercel `SUPABASE_SERVICE_ROLE_KEY` como variável secreta **server-only** (nunca `NEXT_PUBLIC_`). O ambiente atual não tinha essa variável na última verificação. Sem ela, a API responde `admin_not_configured` e nenhuma conta pode ser excluída.
4. Publicar a `main` somente após autorização explícita do proprietário, mantendo deploy automático desativado.
5. Testar a rota com conta não proprietária (403), própria conta do proprietário (403), confirmação incorreta (400), conta com assinatura ativa (409), e conta de teste sem dados dependentes (200), verificando o histórico e a exclusão no Supabase Auth.

**Observações:** a exclusão em Auth é permanente; a cascata do banco pode remover eventos, mensagens, perfis e convites de outros contextos. Supabase pode rejeitar a exclusão de usuários com objetos em Storage ou referências protegidas; nesse caso a operação não faz limpeza parcial. JWTs emitidos antes da remoção permanecem válidos até expirarem, por isso ações privadas devem sempre validar a existência da identidade no servidor.

## Próximo trabalho de UX mobile

A implementação das respostas rápidas no chat e a redução de passos do fluxo de contratação virão depois da liberação controlada dessa ferramenta administrativa.
