# StageFlow — perfil único do cantor e portfólio de músico, revisão visual

Data: 27/10/2026. Branch de implementação: `develop`. Publicação no projeto oficial requer autorização expressa.

## Um perfil de cantor: público e editor

O cantor mantém uma **única página pública**: `/<username>`, seja gratuito ou com recursos Pro. `/pro/<username>` é uma rota de compatibilidade que redireciona para a canônica. O painel de assinatura não cria um segundo perfil.

O editor também foi unificado:

- Entrada única: `/meu-perfil-artistico`.
- Aba **Dados e publicação**: biografia, frase, local, imagens, redes sociais, endereço e pedidos de contratação, sempre disponíveis gratuitamente.
- Aba **Aparência e galerias**: mesmo perfil, visual e galerias Pro opcionais, com rascunho privado e autorização de publicação no Supabase.
- O parâmetro `?aba=pro` seleciona a segunda aba; o antigo editor `/meu-perfil-artistico/site-profissional` redireciona para esta aba. URL pública não muda.
- O conteúdo da aba Pro permanece montado após a primeira visita para não descartar um rascunho ainda não salvo ao trocar de aba. Publicar Pro continua exigindo permissão real: o botão bloqueado não libera acesso.
- O perfil Free não deixa de existir quando a publicação Pro é desativada. Galerias gratuitas bloqueadas mostram somente cartões fictícios em blur, não conteúdos privados.
- A cor gratuita salva em `artist_accent` passou a ser respeitada no visual público quando não há publicação Pro.
- O antigo identificador `lime` é mantido por compatibilidade com o banco, mas passou a apresentar cor **rosa suave**, não verde neon.

## Portfólio independente do músico

`/musico/<slug>` continua independente do cantor e é gratuito para contas com a função de músico; a conta pode ter ambas as funções sem alterar assinatura.

Melhorias:
- Paleta predominante grafite, violeta e azul; seleção visual agora oferece violeta, coral, ciano e dourado (sem Lima).
- Portfólios antigos cujo campo `accent` está em `lime` aparecem em violeta; a edição utiliza esse valor de forma segura.
- Hero, miniaturas dos vídeos, cartões, tipografia e sombras mais consistentes, com layouts melhorados para telas pequenas.
- Navegação por seções com rolagem horizontal no celular e foco visível nos links e botões.
- A prévia do editor usa um identificador de seção independente, não abre links externos acidentalmente e permite abrir **tela cheia**. Modal com tecla Esc, retorno de foco, controle de Tab e bloqueio de rolagem ao fundo.
- Página pública oferece campo selecionável para copiar o link se tanto compartilhamento nativo quanto clipboard falharem.
- Redução de movimento respeitada nos efeitos adicionados.

## Regras de segurança e limites

Não alterar direitos do plano, assinaturas, função de proprietário, contabilidade ou acesso aos dados privados. Rascunhos Pro e galerias não são expostos pela RPC pública enquanto não houver publicação e autorização válidas. Nenhum SQL novo é necessário para esta reformulação de frontend.

O legado de cores nos bancos deve continuar reconhecido; não migrar valores históricos à força para não modificar preferências sem o conhecimento do proprietário.

## Verificações

- `tests/singer-public-site.test.mjs` verifica URL única, abas, compatibilidade do editor antigo, acessibilidade, cores, galeria bloqueada, prévia do músico, fallback manual e separação público/privado.
- `tests/brand-auth-navigation.test.mjs` e `tests/chat-finance.test.mjs` mantêm a verificação de proteção dos recursos Pro sob a arquitetura do editor único.
- CI da `develop` executa testes, TypeScript e build do Next.js sem deploy.
- A homologação visual completa requer uma sessão autorizada, pois o projeto QA da Vercel é protegido por SSO. Testar em desktop e celular, inclusive os estados Free, Pro autorizado e músico publicado.

**Produção `stage-flow`: não publicar nem fazer merge na `main` sem autorização.**
