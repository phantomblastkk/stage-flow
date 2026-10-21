# Pedidos de contratação → rascunhos privados de shows

## Como funciona

O cantor recebe uma solicitação pelo perfil gratuito, abre /meu-perfil-artistico/solicitacoes e escolhe **Criar show a partir do pedido**. O editor aproveita cidade e, quando disponível, a data proposta. O cantor deve conferir o nome do show, escolher um horário e pode informar local e observações.

O backend cria um evento de propriedade do cantor em `public.events`, com `status = draft`, `show_publicly = false`, `ends_at = null` e sem enviar convites. Nada é publicado nem confirma uma contratação.

**Privacidade:** nome, e-mail, telefone e mensagem recebidos pelo formulário ficam somente em `stage_artist_booking_requests`. Não são copiados para o evento, porque sua descrição poderá se tornar pública no futuro se o dono optar por publicar.

O vínculo `stage_artist_booking_requests.event_id` evita shows duplicados. Se o usuário voltar ao mesmo pedido e o show ainda estiver em draft, o botão muda para **Editar rascunho**. Se o show foi publicado/cancelado/concluído, esta rotina não o edita. O botão **Ver na agenda** aponta para `/eventos?evento=<uuid>` e realça o evento.

Se o show for excluído, a referência em `event_id` passa a ser NULL, permitindo criar outro apenas com nova ação manual. Se o pedido for apagado, o evento permanece, mas os dados privados do contato são eliminados do pedido.

## Migração obrigatória

Execute **`supabase/booking_to_event_draft_migration.sql`** no Supabase SQL Editor, **depois de** `artist_booking_requests_migration.sql` e das migrações básicas de eventos/perfis. Não execute `schema.sql` novamente.

Essa migração:
- Adiciona `event_id` à tabela privada de solicitações e cria um índice único para evitar vínculos duplicados.
- Atualiza a RPC privada `stage_my_artist_bookings` para devolver os campos do show vinculado.
- Cria a RPC autenticada `stage_save_event_from_booking` para criar/editar eventos privados exclusivamente de pedidos pertencentes ao artista.
- Usa bloqueio de linha na solicitação para impedir duplicações por cliques simultâneos.
- Não expõe qualquer dado novo na página pública nem altera planos, cobranças, assinaturas ou subdomínios.

## Teste manual completo

1. Com o SQL executado, entre como cantor e abra `/meu-perfil-artistico/solicitacoes`.
2. Use um pedido existente, clique **Criar show a partir do pedido**; confira a cidade e a data sugerida. Se não houver data, informe uma. Informe um **horário futuro** e salve.
3. Confira a mensagem de sucesso e o selo **Rascunho na agenda**; use **Ver na agenda** e confira o show realçado e identificado como **Privado**.
4. Volte ao pedido, escolha **Editar rascunho**, altere horário/local/nome e salve. Recarregue a página: deve continuar existindo **um único show** vinculado.
5. Confirme no perfil público que o rascunho não apareceu. Abra o evento e confira que os contatos do solicitante não foram copiados para sua descrição.
6. Arquive o pedido e confirme que o evento continua intacto.
7. Se desejar testar exclusão, apague o pedido arquivado; o show permanece na agenda sem dados de contato.
8. Teste acesso com outro artista logado: nenhum pedido ou evento de outra conta pode ser transformado por essas RPCs.

## Limites desta etapa

Os dados do contratante permanecem vinculados apenas pelo pedido privado e não são sincronizados com contatos ou negociações. Este recurso não envia propostas automáticas, não adiciona músicos e não publica rascunhos. As demais ferramentas de eventos e convites continuam separadas.
## Integração com equipes e convites de músicos

A partir de um pedido que já virou show, a caixa privada de solicitações oferece **Organizar músicos**. O botão abre a agenda em `/eventos?evento=<id>&equipe=1`, destaca o show e expande o painel **Equipe e convites** daquele evento.

O painel reaproveita as funcionalidades e RPCs de equipes existentes. Não cria novas tabelas, valores nem convites automaticamente:

- Carrega formações privadas do próprio usuário usando `stage_my_teams` e seus integrantes via `stage_team_members_for_owner`.
- Permite selecionar uma equipe salva, revisar os músicos e preencher uma mensagem de até 500 caracteres.
- Somente após clicar **Convidar esta equipe** e confirmar a operação envia a RPC `stage_invite_team_to_event`. Cada músico recebe um convite individual; convites existentes não são duplicados.
- O evento pode continuar como **draft** e com `show_publicly=false`; convidar a equipe não publica o evento nem confirma o pedido de contratação.
- O painel consulta o andamento dos convites pela RPC já existente `stage_sent_invitations_with_whatsapp` e oferece links para `?evento=<id>` em **Equipes** e **Convites**.
- Em `/equipes?evento=<id>`, o seletor mostra o evento do dono previamente escolhido. Em `/convites?evento=<id>`, tanto o formulário de convite avulso quanto o filtro de respostas e negociação de cachê priorizam esse show.
- Nenhum cachê é compartilhado entre músicos. A área de convites continua sendo a fonte da negociação individual.
- Shows cancelados ou concluídos não permitem novos envios pelo painel da agenda.

### Pré-requisitos e teste

Não há SQL novo **nesta etapa**. As funções de `fixed_teams_migration.sql`, `whatsapp_reminders_migration.sql`, `private_fee_negotiations_migration.sql` e as migrações de convites precisam ter sido aplicadas anteriormente.

1. Acesse o Stage Flow como cantor com um pedido de contratação já vinculado a um show em rascunho.
2. Na caixa privada `/meu-perfil-artistico/solicitacoes`, clique **Organizar músicos**.
3. Confirme que a agenda abriu o evento correto e o painel **Equipe e convites** expandido.
4. Escolha uma equipe previamente salva. Confira que os integrantes listados correspondem à formação.
5. Clique **Convidar esta equipe**, confirme a janela e confira quantos convites novos foram registrados.
6. Repita o envio para verificar que integrantes já convidados não recebem solicitações duplicadas.
7. Acesse **Ver convites deste show e negociar cachês privados** e confira o evento pré-selecionado, respostas e negociações.
8. Teste como músico convidado e verifique que aceitar um convite permanece uma decisão própria, com proposta de cachê privada.
9. Confirme que o evento em rascunho permanece fora da agenda pública e que nenhum pedido de contratação é automaticamente confirmado.
