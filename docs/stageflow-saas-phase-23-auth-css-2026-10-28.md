# Stage Flow — Parte 23: autenticação e cadastro em estilos por domínio

Data: 28/10/2026. Base: `c4f604174b75b25ebf78eda4a0486e9bf2a3f5fd` (Parte 22).

## Resultado

Os estilos legados do formulário de autenticação e dos cartões de cadastro foram separados em folhas do domínio `auth`, sem reescrever declarações nem mudar a cascata. A mudança é arquitetural, não visual.

### Ordem de carregamento (em `app/layout.tsx`)

1. `app/globals.css` — 3.929 caracteres, fundação global.
2. `src/domains/auth/styles/legacy-auth-forms.css` — 1.317 caracteres, autenticação e formulários.
3. `app/styles/legacy-base-responsive.css` — 662 caracteres, media queries compartilhadas que originalmente vinham depois dos formulários.
4. `src/domains/artists/styles/legacy-musician-portfolio.css` — 13.595 caracteres, portfólio de músico.
5. `app/styles/legacy-global-tail.css` — 10.245 caracteres, parte da home pública e regras posteriores.
6. `src/domains/artists/styles/legacy-free-singer.css` — 7.369 caracteres, página gratuita de cantor.
7. `src/domains/auth/styles/legacy-signup-roles.css` — 1.627 caracteres, seletor das três atuações no cadastro.
8. `app/styles/legacy-after-free-singer.css` — 9.736 caracteres, regras posteriores, incluindo overrides responsivos, marca, casas parceiras e demais ajustes.

A ordem mantém o CSS equivalente ao monólito anterior às Partes 21–23. A concatenação dos oito textos possui 48.480 caracteres e hash FNV-1a (UTF-16) `eee026ce`, exatamente os mesmos da versão original. A extração não reduziu a quantidade de CSS enviado nem mudou o comportamento dos componentes.

## Critérios e limites

- Campos base de login/cadastro, mensagens, botões e marca preservados.
- Continua a existir uso legado compartilhado de `.field`, `.btn`, `.coming`; não se alterou seletor ou comportamento para evitar regressões.
- As media queries originalmente compartilhadas por home e auth permanecem num arquivo de compatibilidade.
- A seleção de cantor, músico de apoio ou produtor mantém a mesma estrutura visual e regras.
- As regras tardias de 600px, 480px e 375px conservam precedência sobre as originais.
- Nenhuma chamada Supabase, RLS, papel, credencial, pagamento, preço, assinatura ou regra de negócio foi alterada; o pedido anterior de troca de e-mail continua fora desta etapa.
- Sem deploy em produção.

## Verificações

- O build e os testes operacionais da Parte 22 foram confirmados via GitHub Actions:
  - [Integration and build — commit a042bfb](https://github.com/phantomblastkk/stage-flow/actions/runs/40747634271): sucesso.
  - [Operational UX — commit c4f6041](https://github.com/phantomblastkk/stage-flow/actions/runs/40747770759): sucesso.
- Conferência pós-extração dos oito arquivos e da ordem de imports: conteúdo original recomposto exatamente, hash `eee026ce`.
- `tests/global-css-domain-split.test.mjs` atualizado para exigir reconstrução integral do CSS, ordem correta, mídia responsiva e presença das classes originais. A execução desse teste e dos workflows da Parte 23 depende do resultado do GitHub Actions para o commit final.
- Não houve revisão em Safari físico; testes Playwright são simulações.

## Próximas ações

1. Confirmar CI de **Integration and build** e **Operational UX** no commit final desta etapa. Corrigir regressões antes de avançar.
2. Inspecionar artefatos de navegador para 360/768/1280px das rotas públicas, cadastro, perfil e workspace.
3. Migrar consumidores de classes globais `.btn`, `.field` e `.feature` para os componentes do Design System por jornada, com testes comparativos, não por busca e substituição genérica.
4. Publicar em produção somente mediante autorização explícita.
