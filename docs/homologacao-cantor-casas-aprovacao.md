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
7. **Rejeição:** registro permanece para auditoria, oculto do catálogo e sem página.
8. Sem login, enviar sugestão deve retornar `login_required`; aprovar deve retornar `forbidden`.
9. Inspeção da tabela `venues`: não pode haver registro não aprovado com `active=true`, `is_official=true`, `is_partner=true`, slug ou logo/capa.

Migrações aplicadas no QA: `supabase/venue_approval_workflow_migration.sql` e `supabase/venue_approval_official_profile_migration.sql` (com correção do gerador SQL). As três casas legadas foram preservadas como aprovadas. Nenhuma casa fictícia ficou cadastrada após o teste.

**Teste de integração SQL realizado em QA com ROLLBACK integral:** uma conta autenticada sem privilégios de administrador enviou duas sugestões, recebeu status `pending`, não conseguiu aprovar nem inserir diretamente no catálogo e viu somente suas solicitações. Reatribuída a permissão administrativa dentro da mesma transação, uma sugestão foi aprovada, gerando URL oficial e respostas válidas de `stage_public_venue`, `stage_venue_public_month` e `stage_venue_public_highlights`; outra foi rejeitada e continuou sem perfil. Repetição da aprovação foi negada. A transação foi inteiramente revertida, sem alterações persistentes em casas ou administradores.

**Limite da validação:** foi um teste das permissões e das funções SQL simulando as duas identidades; não uma navegação real com duas contas, upload real de fotos/flyers ou inspeção visual mobile. Esses testes de interface permanecem pendentes.

## Observações
- Os dados de casas públicas e suas agendas continuam separados de shows e finanças pessoais dos músicos.
- O catálogo antigo poderia receber diretamente registros enviados por usuários autenticados. A migração revoga privilégios de inserção e exige RPC segura com limite de sugestões.
- Administradores do StageFlow podem criar um estabelecimento diretamente, pois o seu próprio cadastro é uma ação administrativa aprovada.
- Não considerar o teste de interface concluído apenas por CI/deploy ou simulação transacional bem-sucedidos. Login com duas contas, upload de imagens/flyers e navegação mobile ainda precisam de teste real no QA.
