# Homologação — cantor, convites, shows e aprovação de casas

Atualização de 27/10/2026. Implantar e testar **somente** no ambiente QA.

## Isolamento
- Git: `develop`.
- Vercel: `stage-flow-homologacao` (`prj_5QIrtYibgORgIHuRIUIZ50Jawwgr`).
- Supabase QA: `zycuprhymoukhnuamtit`.
- Nenhuma alteração em produção, checkout/Asaas não ativados.

## Convites e briefing pelo celular
1. Conta A: cantor/organizador autenticado cria show futuro e convite por link.
2. Conta B: músico autenticado abre `/convite?codigo=...`, vincula o convite e abre `/meus-convites`.
3. Conta B: negocia cachê, se proposto; enquanto há acordo pendente, aceitar deve devolver `fee_pending`.
4. Conta B: ao aceitar o convite, o show aparece em `/meus-shows` entre os próximos; abrir `/eventos/operacao?evento=...`.
5. Conta A: informa chegada, passagem de som, portas, ponto de encontro, contato, transporte e equipamento.
6. Conta B: visualiza o cartão "Dia do show", atualiza, copia o resumo e consulta `/notificacoes`.
7. Conferir no celular: layout em uma coluna, rolagem, leitura dos horários; sem acesso a cachês da produção, tarefas internas ou anotações privadas.

**Validação técnica em QA:** as RPCs `stage_invite_preview`, `claim_stage_invite`, `stage_my_invitations`, `stage_sent_invitations`, `stage_show_ops_overview` estão instaladas. O controle `stage_respond_invite` mantém a restrição de cachê pendente. As migrações específicas de compatibilidade somente QA são:
- `supabase/qa_invite_read_compat_migration.sql` (leitura, sem sobrescrever o controle de cachê);
- `supabase/qa_shareable_invite_compat_migration.sql` (links de convite, sem recuperar concessões antigas de UPDATE direto).

O teste ponta a ponta com duas contas reais ainda requer duas contas verificadas na homologação. Não foram criados usuários fictícios.

## Sugestões de casas feitas por cantores
1. Abrir `/locais` com conta comum: escolher nome, cidade, endereço opcional e enviar.
2. A função `stage_venue_submit` grava a casa como `approval_status='pending'` e `active=false`.
3. Quem cadastrou vê o andamento apenas da própria sugestão. A solicitação vai para a lista administrativa de `/admin/casas`.
4. A casa **não** tem página em `/casa/[slug]`, URL, logo, capa, programação ou flyers enquanto pendente; o banco impõe essa regra.
5. Administrador global, cadastrado em `stage_venue_admins`, revisa a casa e clica em **Aprovar casa** ou **Rejeitar sugestão**.
6. **Aprovação:** cria **automaticamente** a página oficial da casa com URL única `/casa/<slug-gerado>`, habilita o catálogo, o calendário e a estrutura para adicionar flyers, fotos, logo e capa. A galeria e a programação iniciam vazias; somente o administrador (ou um gestor posteriormente autorizado) pode enviar e publicar esses conteúdos.
7. O cantor que sugeriu a casa vê seu status e, depois da aprovação, um link para a URL pública em **Minhas solicitações**. A função `stage_venue_my_submissions` só retorna slug de casa aprovada, ativa e oficial.
8. **Rejeição:** registro permanece para auditoria, oculto do catálogo e sem página.
9. Sem login, enviar sugestão deve retornar `login_required`; aprovar deve retornar `forbidden`.
10. Inspeção da tabela `venues`: não pode haver registro não aprovado com `active=true`, `is_official=true`, `is_partner=true`, slug ou logo/capa.

Migrações aplicadas no QA: `supabase/venue_approval_workflow_migration.sql` e `supabase/venue_approval_official_profile_migration.sql` (com correção do gerador SQL). As três casas legadas foram preservadas como aprovadas. Nenhuma casa fictícia ficou cadastrada após o teste.

**Teste de integração SQL realizado em QA com ROLLBACK integral:** uma conta autenticada sem privilégios de administrador enviou duas sugestões, recebeu status `pending`, não conseguiu aprovar nem inserir diretamente no catálogo e viu somente suas solicitações. Reatribuída a permissão administrativa dentro da mesma transação, uma sugestão foi aprovada, gerando URL oficial e respostas válidas de `stage_public_venue`, `stage_venue_public_month` e `stage_venue_public_highlights`; outra foi rejeitada e continuou sem perfil. Repetição da aprovação foi negada. A transação foi inteiramente revertida, sem alterações persistentes em casas ou administradores.

**Limite da validação:** foi um teste das permissões e das funções SQL simulando as duas identidades; não uma navegação real com duas contas, upload real de fotos/flyers ou inspeção visual mobile. Esses testes de interface permanecem pendentes.

## Observações
- Os dados de casas públicas e suas agendas continuam separados de shows e finanças pessoais dos músicos.
- O catálogo antigo poderia receber diretamente registros enviados por usuários autenticados. A migração revoga privilégios de inserção e exige RPC segura com limite de sugestões.
- Administradores do StageFlow podem criar um estabelecimento diretamente, pois o seu próprio cadastro é uma ação administrativa aprovada.
- Não considerar o teste de interface concluído apenas por CI/deploy ou simulação transacional bem-sucedidos. Login com duas contas, upload de imagens/flyers e navegação mobile ainda precisam de teste real no QA.

**Extensão de QA aplicada:** `supabase/venue_approved_submitter_links_migration.sql` mostra a URL oficial somente na lista de sugestões da própria conta, após aprovação.


## Verificação da programação e dos flyers (27/10/2026)

- No painel administrativo `/admin/casas/[id]/programacao`, o guia **Prepare a página da casa** agora mostra identidade visual, quantidade de shows públicos, flyers publicados e fotos cadastradas, com links para administrar cada item.
- Ao cadastrar **show novo com flyer** e selecionar **Publicado**, a UI salva primeiro o show como `draft`, tenta vincular o flyer e só então altera o status para `published`. Se o arquivo falhar, a apresentação permanece como rascunho. Shows sem flyer continuam podendo ser publicados, pois o flyer é opcional.
- No Supabase QA, uma transação com `ROLLBACK` validou a sequência `draft` (invisível), tentativa de edição por outra conta (negada), `published` (visível), flyer em caminho alheio (recusado), `cancelled` (invisível). Nenhuma apresentação fictícia permaneceu após o teste.
- Instalada no QA a migração `supabase/venue_pending_content_isolation_migration.sql`: a função `stage_venue_can_manage` só permite editar a programação de casas **aprovadas, ativas e oficiais**; `stage_venue_media_can_upload` também exige aprovação antes de qualquer upload de `logo`, `cover`, `gallery` ou `flyer`. A administração global ainda pode revisar uma sugestão e editar o cadastro básico antes da aprovação.
- Uma segunda transação de QA, revertida integralmente, confirmou que até o administrador global recebe bloqueio para programação/mídia de casas pendentes; após aprovar a mesma casa, as permissões de edição e mídia ficam disponíveis.
- **Pendente de teste visual:** login como administrador/gestor real, upload de uma imagem JPG/PNG/WebP de até 5 MB, confirmação da exibição no calendário e na galeria pública, navegação pelo celular. Sem contas reais e acesso HTTP autorizado ao deployment, CI e simulações SQL não comprovam upload de arquivos ponta a ponta.


## Divulgação do primeiro show e recuperação do flyer (27/10/2026)

- Em `/admin/casas/[id]/programacao`, shows já publicados oferecem **Ver show publicado** e **Copiar link**. O link usa `/casa/<slug>?mes=AAAA-MM&show=<uuid>` e aponta para o mês correto.
- Na página pública `/casa/[slug]`, abrir esse link seleciona o mês e abre os detalhes do show, **somente se a apresentação estiver na lista de eventos publicados retornada pelo RPC público**. Links para rascunhos, shows cancelados e IDs inválidos não expõem o conteúdo privado.
- O modal de apresentação pública também oferece **Copiar link deste show**.
- No formulário administrativo, um show novo **ou um rascunho previamente salvo** com flyer selecionado segue a ordem: gravar como rascunho, vincular a imagem e só então publicar. Isso permite repetir o upload de imagem se a primeira tentativa falhar, sem criar apresentação duplicada.
- Arquivos selecionados podem continuar visíveis no formulário após falha de upload; o usuário pode marcar a apresentação como `Publicado` e salvar novamente. A foto precisa existir no storage e passar pela validação de caminhos da casa para ser associada.
- A verificação automatizada testa a ordem de operações e os caminhos da interface. Um teste de upload de arquivo JPG/PNG/WebP com uma sessão humana autenticada no navegador continua necessário. Links diretos a shows não substituem permissão administrativa para alterar conteúdo.


## Flyer e compartilhamento no celular — atualização de 27/10/2026

- O formulário de programação mostra a **prévia local do flyer** JPG/PNG/WebP escolhido, o nome e o tamanho do arquivo antes de iniciar o upload (limite de 5 MB). Arquivos que o navegador não consegue abrir são retirados da seleção.
- A prévia usa uma URL temporária do navegador e executa `URL.revokeObjectURL` ao substituir/remover a imagem, evitando acumular arquivos em memória durante a navegação.
- A página pública e a administração oferecem **Compartilhar show** com `navigator.share` nos dispositivos compatíveis, incluindo a folha de compartilhamento do celular. Se o navegador não suportar essa API, o sistema tenta copiar o URL.
- **Copiar link** continua disponível separadamente. Cancelar o compartilhamento nativo não publica nada nem altera o show.
- Apenas eventos com status `published` podem receber um link específico em `?mes=AAAA-MM&show=<uuid>`; a visualização pública continua usando exclusivamente a RPC pública do calendário.
- O teste automatizado cobre o ciclo de vida da prévia, a validação de erro, o compartilhamento nativo e o fallback. O teste visual com upload real e conta administrativa autenticada continua pendente porque a conexão de acesso ao deployment QA retorna HTTP 403.
