# Checklist de validação: gestores de casas parceiras (Stage Flow)

**Somente branch develop.** Nenhum teste abaixo depende de realizar deploy. O nome correto da casa de referência é **Deck Espeto Bar**.

## 1) Contratos estáticos (sem banco, sem credenciais)
Em uma cópia local do repositório, executar:
```bash
npm run test:venue-security
```
O comando executa `tests/venue-partner-security.test.mjs` com o test runner nativo do Node 22. Verifica se as funções SQL têm autorização por casa, a listagem só mostra vínculos do próprio usuário, só administradores globais concedem acessos e o upload de gestores fica restrito a flyers e galeria.

**Limite:** validação estática não comprova que o Supabase aplicou migrações, executou grants ou respeita políticas de Storage na prática.

Também há workflow opcional `.github/workflows/venue-security.yml` apenas para verificações. Não publica nem chama a Vercel. Confirmar que as GitHub Actions estão habilitadas no repositório.

## Fluxo guiado do gerente (branch `develop`)

Na homologação, abra `/admin/casas`, selecione uma casa **ativa, oficial e parceira** e vá a **Responsáveis pela casa**:

1. Informe o e-mail do gerente. Se a conta não existir, a tela fornece uma mensagem de cadastro para copiar ou compartilhar por WhatsApp. **Isso NÃO concede acesso antecipado.** Após cadastro e confirmação de e-mail, clique em **Conceder acesso** novamente.
2. Se a conta já existir, `stage_venue_admin_set_manager` salva o vínculo exclusivo daquela casa. O painel mostra o responsável, com opções **Copiar acesso** / **WhatsApp** para enviar o endereço do portal `/parceiros`.
3. Para revogar, clique **Revogar** e confirme a ação. A revogação atua no banco; um link de WhatsApp antigo não dá permissão.
4. Faça o gerente entrar na homologação em uma sessão separada (preferencialmente navegador anônimo). O portal `/parceiros` deverá listar apenas as casas concedidas. Em `/parceiros/<id>/programacao`, ele poderá editar agenda, flyers e galeria, mas não logos, capa ou vinculação de outros gerentes.
5. **Testar isolamento exige uma segunda conta Auth real de homologação.** Usar apenas a conta de administrador geral não comprova restrição por casa. Não criar usuários falsos por SQL no Auth real, nem copiar contas de produção.

O site oficial não precisa ser alterado; para visualizar essas mudanças na homologação, publicar a versão recente da branch `develop` em seu projeto Vercel de testes (deploy automático da branch continua desativado).

## 2) Banco de testes (NÃO usar produção)
Depois de criar um projeto de teste Supabase com o schema base:
1. Rodar, nesta ordem: `supabase/venue_admin_migration.sql`, `supabase/venue_calendar_gallery_suggestions_migration.sql` e `supabase/venue_partner_management_migration.sql`.
2. Criar duas casas **ativas + oficiais + parceiras**: X (ex.: Deck Espeto Bar) e Y (outra casa de teste). Não usar dados reais de shows.
3. Criar duas contas de teste com seus registros em `auth.users` e `public.profiles`. Escolher a conta A **sem** permissão de administrador global.
4. Como administrador global, no painel `/admin/casas`, conceder permissão da casa X ao e-mail da conta A. Não vincular A à casa Y.
5. Executar todo o arquivo `tests/sql/venue-partner-isolation.sql` de uma vez, no SQL Editor do **projeto de teste**.
6. Esperado: mensagem `PASSOU` e final `ROLLBACK`. O SQL cria dados temporários e reverte tudo ao final. Se o script falhar, interromper a validação, investigar e executar `ROLLBACK;` antes de sair.

**O script SQL cobre:** isolamento entre X e Y; lista do portal; cadastro permitido de show em X; rejeição de inclusão/remoção em Y; rejeição de acesso à galeria de Y; rejeição de uploads fora da casa; proibição de logo/capa e de concessão de administradores; usuário sem vínculo.

## 3) Teste de RLS/Storage com sessões reais
A simulação SQL usa `request.jwt.claim.sub` dentro do SQL Editor. Ela **não** substitui a verificação com sessões Auth reais (role `authenticated`):
- Entrar com a conta A, tentar upload em `X/gallery` (esperado: permitido), em `X/logo` (negado) e em `Y/gallery` (negado).
- Testar requisições PostgREST diretas de A aos RPCs administrativos globais; todas devem retornar `forbidden` ou acesso negado.
- Tentar ler diretamente `public.stage_venue_managers`, `stage_venue_gallery` e `stage_venue_artist_suggestions`. Sem concessão de tabela, devem falhar.
- Desmarcar X como parceiro e verificar que o acesso A é imediatamente revogado, sem login/logout.
- Testar como administrador global: acesso a ambas as casas, concessão, revogação e restauração.

## Triagem de sugestões de artistas (somente homologação)
Aplicar `supabase/venue_suggestions_workflow_migration.sql` no banco de homologação após as migrações das casas (já aplicado no QA `zycuprhymoukhnuamtit`).

- Em `/admin/casas/<id>/programacao` ou `/parceiros/<id>/programacao`, abra **Sugestões**. O filtro inicia em **Pendentes**; também há **Em análise**, **Resolvidas** e **Todas**.
- Marque uma sugestão como Em análise ou Resolvida, e confira a data de atualização. É possível devolver para Pendente. Mensagem, artista e nome do visitante não são alterados.
- Somente gestor da própria casa ou administrador global pode alterar o status. A função `stage_venue_suggestion_set_status` verifica `stage_venue_can_manage` no banco. Anônimos não têm permissão de EXECUTE; nenhuma tabela recebe UPDATE direto do frontend.
- Validar com contas separadas que gestor da casa X não pode mudar status de sugestão da casa Y; uma conta administradora global não é suficiente para comprovar isolamento real.
- A função administrativa de listagem continua limitada às 100 mensagens mais recentes por casa. Filtros refletem esse conjunto, não o total histórico de todas as mensagens.
- Para testar sem deixar dados fictícios persistidos, usar transação SQL `BEGIN ... ROLLBACK` apenas no projeto QA.
- Como o deploy de `develop` está desativado automaticamente, publicar manualmente na Vercel de homologação. Não aplicar a migração no Supabase de produção.

## 4) Antes de publicar
- Executar `npm run build` e `npm run lint` no ambiente apropriado.
- Inspecionar manualmente a tela `/parceiros` e a página de edição em desktop e mobile.
- Nenhum script de teste deve rodar no banco de produção.
- O projeto **Deck Espeto Bar** do Stage Flow não deve reutilizar credenciais ou banco de qualquer sistema de reservas separado.
