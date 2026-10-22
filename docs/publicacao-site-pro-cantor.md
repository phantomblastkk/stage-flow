# Publicação do site Pro do cantor — Stage Flow

## Estado

**A funcionalidade de publicação pública está implementada** em Next.js, sem cobrança automática e sem liberar nenhum usuário por padrão. É necessário aplicar a migração SQL, autorizar explicitamente quem tem direito ao Pro e o cantor clicar em **Publicar site Pro** no editor.

**URL inicial real:** \`https://stage-flow-lemon.vercel.app/pro/SEU_USUARIO\`.

O endereço gratuito \`https://stage-flow-lemon.vercel.app/SEU_USUARIO\` permanece independente e gratuito. Quando o site Pro está ativo, o perfil gratuito exibe **Visitar site Pro**. A versão Pro não substitui automaticamente o perfil gratuito.

**IMPORTANTE:** Um subdomínio como \`cantorsousa.stageflow.com\` NÃO é provisionado nesta etapa. DNS wildcard, SSL e host routing confiável precisam de uma implementação e configuração próprias. Não prometa esse domínio até que tenha sido instalado e verificado.

O marketplace \`/marketplace\` continua mostrando **Em breve**: nenhuma flag de marketplace é alterada nesta publicação.

## Funcionalidades

- O cantor usa o editor privado \`/meu-perfil-artistico/site-profissional\` para configurar **Midnight, Concert e Ivory**, cinco cores de destaque, posição e visibilidade das seções Sobre, Portfólio, Agenda e Contato.
- O artista salva o design e gerencia fotos e vídeos na galeria privada já existente. A versão pública mostra somente a **última publicação explicitamente confirmada**, com o design e os títulos/ordem/destaques da galeria congelados em um snapshot.
- O artista pode **Publicar**, **Republicar alterações**, **Copiar endereço** e **Retirar do ar**, com confirmação para publicar ou retirar do ar. Alterar o rascunho não altera imediatamente o site publicado.
- A página pública Pro mostra capa e avatar do perfil gratuito, bio, cidade, slogan, redes sociais, galeria real de fotos e vídeos, agenda pública com calendário navegável, e contato.
- **Pedidos de contratação** aparecem apenas quando o cantor já habilitou \`accept_booking_requests\` na sua página gratuita. Usa o mesmo formulário público protegido por validações, consentimento e limites de frequência; as solicitações continuam na caixa privada \`/meu-perfil-artistico/solicitacoes\`. Não há aceitação automática, confirmação nem cobranças.
- A agenda mostra apenas eventos próprios com \`status='published'\`, \`show_publicly=true\` e início no futuro. Sem exposições de cachês, negociações e outros campos privados.
- A publicação também ganha metadata para títulos, descrição e compartilhamento em redes sociais. Um site não publicado ou sem direito Pro retorna 404 pelo lado servidor.

## Autorização Pro (independente de pagamento automático)

A publicação está bloqueada até existir direito legítimo. A RPC considera autorizado somente:

1. Um artista incluído **manualmente pelo administrador** em \`stage_pro_site_access\` (fase inicial de liberação controlada), **ou**
2. Uma conta com \`plan_code in ('artist_plus','studio')\` e \`subscription_status in ('active','trialing')\`, campos protegidos que o próprio usuário não pode alterar diretamente.

Esses critérios **não criam cobrança ou assinatura**. O usuário não se habilita sozinho por atributos de sessão, metadados de cadastro ou edição do rascunho. \`custom_subdomain_enabled\` é um campo separado e NÃO indica que DNS já foi configurado.

### Primeiro: instalar SQL

Pré-requisitos:

- \`multi_role_accounts_migration.sql\`
- \`free_artist_pages_migration.sql\` e \`free_artist_visuals_migration.sql\`
- \`premium_site_draft_editor_migration.sql\`
- \`premium_site_media_gallery_migration.sql\`
- \`artist_booking_requests_migration.sql\`

No Supabase → SQL Editor, execute:

\`\`\`
supabase/pro_artist_publication_migration.sql
\`\`\`

Este SQL não altera contas atuais nem publica páginas por conta própria. Preserva rascunhos, mídia privada e perfil gratuito.

### Segundo: liberar a conta desejada

Execute no **SQL Editor administrativo**, substituindo o e-mail da conta que efetivamente deve poder publicar:

\`\`\`sql
insert into public.stage_pro_site_access(owner_id)
select p.id
from public.profiles p
join auth.users u on u.id=p.id
where lower(u.email)=lower('SEU_EMAIL_AQUI')
  and p.is_artist=true
on conflict(owner_id) do nothing;
\`\`\`

Esta autorização permite publicação, mas não publica automaticamente a página.

### Terceiro: publicar explicitamente como cantor

1. Entre no Stage Flow na conta autorizada.
2. Em \`/meu-perfil-artistico\`, confirme que o perfil gratuito \`/@usuario\` está **publicado** e tem um @ de artista válido.
3. Abra \`/meu-perfil-artistico/site-profissional\`.
4. Selecione tema, cor e seções; **Salve rascunho**. Confira fotos/vídeos da galeria.
5. Na área **Publicação do site Pro**, confira as 3 validações e clique **Publicar site Pro**; confirme que deseja tornar a galeria visível.
6. Abra o endereço \`/pro/SEU_USUARIO\` numa janela anônima para conferir a versão pública.
7. Depois de alterar o rascunho, clique **Republicar alterações** para atualizar o site público.
8. Para suspender: clique **Retirar site Pro do ar**. O endereço Pro volta a 404, mas o rascunho e o perfil gratuito continuam.

## Segurança das fotos publicadas

Os uploads da galeria profissional continuam no bucket **privado** \`stage-premium-drafts\` com a política de acesso próprio. Esta nova migração adiciona **apenas uma regra de leitura** que libera, para visitantes, o download de fotos cuja chave esteja incluída na última publicação **e** cujo site Pro esteja ativo, autorizado e com a seção Portfólio visível.

- Fotos que não pertencem à publicação continuam inacessíveis para outros usuários.
- Uma alteração na galeria privada não torna novas fotos públicas até o artista **Republicar**.
- A função pública \`stage_public_pro_artist_site\` retorna somente a versão publicada. Ela não retorna contatos privados de pedidos, cachês, contratos, emails, convites nem a tabela de rascunhos.
- Não é permitido remover uma foto ainda utilizada pelo site Pro publicado. Retire do ar e exclua ou substitua a foto; depois publique novamente.
- **Os vídeos do YouTube permanecem hospedados no YouTube** e são abertos em outra aba; não há upload de vídeos.
- Observação: URLs temporárias previamente emitidas pela infraestrutura de storage podem permanecer válidas até expirarem. Retirar do ar revoga novas leituras por permissão de banco, não invalida magicamente caches de terceiros.

## Checklist de QA

1. **Antes de autorizar qualquer conta**, \`/pro/USUARIO\` retorna 404.
2. Liberar direito Pro no SQL Editor não publica automaticamente: a rota continua 404.
3. Conta artística autorizada com perfil gratuito ainda privado não consegue publicar Pro.
4. Artista autorizado precisa salvar o rascunho antes; então pode publicar por botão explícito.
5. Testar tema Concert/dourado, ocultar Contato, mudar ordem das seções e salvar. Publicar: público vê o mesmo tema/ordem, sem contato.
6. Adicionar foto e vídeo privado, publicar, abrir galeria numa janela anônima. Conferir download autorizado da foto selecionada e reprodução YouTube.
7. Com site ativo, adicionar outro trabalho ou editar tema e **não** republicar: versão pública deve continuar a anterior. Depois republicar e conferir atualização.
8. Ocultar seção Portfólio e republicar: fotos privadas não devem constar no RPC público nem estar disponíveis para novos downloads.
9. Com site ativo, confirmar que exclusão de foto utilizada é recusada. Retirar do ar e tentar novamente.
10. Despublicar Pro e confirmar 404, ausência do atalho Pro no perfil gratuito, e que \`/@usuario\` ainda funciona.
11. Confirmar que contratar pelo Pro só funciona se o opt-in já estiver habilitado no perfil gratuito; enviar formulário de teste e verificar entrada na caixa privada.
12. Revogar direito na tabela ou desativar o plano e confirmar que a página Pro não é mais acessível, sem afetar as páginas gratuitas.
13. Confirmar que \`/marketplace\` continua exibindo **Em breve**.

## Revogar um direito Pro concedido manualmente

Se for necessária uma remoção definitiva do acesso, faça também a despublicação no mesmo bloco administrativo:

\`\`\`sql
update public.stage_pro_site_publications
set published=false,updated_at=now()
where owner_id in (
  select id from auth.users where lower(email)=lower('SEU_EMAIL_AQUI')
);

delete from public.stage_pro_site_access
where owner_id in (
  select id from auth.users where lower(email)=lower('SEU_EMAIL_AQUI')
);
\`\`\`

O snapshot permanece armazenado, mas não volta a ficar disponível sem direito válido e nova publicação explícita pelo cantor.

## Próximos trabalhos opcionais

- Domínio oficial e wildcard \`*.stageflow.com\` configurados com DNS, SSL e atribuição de hostname segura ao dono.
- Integração real com um provedor de cobrança, renovação e cancelamento, com webhooks verificados.
- Gestão avançada de SEO, domínio próprio e estatísticas, com controle de cache para revogações.


## Evolução Pro v2 — seções de Fotos e Vídeos independentes (outubro de 2026)

Na próxima evolução do editor \`/meu-perfil-artistico/site-profissional\`, a antiga seção única **Portfólio** passa a ser **Galeria de fotos** e **Vídeos**, ambas com **controles próprios de posição e visibilidade**. Agora o cantor pode colocar a galeria em uma parte do site e os vídeos em outra, e esconder somente uma delas. Os links da navegação acompanham a ordem escolhida. Ambas mantêm os layouts responsivos e a galeria de fotos ampliável.

**Migração nova e obrigatória para salvar as cinco seções:**

\`\`\`
supabase/pro_artist_independent_media_sections_migration.sql
\`\`\`

Execute no SQL Editor **após instalar a versão corrigida** de \`supabase/pro_artist_publication_migration.sql\`. O script transforma automaticamente \`portfolio\` em \`photos\` + \`videos\` no mesmo lugar em rascunhos e publicações existentes. Se Portfólio estava oculto, os dois ficam ocultos; se estava visível, ambos continuam visíveis. **Fotos, vídeos, capa, bio, cores, temas, conta Pro e URL são preservados.** O SQL pode ser executado novamente e não publica nenhum rascunho sozinho.

Os controles do editor passam a mostrar **5 seções**: Sobre, Galeria de fotos, Vídeos, Agenda e Contato. Pelo menos uma delas permanece visível. Alterações só entram na versão pública com **Salvar rascunho** e depois **Republicar alterações**.

A segurança acompanha essa separação: quando Fotos está oculta, a função de leitura pública não retorna objetos de foto e a permissão de download do bucket privado deixa de liberar novas leituras dessas imagens. Vídeos permanecem no YouTube e somente aparecem se a seção Vídeos estiver visível. O servidor continua servindo somente snapshots de publicações válidas, sem rascunhos.

### Teste recomendado

1. Execute a migração e carregue o editor Pro: deve haver cinco seções, incluindo Fotos e Vídeos separadas, na ordem em que Portfólio aparecia.
2. Mova Vídeos para cima da Agenda e Fotos para o fim. Salve, feche e reabra o editor: a ordem deve persistir.
3. Desmarque Fotos, deixando Vídeos visível. Publique ou republique e abra \`/pro/usuario\` em janela anônima: a galeria deve desaparecer, mas os vídeos devem permanecer.
4. Inverta: mostre Fotos e oculte Vídeos. Salve/republique e confira que novas solicitações de download das fotos publicadas funcionam, enquanto a seção Vídeos não aparece.
5. Verifique que novas fotos e vídeos do rascunho não vão para o site público sem republicar, e que o perfil gratuito continua ativo.
6. Confira que \`/marketplace\` permanece **Em breve**.


## Evolução: player de vídeos integrado ao próprio site Pro

A seção **Vídeos** agora apresenta um player cinematográfico responsivo de proporção **16:9**, com miniatura e botão **Reproduzir neste site**. O músico continua cadastrando links normais do YouTube no editor; não precisa reenviar nenhum vídeo.

- A primeira apresentação cadastrada/destacada aparece selecionada, mas o vídeo **não inicia automaticamente** ao abrir a página.
- O visitante clica **Reproduzir neste site**, ou escolhe qualquer cartão da lista; o conteúdo é carregado dentro da própria página usando **youtube-nocookie.com**.
- Selecionar outro vídeo troca a reprodução em andamento. **Fechar player** interrompe a reprodução e volta à miniatura.
- Há um link **Abrir no YouTube**, útil caso o criador bloqueie a incorporação ou o navegador impeça a reprodução.
- No celular, os cartões formam uma coluna e a escolha de vídeo desloca o visitante até o player.
- Fotos seguem com galeria e ampliação independentes. Ordem, títulos e visibilidade de seções continuam sob controle do cantor.
- O componente é o mesmo na prévia privada e no site Pro publicado, com o visual existente preservado.
- Para privacidade e desempenho, a miniatura pode ser carregada do YouTube, mas o **iframe do player só é criado após ação explícita do visitante**; isso não equivale a anonimato completo em relação ao YouTube.
- O recurso não altera Supabase, permissões, preços, lançamento do marketplace nem a lógica de publicar/republicar.

### Checklist rápido de teste

1. Como cantor, abra o editor Pro, inclua dois vídeos YouTube no rascunho e confira a prévia.
2. Clique **Reproduzir neste site**: o vídeo deve abrir dentro do player 16:9 sem redirecionar o navegador.
3. Clique no segundo cartão: o novo vídeo deve substituir o anterior.
4. Clique **Fechar player**: a reprodução deve parar e a miniatura voltar.
5. Teste em celular e em desktop. Confira o botão **Abrir no YouTube** para um vídeo que bloqueie incorporação.
6. Se o site Pro já estiver publicado, **republicar só é necessário quando houver alterações no conteúdo do rascunho**; a melhoria do player é visual/funcional e se aplica ao conteúdo publicado existente.
7. Confirme que fotos e vídeos continuam separados e que \`/marketplace\` permanece **Em breve**.
