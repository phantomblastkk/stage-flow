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
- Cobrança, DNS, galeria avançada e formulário de contratação continuam não implementados.

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