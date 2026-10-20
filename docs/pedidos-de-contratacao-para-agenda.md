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