# Stage Flow | Marketplace de Músicos — implementação em pré-lançamento

## Estado obrigatório até aprovação do fundador

**NÃO LANÇADO.** A rota pública \`/marketplace\` apresenta somente a landing page **"Em breve"**, mesmo após o deploy da Vercel. O catálogo real fica separado em \`/marketplace/preview\`, protegido por sessão autenticada e allowlist mantida no banco. A consulta RPC \`stage_marketplace_search\` tem **uma segunda proteção independente** que só devolve músicos quando \`stage_marketplace_control.launched=true\` OU a conta está autorizada em \`stage_marketplace_preview_access\`.

\`stage_marketplace_control.launched\` começa como **false** e **não é alterado automaticamente**. Reexecutar a migração não substitui false/true, porque a inserção é \`ON CONFLICT DO NOTHING\`. Para que um marketplace seja publicado, são necessárias **duas decisões manuais futuras**: (1) substituir o teaser da rota \`/marketplace\` pelo componente de catálogo e (2) autorizar explicitamente \`launched=true\` no banco. **Não faça nenhum dos passos sem pedido explícito do proprietário do Stage Flow.**

A landing page pública é funcional e apresenta as próximas funcionalidades, mas não permite ver o catálogo, favoritos, contato, avaliações ou convites. O código de prévia não é acessível sem permissão de dados. O perfil gratuito do músico \`/musico/[slug]\` segue independente e público quando o próprio músico publica.

## Instalação do banco (sem lançamento)

Pré-requisitos: \`profiles\` com \`is_artist\`, \`events\`, \`invitations\`, \`musician_portfolios\` e as migrações do portfólio gratuito até \`musician_portfolio_complete_migration.sql\`, além das migrações de convites. Rode SOMENTE:

\`supabase/marketplace_private_launch_migration.sql\`

A migração cria:

- \`stage_marketplace_control\`: \`launched=false\` por padrão, sem SQL público que o altere.
- \`stage_marketplace_preview_access\`: allowlist do laboratório, adicionada/removida somente pelo administrador do Supabase.
- \`stage_marketplace_musician_settings\`: opt-in explícito, modo de disponibilidade e até 45 datas bloqueadas para cada músico.
- \`stage_marketplace_favorites\`: favoritos privados de cada usuário.
- \`stage_marketplace_reviews\`: avaliações vinculadas a shows concluídos, com \`unique(event_id,musician_id)\` e prova de convite aceito.
- RPCs de busca paginada, filtro, favoritos, avaliações, convites diretos e preferências; sem acesso direto às tabelas.

**Todas essas tabelas têm RLS ativo, e \`anon\`/\`authenticated\` não recebem autorização direta de leitura/escrita.** RPCs \`security definer\` validam \`auth.uid()\` e permissões explícitas.

## Como autorizar a PRÓPRIA conta para testar (sem lançar)

1. Confirme que o SQL acima foi executado com sucesso.
2. No Supabase → SQL Editor, execute com o e-mail da sua conta Stage Flow:

\`\`\`sql
insert into public.stage_marketplace_preview_access(profile_id)
select id from auth.users where lower(email) = lower('SEU_EMAIL_AQUI')
on conflict (profile_id) do nothing;
\`\`\`

3. Entre nessa mesma conta em \`https://stage-flow-lemon.vercel.app/marketplace/preview\`. A rota \`/marketplace\` continuará mostrando "Em breve".
4. Para remover o acesso do laboratório, rode:

\`\`\`sql
delete from public.stage_marketplace_preview_access
where profile_id in (
  select id from auth.users where lower(email) = lower('SEU_EMAIL_AQUI')
);
\`\`\`

**Não use** \`update stage_marketplace_control set launched=true\` durante os testes. Isso poderia liberar a API do catálogo antes de você decidir lançar. Um preview local não é uma publicação.

## Funcionalidades do catálogo e integrações

1. **Busca paginada (12 por página):** nome, instrumento/especialidade, cidade, gênero, cachê máximo divulgado ("a partir de R$"), data, disponibilidade declarada e favoritos. Ordenação por atualização, nome, tempo de experiência e avaliação.
2. **Cartões:** imagem de capa, avatar, especialidade, estilos, instrumentos, cidade, cachê público ou "sob consulta", avaliação verificada e status de disponibilidade. Abrem diretamente o portfólio gratuito \`/musico/[slug]\`.
3. **Opt-in do músico:** em \`/meu-portfolio\`, ele deve ter portfólio publicado e habilitar explicitamente "Quero participar do Marketplace". Não entra automaticamente no catálogo apenas por ter um perfil público.
4. **Disponibilidade privada:** modo "sob consulta", "recebendo propostas" ou "indisponível", mais datas individuais bloqueadas (até 45 datas no próximo ano). O público só recebe indicação de status e se a data pedida está bloqueada. Shows, locais, contratantes e cachês privados nunca entram no catálogo. O backend impede **convites diretos pelo marketplace** para data explicitamente bloqueada. A comparação usa inicialmente o fuso horário de São Paulo.
5. **Favoritos:** apenas logado e dentro do preview allowlist (ou após lançamento deliberado). Um usuário não vê favoritos de outros.
6. **Convite direto:** o organizador escolhe evento próprio existente com data futura, informa mensagem opcional e confirma. A RPC \`stage_marketplace_invite_musician\` exige dono do show, portfólio publicado, opt-in, disponibilidade e evita duplicar \`(event_id,musician_id)\`. O convite é individual; não publica o show, não envia WhatsApp/e-mail, não gera pagamentos e não aceita cachês.
7. **Avaliações verificadas:** somente organizador que era dono de show marcado como \`completed\`, com data já passada e convite **accepted** do músico correspondente, pode avaliar (1 a 5 estrelas, comentário opcional). Uma única avaliação por músico/show. O catálogo mostra média e número; somente com avaliações válidas. Outros usuários não podem inventar notas.
8. **Estados vazios e restrições:** sem músicos participantes, o catálogo exibe "Nenhum músico encontrado". Sem sessão/allowlist, a prévia exibe "Laboratório privado". Sem shows próprios, o convite solicita criação prévia de evento.

**Limitações atuais:** disponibilidade é declaratória, não uma agenda sincronizada. Ainda não há bloqueio cruzado de horários de compromissos fixos nem pagamento transacional. Moderação administrativa, denúncia, denúncia de avaliações e prevenção de spam em escala são pendências para antes do lançamento público.

## Teste de ponta a ponta no laboratório

1. Rodar migração, adicionar sua conta à allowlist e abrir \`/marketplace/preview\`; em outra janela anônima, verificar \`/marketplace\` com "Em breve" e \`/marketplace/preview\` com acesso negado.
2. No editor do músico, publicar seu portfólio, ativar participação no marketplace e selecionar "Recebendo propostas".
3. Voltar ao laboratório e testar filtros de cidade, instrumento, estilos, cachê, ordenação e paginação. Conferir que o músico opt-in apareceu. Desligar opt-in e conferir remoção do catálogo.
4. Salvar um favorito e marcar filtro "Somente meus favoritos". Testar com outra conta autorizada e verificar que não compartilha favoritos.
5. Bloquear uma data na preferência do músico. Buscar e testar essa data, confirmar indicação "indisponível". Tentar convite para show na data bloqueada: deve retornar \`date_unavailable\`.
6. Escolher um show futuro próprio e confirmar convite individual. Abrir \`/meus-convites\` na conta convidada; confirmar recebimento e resposta. Repetir convite no laboratório e confirmar que não duplicou.
7. Marcar um evento **realmente realizado** como concluído, manter convite aceito e testar a avaliação verificada por organizador. Testar que outra conta ou um evento não concluído não consegue avaliar.
8. Confirmar que nenhum portfólio não publicado/sem opt-in aparece e que contatos pessoais, cachês fechados, dados de shows privados e agenda indisponível completa não são expostos.
9. Confirmar que o lançamento continua bloqueado com:

\`\`\`sql
select launched from public.stage_marketplace_control where id=true;
-- Deve retornar false durante o pré-lançamento.
\`\`\`

## Lançamento público (SOMENTE quando o fundador mandar)

Checklist de segurança, moderação, anti-spam, revisão do produto, políticas de privacidade e testes em dispositivo móvel. Somente após aprovação explícita, planejar o uso do catálogo na rota pública, remover mensagens "Em breve" e ativar o lançamento no Supabase. O código atual **não faz nenhuma dessas ações automaticamente**.


## Vitrine "Músicos em destaque" — mais avaliados (outubro/2026)

No **catálogo de prévia** (rota \`/marketplace/preview\`), após o cabeçalho e antes dos filtros, existe agora uma faixa de **até seis músicos em destaque**. É uma vitrine **orgânica**, sem patrocinadores ou posições compradas. O ranking vem da função \`stage_marketplace_featured()\`, e não de itens hardcoded.

**Critério transparente de ordenação:**
1. Maior **quantidade de avaliações verificadas** recebidas.
2. Em caso de empate, melhor **nota média** (de 1 a 5).
3. Se continuar empatado, nome e ID para resultado estável.

Participam apenas músicos com portfólio **publicado**, opção **participar do marketplace** ligada, estado de disponibilidade diferente de "indisponível" e **ao menos uma avaliação verificada**. Avaliações aceitas vêm somente da tabela privada de avaliações já vinculada a shows concluídos com convite aceito. A função fornece somente campos já publicáveis do portfólio, nota e contagem; não divulga contato privado, cachês negociados ou detalhes de eventos.

**Layout:** até 3 cartões por vez no desktop, até 2 no tablet e 1 cartão completo com parte do próximo no celular (scroll horizontal por toque). Há setas no desktop e acesso com teclado ao carrossel. Cada cartão apresenta capa ou foto, avatar, nome, especialidade, cidade, instrumento, nota média, quantidade de avaliações e links "Ver portfólio" / "Convidar" (modal de convites já existente).

**Sem avaliações válidas:** nenhum ranking é inventado. A seção mostra um estado vazio informativo, sem músicos fictícios ou avaliações falsas.

### Ativação — sem publicar ao público

Depois de executar \`supabase/marketplace_private_launch_migration.sql\`, execute também:

\`supabase/marketplace_featured_musicians_migration.sql\`

Isso **não altera** \`stage_marketplace_control.launched\`, nem substitui o aviso "Em breve" da rota \`/marketplace\`.

Teste no laboratório \`/marketplace/preview\` com sua conta previamente autorizada. Com avaliações válidas, verifique a ordem por contagem, a nota e os links. Faça o teste no celular para confirmar o cartão seguinte aparecendo na lateral. Se ainda não houver avaliações, verifique a mensagem de estado vazio — ela é o comportamento esperado.

Confirme ainda que uma conta não autorizada não consegue consultar \`stage_marketplace_featured()\`; deve retornar \`{"status":"not_released","items":[]}\`. A página pública \`/marketplace\` deve continuar "Em breve".

**Evolução futura:** monetização/anúncios destacados poderá existir como produto distinto, mas não deve ser confundida com a classificação orgânica e não foi implementada nesta etapa.
