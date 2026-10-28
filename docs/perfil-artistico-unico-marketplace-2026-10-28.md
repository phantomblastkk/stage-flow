# Stage Flow — Perfil Artístico único e cards do Marketplace

Data: 28/10/2026. Implementação na branch `main`. O deploy em produção é manual, sem ativação automática por Git.

## Experiência pública

- Uma pessoa, uma identidade artística: uma conta com funções de cantor e músico tem um único perfil visual e um único endereço canônico `/<username>` quando a página artística estiver pública.
- O link legado `/musico/<slug>` permanece acessível e abre o mesmo **componente** de página elaborada. Se o endereço principal estiver publicado, a navegação redireciona a ele. Não se apagam registros ou links antigos.
- Instrumentos, gêneros, formatos de atuação, trajetória, links de apresentações, preço de referência e disponibilidade são uma seção complementar **apenas quando o portfólio musical foi publicado voluntariamente**.
- O artista que é somente músico também recebe o mesmo layout elaborado. Sua foto do músico é usada quando não há imagem artística pública; rascunhos de cantor e galerias Pro continuam privados.
- No painel e na Minha Conta, a função de músico agrega recursos ao perfil único em vez de criar uma nova identidade visual. Configurações de Marketplace, visibilidade dos dados musicais e contatos continuam opcionais.
- Galerias e mídia Pro são carregadas somente de snapshots publicados e autorizados; não foram ampliadas permissões comerciais nem burlados planos.

## Design do Marketplace

- Cards de busca e destaque usam o mesmo componente reutilizável, sem capa/banner decorativo.
- Avatar quadrado com `object-fit: cover`, tipografia hierarquizada e informação escaneável: nome, `Cantor • Músico` (somente quando função pública de cantor), cidade, instrumentos, preço e disponibilidade.
- Nota média e contagem vêm das avaliações verificadas que as RPCs existentes já filtram por moderação. Sem avaliação, informar `Ainda sem avaliações`, jamais inventar estrelas/números.
- Favoritos, convite, denúncia e eventos de visualização continuam funcionais.
- Nova foto enviada no editor é automaticamente recortada e otimizada para um quadrado 800 × 800. Fotos antigas não são apagadas nem sobrescritas. Para eliminar margens pretas embutidas **no arquivo original**, é necessário reenviar a foto.

## Banco e segurança

A migração `supabase/unified_artistic_profile_20261028.sql` adiciona duas RPCs somente de leitura:

- `stage_public_artistic_musician`: resolve um portfólio musical publicado e retorna @ apenas quando a identidade artística está pública.
- `stage_public_marketplace_identity`: retorna atributos mínimos para até 48 IDs de músicos listados e publicados, excluindo perfis moderados/ocultos; a foto do cantor só é exposta quando sua identidade de cantor está publicada.

Nenhuma linha de perfil existente é atualizada ou apagada. RLS, publicação opt-in e moderação continuam a controlar exposição e convites. A aplicação usa apenas chaves públicas no cliente.

**Ambientes:** banco oficial recebeu as duas RPCs; banco QA recebeu a primeira, porque QA ainda não possui a tabela `stage_marketplace_hidden_musicians`. Antes de implantar o novo Marketplace na QA, aplicar a migração de moderação e a RPC restante.

## Checklist antes de publicar

1. Testes Node/TypeScript e build Next.js finalizados sem falhas.
2. Testar catálogo em tela pequena e larga, foto real e sem foto, com e sem avaliações, favorito, convite e denúncia.
3. Testar `/musico/slug` de músico puro e de artista híbrido, mais `/<username>` com/sen publicação de instrumentos.
4. Autorizar **deploy manual** do SHA aprovado, mantendo `git.deploymentEnabled=false` e Ignored Build Step automático.
