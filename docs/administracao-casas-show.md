# Stage Flow — administração de casas de show (fase 1)

## Objetivo
Aproveitar o catálogo colaborativo de estabelecimentos existente, sem duplicar casas, e permitir que somente a equipe do Stage Flow confirme páginas oficiais e casas parceiras.

## Nesta entrega (branch develop)
- Painel protegido em /admin/casas para listar locais cadastrados, pesquisar, editar e cadastrar novas casas.
- Dados: nome, cidade, endereço, descrição, WhatsApp, Instagram, slug, ativo, oficial e parceiro.
- Logotipo e capa (JPG/PNG/WebP de até 5 MB), carregados em bucket específico.
- Página pública em /casa/[slug] **somente** para locais ativos marcados como oficiais.
- Exibe agenda somente de eventos futuros com status published e show_publicly=true vinculados à casa pelo novo campo events.venue_id.
- Autocomplete da criação de eventos registra venue_id ao selecionar uma casa cadastrada; digitação livre continua suportada.
- Arquivos e mudanças aplicados somente na branch develop. Nenhum deploy necessário durante o desenvolvimento.

## Antes de usar no ambiente Supabase
**Não rodar automaticamente em produção sem revisar e planejar a implantação da migração.**
1. Confirmar que as migrações do catálogo foram aplicadas: venues_catalog_migration.sql, venues_catalog_contributions.sql e venues_deduplication_migration.sql.
2. Executar supabase/venue_admin_migration.sql no SQL Editor do projeto Supabase correto.
3. Obter o UUID da sua conta em Supabase > Authentication > Users. Deve haver um registro correspondente em public.profiles.
4. Autorizar **apenas** sua conta, executando no SQL Editor (substitua pelo UUID real; não colocar no GitHub):

   insert into public.stage_venue_admins (profile_id)
   values ('SEU-UUID-REAL')
   on conflict (profile_id) do nothing;

5. Acessar /admin/casas enquanto estiver autenticado.
6. Cadastrar uma casa ou selecionar uma já cadastrada, marcar "Perfil oficial", informar slug e salvar. Somente então a página /casa/slug passa a existir.
7. Para adicionar imagem, salvar a casa primeiro e usar os campos Logotipo ou Capa. A mídia pública não deve conter informações privadas.

**Atenção:** o código da branch develop usa a coluna events.venue_id e os RPCs desta migração. **Antes do merge/deploy em produção, rodar a migração e conferir as permissões** ou os eventos criados pela interface nova poderão falhar.

## Segurança e privacidade
- Permissão administrativa concedida explicitamente por UUID dentro de stage_venue_admins.
- A checagem é feita também no Postgres por RPCs security definer, não apenas escondendo botões na interface.
- Inserções colaborativas de locais só permitem as colunas nome/endereço/cidade/submitted_by; isso bloqueia criação arbitrária de parceiros oficiais.
- Não exibir dados privados de músicos: a listagem pública de shows inclui apenas ID, título e horário de eventos publicados e marcados como públicos.
- Fotos públicas ficam num bucket diferente de flyers privados. A política de acesso dos flyers dos artistas **não foi alterada**.
- Cadastro oficial de casa não dá à casa direito de editar eventos de terceiros.

## Limitações e próximos passos
- Shows antigos gravados apenas com o nome do local ainda não aparecem automaticamente na página oficial. Será necessário vinculá-los com revisão para evitar atribuições erradas.
- Biblioteca de fotos da casa, arquivo de flyers, enquetes semanais, sugestões de atrações e acesso de gerente parceiro ainda não estão implementados.
- Subdomínios como deckspetobar.stageflow.com dependem de domínio próprio, configuração de DNS wildcard, Vercel e regras de roteamento; a primeira versão usa /casa/[slug].
- Verificar visualmente os formulários e executar uma compilação/validação quando houver ambiente de teste. Não foi realizado deployment.
