# Stage Flow — Casas de show: catálogo, programação, fotos e sugestões

## Arquitetura (branch develop, sem deploy)

### Painel do Stage Flow
- /admin/casas: cadastro e edição de locais, selo oficial/parceiro, logo/capa, endereço e links.
- /admin/casas/[id]/programacao: calendário próprio da casa, novo show, alteração, exclusão, status, flyer individual, galeria de fotos (até 36), caixa de sugestões recebidas, contadores de publicados/rascunhos/flyers e atalho para página pública.
- A conta administradora é autorizada somente por UUID na tabela privada stage_venue_admins. Todos os writes do painel usam RPC com checagem no banco.

### Página pública
- /casa/[slug]: identidade visual, **próximo show em destaque** (consultado em qualquer mês futuro), calendário mensal (meses anteriores e próximos), filtro por dia, cards de shows com data/status, catálogo de flyers daquele mês em proporção original, galeria de fotos com navegação em modal e link do Instagram/WhatsApp.
- Visitantes podem sugerir um artista ou grupo sem criar conta. Campo obrigatório: nome da atração. Nome do visitante e justificativa são opcionais. Sugestões são privadas; não há votos, rankings nem confirmação automática de contratação.
- Apenas eventos de **public.stage_venue_calendar_events** com status='published' aparecem na agenda pública, inclusive históricos de meses anteriores.
- Eventos de músicos em **public.events** não são importados nem exibidos nas páginas das casas. O catálogo das casas é independente da agenda pessoal do músico. O autocomplete da agenda de músico continua funcionando, mas não abastece o calendário público da casa.
- Flyer pertence a um registro de show da casa; imagens publicadas usam stage-venue-media, nunca o bucket privado de flyers de artistas.
- As fotos da casa são independentes de logo, capa e portfólios de músicos.

## Ordem obrigatória de implantação no Supabase (quando for publicar)
1. Confirmar que as migrações base foram aplicadas no projeto correto: venues_catalog_migration.sql, venues_catalog_contributions.sql, venues_deduplication_migration.sql.
2. Executar **supabase/venue_admin_migration.sql**. Esse arquivo cria o controle dos administradores e as páginas oficiais.
3. Executar **supabase/venue_calendar_gallery_suggestions_migration.sql**. Cria a agenda própria da casa e os RPCs stage_public_venue, stage_venue_public_month e stage_venue_public_highlights para usar somente a programação independente, em vez de eventos de músicos.
4. Em Supabase > Authentication > Users, localizar o UUID da conta principal. Ela deve possuir um registro em public.profiles.
5. Autorizar somente o administrador real, no SQL Editor (não salvar UUID no repositório):
   ```sql
   insert into public.stage_venue_admins(profile_id)
   values ('UUID-REAL-DA-CONTA')
   on conflict (profile_id) do nothing;
   ```
6. Acessar /admin/casas autenticado, configurar uma casa como oficial com slug, salvar e abrir a programação. Cadastrar um show, publicar e adicionar flyer.
7. Conferir /casa/slug, navegar para um mês anterior e voltar, enviar uma sugestão de teste, checar se ela chegou ao painel.

**ATENÇÃO:** a migração não foi aplicada automaticamente no Supabase e não houve novo deploy. Durante a fase de desenvolvimento, mantenha essas alterações somente em develop. Antes do futuro merge para main/deploy, executar as migrações e validar ambiente de teste.

## Privacidade e limitações
- As tabelas de agenda, fotos e sugestões possuem RLS e tabelas não são acessíveis diretamente por clientes; as funções SQL expõem somente os dados pertinentes.
- Campos privados de músicos, cachês, convites e quaisquer eventos de músicos não entram nas consultas das casas.
- Fotos/flyers são conteúdo público por URL após upload. Não subir arquivos pessoais ou internos da casa.
- A sugestão é enviada sem login e não aparece publicamente. Há validação de tamanho, honeypot, limite agregado de 100 sugestões/dia/casa e deduplicação curta. **Antes de divulgação em grande escala, adicionar proteção anti-spam mais forte (ex.: CAPTCHA/Turnstile e rate limit por origem num endpoint server-side)**.
- Remover foto, show ou flyer desassocia da interface mas não apaga o objeto antigo do Storage automaticamente; planejar limpeza segura de órfãos.
- Calendário público consulta até 250 shows por mês; painel retorna até 750 shows e 100 sugestões mais recentes por casa. Para volumes maiores, implementar paginação.
- Visibilidade de eventos da casa é definida pela administração. O cadastro em /locais por músico segue sendo apenas catálogo colaborativo.
- O estabelecimento de referência é **Deck Espeto Bar** (não Deck's Petobar). Um slug possível para cadastro é **deckespetobar**, resultando em /casa/deckespetobar. O subdomínio deckespetobar.stageflow.com ainda depende de domínio, wildcard DNS e Vercel. Nenhum estabelecimento foi cadastrado automaticamente.
- Votações continuam fora de escopo. O acesso delegado às casas parceiras foi implementado somente em código, sem migração aplicada e sem publicação.

## Etapa visual concluída na develop
- Novo conjunto reutilizável de componentes em components/venue-show-visuals.tsx + CSS.
- Destaque automático do próximo show real publicado, com navegação até o dia correspondente no calendário.
- Cards de agenda com dia, mês, horário e status histórico; flyers em proporção original (sem crop) no catálogo e na vitrine.
- Galeria pública navegável com botões anterior/próxima e fechamento por Escape.
- No painel, contadores de programação e miniaturas de flyer sem cortes.
- Nenhum show falso ou imagem ilustrativa cadastrada no banco.

## Gestores de casas parceiras (etapa seguinte, develop)
- **supabase/venue_partner_management_migration.sql** deve ser executada **depois** das duas migrações do módulo de casas, **quando formos publicar**.
- **/admin/casas**: administração geral pode cadastrar e revogar responsáveis por e-mail, apenas se a casa estiver ativa, oficial e marcada como parceira. O e-mail precisa pertencer a uma conta Stage Flow já cadastrada em \`auth.users\` e \`public.profiles\`.
- **/parceiros**: cada responsável autenticado vê **somente suas casas autorizadas**; o botão abre **/parceiros/[id]/programacao**.
- O calendário, flyers, galeria e sugestões usam um componente visual comum para admin e gerente, mas as autorizações são **validadas novamente dentro de cada RPC SQL**.
- Um gerente **não pode** alterar o cadastro da casa, marca, logo/capa, parceria, outros estabelecimentos, administradores globais ou o acesso de outros responsáveis.
- O upload no Storage permite ao gerente apenas \`/gallery/\` e \`/flyer/\` no prefixo da casa à qual pertence. Administradores globais mantêm permissão de logo/capa.
- Desmarcar uma casa como parceira, oficial ou ativa desabilita imediatamente o acesso do gerente mesmo que a linha de autorização ainda exista; revogar o e-mail remove a autorização.
- O painel principal **/painel** mostra o atalho "Minhas casas parceiras" somente quando há vínculo.
- Não existe um fluxo de e-mail convite nesta etapa: o administrador vincula uma **conta já cadastrada** pelo e-mail.
- O projeto **Deck Espeto Bar** é referência nominal do catálogo Stage Flow; não reutilizar repositórios, serviços ou infraestrutura de outros projetos separados.

## Casos de teste de isolamento antes de publicação
1. Admin A autoriza o e-mail do gerente B para uma casa X marcada oficial/parceira.
2. Gerente B entra em /parceiros e vê somente X, não as demais casas.
3. B cria/edita/exclui show e upload de flyer/foto de X; acompanha sugestões recebidas de X.
4. B tenta mudar via requisição direta os dados de outra casa Y, baixar sugestões de Y, cadastrar um show em Y, usar arquivo de Y ou alterar logo/capa; tudo deve ser recusado pelo banco/Storage.
5. B tenta chamar \`stage_venue_admin_list\`, \`stage_venue_admin_save\`, \`stage_venue_admin_set_manager\`; todas devem negar acesso.
6. Admin revoga B ou retira a parceria de X; B perde acesso sem precisar de novo deployment.
7. Admin geral mantém acesso completo a X e Y após todos esses testes.

## Validação pendente
- Instalar as dependências e rodar npm run build e testes de interface num ambiente controlado antes de publicar.
- Confirmar as migrations SQL no banco de teste, especialmente a nova policy de Storage que autoriza os diretórios /flyer e /gallery.
- Testar em mobile: filtros por data, uploads (limite 5 MB), mensagens de erro, formulário público, modo de flyers e confirmação de que eventos pessoais não aparecem na casa.

## Atualização QA — sugestões enviadas por cantores (27/10/2026)

O fluxo atual substitui a inserção direta na tabela `venues` por `stage_venue_submit`: sugestões de usuários comuns ficam pendentes e privadas, acompanhadas por `stage_venue_my_submissions`. Apenas administradores globais podem decidir via `stage_venue_admin_review`.

**Aprovação agora cria automaticamente o perfil oficial com uma URL única.** O calendário, os flyers, o logo, a capa e a galeria estão disponíveis para edição pelos responsáveis autorizados; nenhum arquivo é enviado automaticamente. Rejeição mantém a sugestão oculta. O cantor pode acessar o link da casa aprovada em `/locais`, mas não recebe permissão de editá-la por ser o remetente da sugestão.

Migrações instaladas no Supabase QA: `venue_approval_workflow_migration.sql`, `venue_approval_official_profile_migration.sql` (com correção SQL) e `venue_approved_submitter_links_migration.sql`. Um teste transacional com `ROLLBACK` confirmou o caminho de envio, aprovação, URL e rejeição sem manter registros fictícios. A verificação visual com contas reais e upload de flyers continua pendente. O histórico acima descreve versões anteriores das funcionalidades.
