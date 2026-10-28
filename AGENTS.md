# StageFlow — instruções de manutenção

## Branch de trabalho
- Todas as correções e novas funcionalidades solicitadas pelo proprietário devem ser registradas **diretamente na branch `main`**.
- Não utilize `develop` como destino padrão, nem faça merge de outra branch sem solicitação.
- Antes de editar, confira o SHA atual da `main`; antes de entregar, confira o resultado do CI.

## Deploy
- **NUNCA habilite deploy automático**, nem na Vercel nem em workflows GitHub.
- Mantenha `vercel.json` com `git.deploymentEnabled=false` para **todas** as branches. Sem deploy automático de GitHub.
- O Ignored Build Step da Vercel deve ficar em `Automatic` (sem comando que sempre retorne `exit 0`); ele não controla a autorização de publicação. A autorização é a operação manual de deploy, enquanto `git.deploymentEnabled=false` bloqueia todos os deploys automáticos. Nunca reative o Git auto deploy.
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
