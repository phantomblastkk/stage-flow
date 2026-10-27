# StageFlow — instruções de manutenção

## Branch de trabalho
- Todas as correções e novas funcionalidades solicitadas pelo proprietário devem ser registradas **diretamente na branch `main`**.
- Não utilize `develop` como destino padrão, nem faça merge de outra branch sem solicitação.
- Antes de editar, confira o SHA atual da `main`; antes de entregar, confira o resultado do CI.

## Deploy
- **NUNCA habilite deploy automático**, nem na Vercel nem em workflows GitHub.
- Mantenha `vercel.json` com `git.deploymentEnabled.main=false` e `develop=false`.
- Mantenha o Ignored Build Step de produção bloqueando builds automáticos.
- Commits na `main` **não** autorizam deploy manual. Faça-o somente após pedido específico.
- Não reconfigure alias, domínio, SSO, credenciais, plano comercial ou faturamento para contornar uma falha.

## Banco de dados e segurança
- Não execute migrações de produção automaticamente em CI.
- Mudanças de schema ou dados de produção exigem autorização explícita e validação de identidade quando aplicável.
- Mantenha separação entre Supabase QA e oficial; não copie contas e segredos entre ambientes.
- A central `/admin/central` depende da migração `supabase/stage_owner_admin_hub_migration.sql` e da concessão restrita em `stage_owner_admins`.
- A identidade proprietária deve permanecer única; nunca use `email`, `username` ou claims editáveis no navegador como regra de autorização.
- Ações administrativas devem checar permissão no banco, usando RPCs validados e auditoria.

## Validação
- Workflows GitHub executam apenas testes, TypeScript, build e PostgreSQL temporário, sem publicar.
- Prefira alterações incrementais verificadas por testes e documente qualquer limitação.
