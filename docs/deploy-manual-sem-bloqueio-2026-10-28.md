# Stage Flow — publicação manual sem bloqueio de builds

## Diagnóstico
O antigo comando do Vercel **Ignored Build Step** era `echo 'Production deploys require explicit approval'; exit 0`. O `exit 0` fazia o Vercel cancelar qualquer build, inclusive o iniciado manualmente por API ou pela opção Redeploy.

## Configuração corrigida
- **`vercel.json`** mantém `git.deploymentEnabled=false` em todas as branches: push, PR e merge não disparam deploys automáticos.
- **Vercel Project → Settings → Build and Deployment → Ignored Build Step** deve usar `Automatic` (sem script de bloqueio). Isso permite builds iniciados manualmente via dashboard, Vercel CLI ou API.
- A equipe não deve habilitar deploy automático nas configurações da Vercel, nem adicioná-lo a workflows.
- Só publicar quando houver solicitação explícita, conferir SHA, projeto, ambiente e CI antes da ação manual.

## Verificação
1. Alterar o código e enviar à main: **não** deve iniciar deploy automático.
2. Criar deploy manual de um SHA aprovado ou usar Redeploy: o build deve continuar normalmente sem a mensagem de cancelamento `Ignored Build Step command returned exit code 0`.
3. Confirmar destino, estado READY e domínio, sem interferência no banco ou credenciais.
