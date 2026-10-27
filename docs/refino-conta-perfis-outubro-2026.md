# StageFlow — refinamento dos perfis e da conta (27/10/2026)

## Branch e publicação
- Mudanças diretamente na `main` conforme orientação do proprietário.
- CI executa testes + TypeScript + build. Não faz deploy.
- `vercel.json` continua com deploy automático desabilitado para `main` e `develop`.
- Deploys devem ser feitos manualmente, após verificação do commit testado.

## Referências de experiência
- Spotify for Artists: separar foto/capa, biografia, destaques e agenda; perfil apresenta identidade forte sem repetir texto decorativo.
  - https://support.spotify.com/br-en/artists/article/managing-your-artist-images-on-spotify/
  - https://artists.spotify.com/blog/making-the-most-of-your-artist-profile-on-spotify
- Navegação de redes sociais: menu compacto de conta junto aos avisos, com contexto e destinos rápidos, mantendo informações privadas fora do público.

## Perfil de cantor
- A `headline` fica exclusivamente na frase de assinatura abaixo do nome.
- Biografia de conteúdo igual (ignorando caixa, pontuação final, aspas e espaços) não é repetida no hero ou no Sobre.
- Quando não existe biografia independente, usa um texto informativo neutro, não a headline.
- Assinatura ganhou linha editorial discreta, hierarquia visual e espaçamento responsivo.
- Editor explica explicitamente o papel independente da frase de assinatura e da biografia e mostra sua fonte especial na prévia.
- Conteúdo Pro continua com entitlement separado; imagens privadas não são abertas automaticamente.

## Perfil de músico
- Biografia idêntica à headline não aparece duplicada.
- Mais legibilidade no cabeçalho, links de navegação e cartões, preservando estilos já salvos e o visual responsivo.

## Menu e Minha conta
- Dropdown acessível ao lado da campainha, com fechamento por Escape e clique externo.
- Links para cantor, músico, conta, privacidade, e-mail/senha e administração quando autorizada pelo RPC de proprietário.
- `/minha-conta` agora organiza Visão geral, Perfil de cantor, Perfil de músico, Dados pessoais, E-mail e segurança, Privacidade.
- Alteração de e-mail usando Supabase Auth `updateUser({email})`: depende de confirmação por e-mail conforme configuração do projeto.
- Nova senha pelo Supabase Auth, com no mínimo 12 caracteres e confirmação do formulário; autenticação adicional pode ser exigida pela plataforma.
- Privacidade mostra estados reais de publicação por perfil, e aponta os editores responsáveis por publicar/ocultar.
- Nenhuma informação sensível passa a ser pública; os prazos de 60 dias para nome e @ permanecem no banco.

## Ativação de conta híbrida
- Para acrescentar uma função artística: caixa de ciência do caráter permanente e digitação exata `ATIVAR` no diálogo com foco e Escape.
- No cadastro de novo cantor com função adicional de músico: segunda caixa obrigatória de confirmação.
- A ativação mantém recursos gratuitos e não mexe em plano ou cobrança.
- O usuário não tem botão para revogar a própria função. Uma eventual reversão requer intervenção administrativa autorizada; ainda não foi criado um novo comando destrutivo de remoção de função na central.

## Validações
- Testes de contratos de cadastro, painel, segurança de conta, assinaturas públicas, compatibilidade com links antigos, prévia de portfólio.
- Sem acesso autenticado automático às contas reais, o teste visual de navegabilidade deve ser feito em homologação antes de eventual publicação manual em produção.
