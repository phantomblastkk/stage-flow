# Stage Flow — Parte 22: extrair CSS do perfil gratuito de cantor

Data: 28/10/2026. Base: `e7fd4b1595466d76da55390452ec6d269a9d77a2`.

## Objetivo e escopo

Separar o CSS do perfil público gratuito de cantor do restante dos estilos globais, preservando a cascata, os temas e os estados responsivos. Não é uma mudança visual nem uma alteração de negócio.

## Alterações aplicadas

- `src/domains/artists/styles/legacy-free-singer.css`: novo arquivo com **7.369 caracteres**, contendo ambas as seções originais de perfis gratuitos de cantores (página/hero, fotos, temas personalizados, preview, editores e media queries de 750px e 620px).
- `app/styles/legacy-global-tail.css`: agora guarda as regras posteriores à base global até o fim da home pública (**10.245 caracteres**).
- `app/styles/legacy-after-free-singer.css`: novo arquivo com as regras que originalmente vinham depois do cantor (**11.363 caracteres**), incluindo cadastro, booking, identidade visual, casas parceiras, mobile e overrides tardios.
- `app/layout.tsx`: cinco imports CSS ordenados para espelhar a cascata original.
- `tests/global-css-domain-split.test.mjs`: regressões de ordem, temas dinâmicos, CSS responsivo e regras de formulário posteriores à folha do cantor.

Ordem exata em `app/layout.tsx`:
```tsx
import "./globals.css";
import "@/src/domains/artists/styles/legacy-musician-portfolio.css";
import "./styles/legacy-global-tail.css";
import "@/src/domains/artists/styles/legacy-free-singer.css";
import "./styles/legacy-after-free-singer.css";
```

## Verificação executada

- Releitura dos cinco arquivos no GitHub após os commits, confirmando que nenhum está vazio.
- Hash FNV-1a calculado sobre caracteres UTF-16 na concatenação dos cinco arquivos: **`eee026ce`**, idêntico ao CSS único antes da Parte 21.
- Total original e recomposto: **48.480 caracteres**. Sem alterações de bytes de regras CSS por esta extração.
- **10 verificações diretas** passaram: integridade textual, ordem e unicidade dos imports, presença dos seletores e temas essenciais, breakpoints, separação da folha da home e presença de overrides posteriores.
- O teste Node foi atualizado no repositório, mas **não foi executado** neste ambiente. Build Next.js, Playwright e revisão de capturas também não foram executados.

## Gates pendentes

1. `node --test tests/global-css-domain-split.test.mjs tests/signup-username-collision.test.mjs`
2. Suíte Node completa + `npx tsc --noEmit` + `npm run build`
3. Browser `tests/browser/agenda-finance.mjs` e `tests/browser/operational-home.mjs` contra fixtures
4. Revisão visual em 360px e 1280px para perfil gratuito, temas de músico, home, cadastro, agenda e financeiro.
5. Conferir workflows de CI do commit final. A API conectada listou zero status checks e zero runs filtrados por PR para o commit anterior; isso não prova execução/aprovação ou ausência de GitHub Actions.

## Segurança e publicação

- Nenhuma conta, Auth, banco, pagamento, permissão, preço ou API foi modificada.
- Nenhum deploy ou publicação automática foi realizado. A produção permanece congelada até autorização expressa.
- A troca de e-mail previamente solicitada não foi feita.

## Próxima fatia recomendada

Parte 23: depois dos gates de build e navegador, isolar estilos de autenticação e cadastro sem alterar a precedência da cascata; em paralelo, prosseguir com a remoção de consumidores legados de `.btn`, `.field` e `.feature` somente mediante verificação por rota.
