# Stage Flow — Parte 21: separar CSS legado do portfólio de músico

Data: 28/10/2026. Base revisada: `cd27b66a728ecaa19e63d218e380a48adcc8089c` (`main`).

## Escopo implementado

O arquivo `app/globals.css` reunia estilos fundamentais, uma seção grande dedicada ao portfólio de músico e regras posteriores de outras jornadas. A seção de músico foi extraída sem alterar suas declarações; as regras posteriores continuam carregadas **depois** dela, para manter as prioridades originais.

Ordem dos imports em `app/layout.tsx`:

1. `./globals.css` — base global e autenticação legada (5.908 caracteres).
2. `@/src/domains/artists/styles/legacy-musician-portfolio.css` — portfólio e temas (13.595 caracteres).
3. `./styles/legacy-global-tail.css` — estilos posteriores de home, cadastro, perfil artístico e ajustes (28.977 caracteres).

Total de caracteres recompostos: **48.480**, exatamente o tamanho original, sem alterar nenhuma regra, seletor ou media query. A ordem reproduz a cascata anterior; isso não é uma redução do CSS servido, somente separação por responsabilidade. Foi validada a igualdade do hash FNV-1a (UTF-16) do CSS recomposto e do monólito original: `eee026ce`.

## Compatibilidade e segurança

- Os temas `ivory` e `stage` e o layout `minimal` são aplicados por classes dinâmicas; nenhum foi removido.
- Ajustes tardios como `.mp-editor-stickybar` permanecem na última folha para não alterar a precedência.
- As regras responsivas e os estilos da home e cadastro continuam presentes e na ordem anterior.
- Nenhuma regra de negócio, componente de autenticação, tabela, RLS, migração, credencial, cobrança ou API foi alterada.
- Sem novo deploy. Publicação continua exclusivamente manual.

## Validação e limites

- Conferência pós-gravação por leitura dos três arquivos e da importação em `app/layout.tsx`: os textos recompostos possuem o mesmo hash `eee026ce` do original; imports estão na ordem esperada.
- Adicionado `tests/global-css-domain-split.test.mjs` para prevenir perda dos imports, mudanças de ordem e desaparecimento de seletores dinâmicos essenciais.
- Este registro **não** declara CI, build Next.js ou Playwright aprovados para a Parte 21. Executá-los e avaliar capturas de viewport pequeno antes de publicar.
- O último CI documentalmente aprovado antes da extração é o da Parte 20 em `cdb8a88c`.

## Continuidade

1. Rodar `node --test tests/global-css-domain-split.test.mjs tests/signup-username-collision.test.mjs` e a suíte Node completa.
2. Executar `npx tsc --noEmit`, `npm run build` e os navegadores sintéticos `tests/browser/agenda-finance.mjs` e `tests/browser/operational-home.mjs`.
3. Revisar visualmente os temas do portfólio em 360px e 1280px e os fluxos de cadastro, home, agenda e financeiro.
4. Somente após esses gates, seguir para extração do perfil gratuito de cantor e para migração gradual de consumidores de classes globais ao Design System.
