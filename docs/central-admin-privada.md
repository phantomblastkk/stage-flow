# StageFlow — central privada do proprietário

## Objetivo

Central reservada em `/admin/central` (link não listado na navegação pública). A rota tem metadados `noindex, nofollow, noarchive`, mas **não depende do endereço ser desconhecido para proteger informações**.

A aplicação autentica a sessão e consulta `stage_owner_admin_status` antes de solicitar qualquer dado. Todas as consultas e ações sensíveis exigem novamente a autorização no próprio PostgreSQL (Supabase). Nunca há chave `service_role` no frontend.

## Quem pode entrar

A migração `supabase/stage_owner_admin_hub_migration.sql` cria `public.stage_owner_admins`, com restrição **singleton**, permitindo no máximo uma identidade por ambiente. A tabela não concede leitura ou gravação para `anon` ou `authenticated`, nem possui política pública. **Nenhum proprietário é atribuído automaticamente na migração.** A atribuição exige uma operação privilegiada no SQL Editor do Supabase, depois de comprovar a identidade do usuário do Auth.

Exemplo de habilitação inicial **apenas no ambiente desejado**, usando o UUID de `auth.users` da sua própria conta, consultado no painel Supabase Auth:

```sql
-- Faça isto SOMENTE após confirmar o projeto Supabase e o seu UUID real.
insert into public.stage_owner_admins(profile_id)
values ('COLOQUE_SEU_UUID_VERIFICADO_AQUI'::uuid);
-- A central reutiliza o fluxo de aprovação de casas, portanto
-- este mesmo proprietário precisa da permissão de administrador de casas:
insert into public.stage_venue_admins(profile_id)
values ('COLOQUE_SEU_UUID_VERIFICADO_AQUI'::uuid)
on conflict(profile_id) do nothing;
```

Para transferir a posse, execute essa operação manualmente sob conta privilegiada, revogando a antiga autorização e concedendo-a à identidade correta. Não implemente fluxo de autoconcessão no navegador. Ative MFA na conta proprietária e cuide da recuperação da conta. Um JWT de proprietário comprometido ainda poderia operar dentro das permissões da sessão.

**Homologação QA (27/10/2026):** a migração foi validada no Supabase de testes `zycuprhymoukhnuamtit`, com a identidade administradora do próprio QA e testes transacionais revertidos.

**Produção oficial (27/10/2026):** após autorização do proprietário, a migração `stage_owner_admin_hub` foi aplicada no Supabase oficial `bmudkggwjybyjuhgefvw`. A autorização exclusiva foi vinculada à **única conta preexistente de administrador de casas com e-mail confirmado**; nenhum outro proprietário recebeu acesso. Os RPCs foram testados com identidade proprietária e conta não autorizada, inclusive sob o papel PostgreSQL `authenticated`, verificando listagens, ordenação, aprovação, selos, RLS e revogação. Os testes de escrita foram executados com `ROLLBACK`, sem alterar os perfis ou as casas reais. Nenhuma verificação foi concedida por padrão.

## Funcionalidades

- Visão geral: total de cadastros Auth, novos usuários em 7/30 dias, quantidade de cantores, músicos, híbridos, produtores, casas pendentes/aprovadas/rejeitadas e selos atribuídos.
- Usuários cadastrados: lista paginada de 30 por vez, pesquisa por nome, arroba ou e-mail e ordenação de **mais antigos primeiro** (padrão) ou mais novos primeiro. Exportação em CSV somente da página visível, indicada no botão, com proteção contra execução de fórmulas em planilhas.
- Casas e aprovações: fila de solicitações, filtros, aprovação e rejeição com confirmação. O controle usa a implementação já existente `stage_venue_admin_review`, que cria a casa oficial após aprovação. A central também liga à administração completa de casas, responsáveis e programação.
- Selos oficiais: perfis de **cantor** e **músico** recebem verificação independente mesmo quando são a mesma pessoa. Casas só podem receber selo após aprovação e publicação oficial. Os botões concedem ou retiram o selo sem alterar assinatura, plano ou permissões.
- Acesso Pro por cortesia: na aba Usuários, pesquisar qualquer conta de cantor e **conceder ou retirar a cortesia Pro**. O botão usa `stage_owner_admin_set_pro_access`, e o estado real vem de `stage_owner_admin_pro_snapshot`. A cortesia reutiliza `stage_pro_site_access`/`stage_pro_site_is_entitled` e libera os recursos Pro sem tocar em `plan_code`, assinatura ou cobrança. A publicação do perfil e das galerias continua sendo decisão do cantor.
- Proteção do plano pago: se houver assinatura Pro ativa, a central mostra **Pro por assinatura** e não oferece um botão para cancelá-la. Se houver cortesia e assinatura simultaneamente, retirar a cortesia não remove a assinatura. Revogação da cortesia desativa acesso Pro somente quando não há direito pago; o conteúdo rascunhado permanece armazenado e não é apagado.
- Histórico: log privado de concessão/revogação de selo, cortesia Pro e aprovação/rejeição de casas, com executor, tipo de entidade e data.

## Aparência pública

O selo azul usa `StageVerifiedBadge`, com texto acessível `Verificado pelo StageFlow`. É uma designação própria da plataforma, **não um selo emitido pelo Instagram**.

A função pública `stage_public_verified(kind,slug)` devolve exclusivamente um booleano para:
- cantor com `is_singer` + `is_public`;
- músico com `is_musician` + portfólio `is_published`;
- casa com `active`, `is_official` e `approval_status='approved'`.

Perfis não publicados e casas rejeitadas nunca recebem um `true` público, mesmo que um registro antigo de verificação exista. Os dados privados de `auth.users`, histórico e identidades de verificadores não são devolvidos a visitantes.

## Segurança e auditoria

Tabelas sensíveis têm RLS habilitado e nenhum `GRANT` de leitura/gravação pública. Funções privilegiadas usam `security definer`, `set search_path=''`, lista de campos e validação de `auth.uid()` em cada chamada privada. O menu oculto e `noindex` são conveniências, não controles de acesso.

Aprovações e selos exigem confirmação na interface e são sempre verificados no servidor. O histórico privado registra alterações efetivas. A exportação CSV contém e-mails; mantenha os arquivos exportados em local seguro.

## Testes e rollout

- Testes estáticos: `node --test tests/owner-admin-hub.test.mjs`.
- Workflow `Stage Flow • Integration and build` executa os testes, TypeScript e build sem fazer deploy.
- Testes de integração QA executados em transação com `ROLLBACK`, incluindo proprietário e intruso, ordenação, concessão/revogação, rejeição de acesso direto às tabelas e publicação de casa após aprovação.
- A migração e a concessão única ao proprietário já foram aplicadas em produção sob autorização expressa. Para próximas mudanças em banco ou contas, exigir autorização específica e verificar a identidade novamente.
- Desenvolvimento e testes automatizados passam a ocorrer diretamente na `main`. Os três workflows GitHub só executam testes/build/um banco PostgreSQL temporário, sem publicar.
- `vercel.json` mantém `git.deploymentEnabled.main=false` e `develop=false`; o projeto Vercel oficial continua com **Ignored Build Step** bloqueando deploy automático. Para publicar novos commits, é necessária autorização manual separada.
- A área privada é acessível em `/admin/central`. O painel `/painel` só exibe o atalho administrativo se o RPC de autorização retornar `true`; o login aceita exclusivamente `next=/admin/central` como retorno especial (sem redirecionamento aberto).

**Não divulgar UUID, e-mail, chaves, nem lista de usuários em logs públicos.**

## Migração de administração Pro

- Arquivo incremental: `supabase/stage_owner_admin_pro_access_migration.sql` (requer `stage_owner_admin_hub_migration.sql` e `pro_artist_publication_migration.sql`).
- Adiciona as operações `pro_access_granted` / `pro_access_revoked` ao histórico já protegido. Não concede Pro a ninguém durante a migração.
- `stage_owner_admin_pro_snapshot(uuid[])`: somente proprietário; valida no máximo 30 UUIDs por página; informa manual, pago e efetivo.
- `stage_owner_admin_set_pro_access(uuid,boolean)`: valida `auth.uid()` no PostgreSQL, verifica função de cantor, serializa acesso e grava auditoria apenas se houver mudança efetiva. Não altera plano ou cobrança.
- A página `/admin/central` nunca controla planos financeiros, apenas permissões promocionais separadas. A confirmação é obrigatória para conceder ou retirar.
- **Homologação (27/10/2026):** migração aplicada em `zycuprhymoukhnuamtit`; testes com `ROLLBACK` validaram proprietário versus intruso, concessão/revogação, idempotência, histórico e proteção de plano pago. Sem concessões persistidas. Tabelas continuam sem privilégios de escrita direta para `authenticated`.
- **Supabase oficial (27/10/2026):** a migração foi aplicada em `bmudkggwjybyjuhgefvw`; proprietário versus intruso, acesso efetivo, revogação e auditoria também foram testados com `ROLLBACK`. **Nenhuma cortesia Pro foi concedida durante a instalação.** A interface precisa ser publicada separadamente mediante deploy manual autorizado.
- Permanecem as diretrizes: commits **somente na `main`** e nenhum deploy automático; publicação do código somente mediante autorização manual.
