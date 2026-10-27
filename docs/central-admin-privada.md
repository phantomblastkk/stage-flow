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

**Homologação QA (27/10/2026):** a migração foi aplicada exclusivamente no Supabase `zycuprhymoukhnuamtit`. Foi possível habilitar o proprietário do QA porque o ambiente isolado já tinha exatamente um perfil e um administrador de casas pré-existente; a operação exigiu o marcador `ISOLATED_STAGE_FLOW_HOMOLOGATION_ONLY`. Isso **não identifica nem configura o proprietário em produção**.

## Funcionalidades

- Visão geral: total de cadastros Auth, novos usuários em 7/30 dias, quantidade de cantores, músicos, híbridos, produtores, casas pendentes/aprovadas/rejeitadas e selos atribuídos.
- Usuários cadastrados: lista paginada de 30 por vez, pesquisa por nome, arroba ou e-mail e ordenação de **mais antigos primeiro** (padrão) ou mais novos primeiro. Exportação em CSV somente da página visível, indicada no botão, com proteção contra execução de fórmulas em planilhas.
- Casas e aprovações: fila de solicitações, filtros, aprovação e rejeição com confirmação. O controle usa a implementação já existente `stage_venue_admin_review`, que cria a casa oficial após aprovação. A central também liga à administração completa de casas, responsáveis e programação.
- Selos oficiais: perfis de **cantor** e **músico** recebem verificação independente mesmo quando são a mesma pessoa. Casas só podem receber selo após aprovação e publicação oficial. Os botões concedem ou retiram o selo sem alterar assinatura, plano ou permissões.
- Histórico: log privado de concessão/revogação de selo e aprovação/rejeição de casas, com executor, tipo de entidade e data.

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
- Homologação pode ser atualizada separadamente. Não migrar, cadastrar o proprietário nem publicar a central em produção sem aprovação expressa e verificação da identidade real do proprietário.

**Não divulgar UUID, e-mail, chaves, nem lista de usuários em logs públicos.**
