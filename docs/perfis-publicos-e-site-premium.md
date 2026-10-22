# Stage Flow — perfis públicos e site profissional

Decisão de produto (15/10/2026).

## Músico de apoio — portfólio simples e gratuito

- Endereço: \`stageflow.com/musico/joaooliveira\`
- Instrumentos, estilos, biografia, fotos e links de trabalhos.
- Pode escolher **"Sob consulta"** ou **"A partir de R$ X"**.
- Negociações dos shows são sempre privadas para músico e contratante.
- Publicação opcional pelo músico; não possui subdomínio.
- Pode participar do futuro marketplace.

## Cantor ou artista — perfil gratuito com @

- Endereço comum: \`stageflow.com/cantorsousa\`
- Nome de usuário único \`@cantorsousa\`.
- Biografia, cidade, redes sociais e próximos shows marcados como públicos.
- Disponível com a conta gratuita, sem exigir assinatura.
- O proprietário decide quando publicar.
- O endereço não é removido porque o usuário deixou de pagar o extra.
- Rota antiga \`/artista/cantorsousa\` redireciona para \`/cantorsousa\`.
- No projeto provisório, a URL equivalente é \`stage-flow-lemon.vercel.app/cantorsousa\`. O domínio \`stageflow.com\` é exemplo da futura configuração oficial.

## Cantor — site profissional (ADICIONAL PAGO FUTURO)

- Subdomínio \`cantorsousa.stageflow.com\` (ou outra oferta de domínio a definir).
- Interface completa inspirada no design de referência entregue pelo fundador:
  capa com foto grande, destaques, agenda/calendário, galeria, vídeos,
  portfólio, redes sociais e ações de contratação.
- Tema, cores e layout mais avançados.
- Exige provisionamento do subdomínio, DNS wildcard/SSL e verificação
  server-side de titularidade e habilitação da compra.
- O campo protegido \`profiles.custom_subdomain_enabled\` já está reservado
  para autorização no banco de dados, mas **a cobrança, o provisionamento
  e o acesso ao site premium não estão implementados**.
- **Nunca** liberar apenas porque o usuário escolheu um subdomínio no cliente
  ou alterou metadados do navegador.
- Cancelamento do adicional não apaga o conteúdo do perfil gratuito;
  site comum e @ continuam disponíveis.

## Separação entre os produtos

- Um usuário pode ser cantor e também músico de apoio, mantendo a mesma conta.
- \`/musico/[slug]\` continua reservado ao portfólio simples.
- \`/[username]\` é a rota gratuita dos cantores/artistas.
- Páginas avançadas premium precisam de regras explícitas no servidor
  para não vazarem simplesmente por outra rota.
- As buscas futuras e a presença no marketplace terão regras e monetização próprias.


## Prévia privada do site premium (implementada)

- Rota autenticada: /meu-perfil-artistico/site-profissional
- Somente contas com função de artista e sessão válida podem visualizar o conceito; a RPC stage_my_artist_page retorna dados da própria conta.
- Visual inspirado na referência aprovada: hero com foto, capa, biografia, botões de contato, portfólio, redes, calendário navegável e lista de shows.
- Mostra somente apresentações do próprio artista que estejam simultaneamente published e show_publicly = true. Os números exibidos são contagens reais, não métricas inventadas.
- Imagens já cadastradas no perfil gratuito são reutilizadas apenas para ilustrar a aparência futura.
- Sem SQL novo: lê as estruturas da página gratuita e eventos já existentes.
- Nenhum subdomínio é criado e nenhuma cobrança, assinatura ou site premium público é ativado.
- Galeria detalhada e formulário de contratação aparecem como conceitos/estado em preparação; não são funcionalidade disponível.
- Perfil gratuito /[username] permanece independente de contratação.
- A prévia está aninhada sob a rota estática já reservada meu-perfil-artistico, evitando colisões com @ artísticos.


## Editor visual de rascunho premium (outubro de 2026)

- Rota privada de edição: /meu-perfil-artistico/site-profissional.
- Três temas: Midnight, Concert e Ivory.
- Cinco cores: violeta, verde, ciano, dourado e coral, independentes da página gratuita.
- Organize e oculte Sobre, Portfólio, Agenda e Contato; exige pelo menos uma seção visível.
- A prévia atualiza imediatamente, incluindo navegação e botões para seções visíveis.
- Rascunho privado por conta: stage_my_premium_site_draft e stage_save_premium_site_draft.
- Migração: supabase/premium_site_draft_editor_migration.sql; executar depois das migrações de perfis.
- Tabela stage_premium_site_drafts tem RLS sem policies públicas; uso somente por RPCs autenticadas que conferem auth.uid().
- A página pública gratuita não lê dados deste rascunho premium.
- Salvar NÃO altera assinatura, direito a subdomínio nem publica qualquer site pago.
- Cobrança, DNS e publicação do formulário avançado dentro de um subdomínio pago continuam não implementados. O formulário básico de contato já pode funcionar na página gratuita do artista, com opt-in explícito.

## Checklist de teste
1. Execute premium_site_draft_editor_migration.sql no Supabase.
2. Entre como cantor, abra a prévia, escolha Concert e dourado.
3. Oculte Contato e mova Agenda para cima. Confira navegação e ordem.
4. Salve o rascunho, atualize a página e confira as preferências.
5. Verifique que a página pública /cantorsousa não usa o tema premium.
6. Confirme que não ocorreu compra, nem publicação de subdomínio.

## Galeria de fotos e vídeos no rascunho profissional (outubro de 2026)

- Editor integrado à rota /meu-perfil-artistico/site-profissional, antes da prévia.
- Enviar fotos JPG, PNG e WEBP até 5 MB cada; adicionar vídeos por links HTTPS válidos do YouTube (watch, shorts, live, youtu.be).
- Até 20 trabalhos por artista, com título de 1 a 90 caracteres.
- Ordenar trabalhos, editar títulos, selecionar um único destaque e remover trabalhos; destaque ocupa cartão maior na prévia.
- A seção Portfólio & vídeos da prévia é atualizada após cada operação com o material cadastrado, mantendo os cartões ilustrativos quando vazia.
- Banco: tabela privada stage_premium_site_media, RLS sem acesso direto ao cliente, RPCs do proprietário via auth.uid() para ler, adicionar, renomear, destacar, reordenar e remover.
- Arquivos no bucket PRIVADO stage-premium-drafts, sem liberação pública; só o proprietário autenticado consegue criar URLs assinadas de curta duração.
- Ao remover um registro de foto, o cliente tenta remover também o arquivo do bucket. Em caso de falha nessa limpeza, avisa o usuário.
- Apenas miniaturas do YouTube e vídeos externos são públicos no próprio YouTube; o vídeo abre no serviço, não há upload de vídeo para o Supabase.
- Nenhuma mídia de rascunho é incluída nas RPCs públicas do perfil gratuito /[username]. Não ativa assinatura, subdomínio nem site premium.
- SQL novo: supabase/premium_site_media_gallery_migration.sql, depois de multi_role_accounts_migration.sql e premium_site_draft_editor_migration.sql.

### Teste manual da galeria
1. Execute premium_site_media_gallery_migration.sql no SQL Editor do Supabase.
2. No editor profissional, envie uma foto de apresentação menor que 5 MB.
3. Cole o link de um vídeo do YouTube e atribua título.
4. Escolha o vídeo como destaque e troque sua posição com a foto.
5. Confirme as alterações na prévia, atualize a página e confira a persistência.
6. Renomeie e remova o vídeo; depois remova a foto, confirmando a exclusão.
7. Verifique que a galeria continua ausente do perfil comum /cantorsousa.
8. Sem estar logado como dono, confira que não é possível consultar registros ou abrir arquivos privados do bucket.

## Pedidos de contratação pelo perfil gratuito (outubro de 2026)

- A página pública /[username] só exibe o formulário e o botão Solicitar show quando is_public=true E accept_booking_requests=true.
- O cantor liga/desliga em /meu-perfil-artistico. Desligado por padrão, sem ativação automática com a publicação do perfil.
- O solicitante informa nome, e-mail, WhatsApp opcional, cidade, data opcional e detalhes do evento e autoriza expressamente o compartilhamento dos dados com o artista para retorno.
- Mensagens e dados de contato são privados, não entram no perfil gratuito nem na prévia premium.
- RPC pública stage_submit_artist_booking grava dados somente para artistas publicados e opt-in; valida tamanhos, data, e-mail e telefone, usa honeypot e limites persistentes de 60 pedidos/artista/dia e 2 por e-mail/artista/dia.
- A caixa privada /meu-perfil-artistico/solicitacoes permite ler até 100 pedidos recentes, filtrar, marcar como Em contato, arquivar, restaurar e excluir definitivamente pedidos arquivados.
- Respostas por e-mail/WhatsApp são atalhos manuais; nenhum envio automático, notificação ou confirmação de disponibilidade ou reserva.
- Banco stage_artist_booking_requests tem RLS ativado e acesso direto negado. Só RPCs com auth.uid() do dono leem/atualizam/excluem pedidos.
- Migração necessária: supabase/artist_booking_requests_migration.sql, após free_artist_pages_migration.sql (e demais migrações de perfil já exigidas).
- A prévia premium tem link para testar o formulário no perfil gratuito e para abrir a caixa de solicitações. A contratação premium e o subdomínio seguem indisponíveis.
- Antes de disponibilizar amplamente, adicionar CAPTCHA gerenciado, políticas de retenção de dados e avisos de privacidade/termos definitivos. O honeypot e os limites SQL são proteção inicial, não antibot completo.

### Teste manual
1. Executar artist_booking_requests_migration.sql no Supabase SQL Editor.
2. Entrar no editor do cantor, ativar Receber pedidos de contratação e manter o perfil gratuito publicado.
3. Abrir /cantorsousa em sessão anônima, preencher formulário com contatos de teste e aceitar o compartilhamento.
4. Voltar à caixa privada, confirmar o recebimento e testar Em contato/Arquivar/Excluir dados.
5. Confirmar que o público não pode ler dados de contatos ou consultar a caixa do artista.
6. Desativar a opção no editor e atualizar /cantorsousa: formulário e botão Solicitar show devem desaparecer.
7. Confirmar que nenhum plano foi ativado, nenhuma cobrança ocorreu e nenhum subdomínio foi publicado.

## Portfólio gratuito do músico v3 — visual e conteúdo profissional (outubro de 2026)

A versão gratuita em `/musico/[slug]` foi ampliada e redesenhada sem alterar o Premium do cantor.

- Visual responsivo mais trabalhado: capa, foto, nome e especialidade, cidade, tempo de carreira, navegação pelas seções, instrumentos em cartões, currículo em destaques e links sociais.
- Editor em `/meu-portfolio` mantém **3 temas** (Midnight, Ivory e Stage), **5 cores de destaque**, **2 layouts**, capa, avatar, biografia, estilos, instrumentos e cachê público “sob consulta” ou “a partir de R$ X”.
- Novidades opcionais: **0–60 anos de experiência** (0 = início de carreira), **até 5 formatos de apresentação**, **até 4 experiências/projetos**, disponibilidade/região em **140 caracteres**, **até 2 links extras** além do vídeo principal e links de Instagram, YouTube e Spotify.
- Vídeos do YouTube recebem miniaturas clicáveis automaticamente. Outros links HTTPS de trabalhos abrem em nova aba. Nenhum vídeo precisa ser enviado ao Supabase.
- O editor mostra um indicador de **6 informações essenciais preenchidas** e uma prévia que muda conforme o usuário digita.
- Portfólios antigos permanecem compatíveis e continuam publicados com suas mesmas URLs, temas, fotos e valores após a migração. Campos novos começam vazios e seus blocos só aparecem quando preenchidos.
- Dados só aparecem na página pública se `is_published = true`; nada dos convites, números de WhatsApp, e-mails privados, acordos de cachê ou negociações individuais é incluído. Links sociais e vídeos informados serão **públicos** após a publicação.
- Continuam exclusivos do produto Premium do cantor: galeria privada com upload e destaques avançados, calendário profissional, organização livre das seções, ferramentas de conversão/contratação premium e subdomínio próprio. O músico não recebe essas ferramentas.
- O recurso **não cria contatos, convites ou propostas automáticas**. A página do músico mantém apenas links de divulgação externos e compartilhamento.

### Ativação no Supabase

Execute `supabase/musician_portfolio_complete_migration.sql` no Supabase SQL Editor **depois de** `musician_portfolios_migration.sql` e `musician_portfolio_appearance_migration.sql`. Esse arquivo é aditivo e introduz a RPC `stage_save_musician_portfolio_v3`; as RPCs v1/v2 continuam para compatibilidade.

### Testes sugeridos

1. Abra o editor gratuito e confirme que os dados antigos continuam preenchidos, inclusive foto, capa, temas e publicação.
2. Preencha experiência, formatos, destaques, links sociais e dois links extras de vídeo. Confira a prévia ao digitar.
3. Salve e atualize a página: os novos campos devem permanecer preenchidos.
4. Abra `/musico/<seu-slug>` em uma janela anônima e confira que o portfólio publicado apresenta os novos blocos corretamente, sem expor contato privado.
5. Teste no celular. Confira os três temas, as cores, o layout Minimalista, os cartões e os vídeos.
6. Desmarque Publicar, salve e confirme que o endereço público deixa de mostrar o portfólio.
7. Confirme que não foi criado site Premium, assinatura nem subdomínio.


## Atualização — publicação pública do site Pro de cantor (21/10/2026)

**Substitui as observações históricas acima de que o site profissional existe somente como prévia:** agora a funcionalidade de publicação pública foi implementada, com direito Pro validado no servidor, publicação manual, snapshot de tema/ordem/seções/galeria e retirada do ar.

- **Endereço público disponível:** \`/pro/[username]\` na Vercel, por exemplo \`https://stage-flow-lemon.vercel.app/pro/cantorsousa\`.
- O artista continua com perfil gratuito \`/[username]\`; este perfil exibe o atalho Pro somente quando o site Pro está de fato publicado e autorizado.
- O editor privado continua em \`/meu-perfil-artistico/site-profissional\`, agora com controles de Publicar, Republicar, Copiar link e Retirar do ar.
- A migração \`supabase/pro_artist_publication_migration.sql\` **não libera automaticamente nenhum cantor** e não cobra nenhum pagamento. Direito Pro é verificado pela tabela administrativa de concessões ou por plano protegido e assinatura ativa; publicação depende de um clique explícito do dono.
- A galeria privada de fotos recebe autorização de leitura seletiva somente para os arquivos incluídos no snapshot publicado e com a seção de portfólio habilitada. Não converte o bucket de rascunhos em público.
- A agenda contém somente eventos públicos publicados e futuros. O formulário de pedidos de show só aparece quando o opt-in do cantor estiver habilitado no perfil gratuito.
- **Subdomínio próprio ainda não é publicado:** \`cantorsousa.stageflow.com\` continua uma oferta futura dependente de DNS, SSL e roteamento seguro. Não há checkout/renovação automáticos nesta implementação.
- O marketplace não foi lançado e segue em **Em breve**.

Ver [docs/publicacao-site-pro-cantor.md](./publicacao-site-pro-cantor.md) para instalação, regras, liberação administrativa e checklist de testes.
