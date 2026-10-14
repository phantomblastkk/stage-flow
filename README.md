# Stage Flow

Plataforma para organizar agendas musicais, conectar produtores e músicos e criar páginas públicas de artistas.

## Stack
- Next.js (App Router) + TypeScript
- Supabase (Auth e PostgreSQL)
- Vercel (deploy)

## Desenvolvimento local
1. Instale Node.js LTS.
2. Execute `npm install`.
3. Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase.
4. Execute `npm run dev` e abra http://localhost:3000.

## Status
Scaffold inicial. A interface pública é demonstrativa; autenticação, persistência de dados, cobrança e notificações precisam ser conectadas/configuradas antes de produção.

## Subdomínios
O modelo de dados reserva um slug único para cada artista. Quando o domínio estiver configurado, o middleware/roteamento poderá resolver `slug.stageflow.com` para o perfil público correspondente.

## Conectar Supabase Auth (etapa inicial)

1. No Supabase, abra **Project Settings → API** (a localização dos nomes pode variar ligeiramente).
2. Copie **Project URL** e a chave pública **anon/publishable**. Nunca use nem compartilhe a chave `service_role` no navegador ou no GitHub.
3. Configure essas duas variáveis como `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no ambiente onde executar o app. Para desenvolvimento local, crie `.env.local` usando `.env.example`.
4. No **SQL Editor**, revise e execute primeiro `supabase/schema.sql`; depois execute `supabase/handle_new_user.sql` para criar automaticamente um perfil ao registrar uma conta.
5. Em **Authentication → URL Configuration**, ajuste a URL do site quando houver deploy e configure as URLs de redirecionamento necessárias.
6. Teste com uma conta de teste antes de usar dados reais.

As telas de cadastro/login agora chamam Supabase Auth, mas ainda faltam sessão protegida no servidor, recuperação de senha, validação de username realmente única na interface, fluxos de convites, cobrança e revisão completa de segurança/RLS. Não considerar pronto para produção.
