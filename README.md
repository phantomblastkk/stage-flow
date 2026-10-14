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
