# StageFlow — Parte 20: auditoria e limpeza limitada do CSS global

Base: `ede7a4e295ff96bb81361d1fdcd7a818564c0a93`, diretamente na main.

## Problema, impacto e solução aplicada

O arquivo global ainda continha o dashboard substituído pelo workspace e partes
antigas da landing/cadastro. Essas regras eram carregadas sem consumidor atual,
aumentando o CSS e dificultando identificar qual componente é dono de cada estilo.
Foram removidas somente regras das famílias revisadas sem referências no código
executável. Não houve troca de componentes, regras de negócio ou dependências.

| Medição | Antes | Depois |
|---|---:|---:|
| Bytes UTF-8 de app/globals.css | 54.128 | 48.818 |
| Classes distintas nos seletores | 223 | 196 |

Redução de 5.310 bytes (9,8%) no arquivo-fonte; 63 regras removidas de 27 classes.
Isso não mede gzip, bundle total, tempo de carregamento ou capacidade de usuários.

## Método e inventário dos consumidores

Auditoria pontual com parser PostCSS já instalado pelo Next: seletores, regras,
ancestrais de media queries e declarações. Busca com limites de token em 140 arquivos
versionados TS/TSX/JS/JSX/HTML/SVG, excluindo testes e scripts como consumidores.
Revisão adicional das concatenações de className, configuração de temas/layouts,
seletores usados por outros CSS e páginas atuais da home, cadastro e painel.
A busca textual é conservadora: encontrar uma string não prova uso, e sua ausência
não prova que uma classe dinâmica esteja morta. Nenhuma exclusão automática em CI.

Inventário após a limpeza, com categorias por prefixo (não por rota exclusiva):

| Família | Classes mantidas | Com referência literal | Consumidores principais |
|---|---:|---:|---|
| Base/utilitários | 37 | 37 | páginas e componentes legados; .btn, .field, .feature, .coming |
| Cadastro/autenticação | 10 | 10 | app/cadastro, app/login e recuperação de acesso |
| Portfólio instrumentalista | 55 | 47 | musician-portfolio-view e instrumentalist-profile-editor |
| Home pública | 63 | 63 | app/page, home-partner-venues e home-verified-artists |
| Perfil/editor artístico | 31 | 16 | artist-profile-editor e artist-booking-form |

196 classes mantidas; 173 possuem referência literal. As 23 sem referência literal
permanecem até revisão específica. Entre elas, mp-theme-ivory, mp-theme-stage e
mp-layout-minimal são montadas por concatenação em musician-portfolio-view.tsx e
precisam continuar funcionando. Classes artist-free-* também compartilham regras
agrupadas com classes usadas pelo editor e pelo formulário de contratação.

## Classes removidas

- `preview-top`
- `tiny-label`
- `preview-title`
- `stat-row`
- `stat`
- `event-pill`
- `feature-icon`
- `profile-demo`
- `profile-copy`
- `profile-url`
- `cta`
- `role-options`
- `role-option`
- `mobile-menu`
- `dashboard-experience`
- `dashboard-experience-eyebrow`
- `dashboard-experience-actions`
- `dashboard-experience-choice`
- `dashboard-shortcuts`
- `dashboard-shortcut`
- `dashboard-shortcut-top`
- `dashboard-shortcut-icon`
- `dashboard-shortcut-tag`
- `dashboard-shortcut-arrow`
- `dashboard-secondary-title`
- `dashboard-secondary-grid`
- `dashboard-secondary-link`

## Pendências preservadas para a próxima etapa

Classes sem referência literal que não foram removidas:

- `mp-theme-ivory`
- `mp-theme-stage`
- `mp-location`
- `mp-hero-type`
- `mp-work-pending`
- `mp-layout-minimal`
- `mp-public-wrap`
- `mp-public-head`
- `artist-free-page`
- `artist-free-hero`
- `artist-free-overline`
- `artist-free-monogram`
- `artist-free-intro`
- `artist-free-handle`
- `artist-free-tagline`
- `artist-free-content`
- `artist-free-socials`
- `artist-free-events`
- `artist-free-event`
- `artist-free-event-date`
- `artist-free-footer`
- `artist-free-cover-photo`
- `artist-mobile-edit-steps`

## Diff e validação

- app/globals.css: exclusão das 63 regras e da media query que ficou vazia.
  Regras do cadastro que dividiam media query com o antigo dashboard permanecem.
- tests/browser/agenda-finance.mjs: três cenários públicos em 360/768/1280 px,
  navegando da home ao cadastro por teclado, alternando as três atuações e
  verificando aria-pressed exclusivo, ausência de overflow e erros de execução.
  Contexto anônimo e API sintética, sem enviar cadastro.
- Comparação estrutural antes/depois: todas as regras mantidas preservam seletores,
  declarações, ordem e condições ancestrais. Parser e script pontuais, sem dependência nova.
- 262 testes Node e TypeScript aprovados localmente.
- Build de produção aprovado localmente e em CI. Avisos preexistentes de CSS/
  Autoprefixer permanecem; não houve alteração de declaração nas regras mantidas.
- CI aprovado no commit `cdb8a88c0c2b42d8cee60f96594d97f4983cf08c`:
  [Integration and build](https://github.com/phantomblastkk/stage-flow/actions/runs/40741196504)
  e [Operational UX](https://github.com/phantomblastkk/stage-flow/actions/runs/40741196510),
  incluindo PostgreSQL temporário e navegador operacional.
- 24 cenários PASS na suíte agenda-finance, incluindo os três novos cenários públicos.
  [Artefato de navegador](https://github.com/phantomblastkk/stage-flow/actions/runs/40741196504/artifacts/12839457943):
  69 PNGs e log do servidor; retenção de sete dias. Revisão visual da home/cadastro
  em 360 px e cadastro em 1280 px: disposição, botões e seleção por foco preservados.
  [Evidência operacional](https://github.com/phantomblastkk/stage-flow/actions/runs/40741196510/artifacts/12839906417).

Reproduzir o diff completo: `git diff ede7a4e -- app/globals.css tests/browser/agenda-finance.mjs`.
Os cenários de navegador existentes continuam cobrindo agenda, financeiro, convites,
negociação, equipes, recorrência, conta, planos, assinatura e troca de identidade.

## Migração gradual restante

1. Revisar as 20 classes sem referência literal restantes além dos três temas/layouts
   dinâmicos, verificando seletores agrupados e rotas públicas antes de outra exclusão.
2. Extrair portfólio e editor para folhas do domínio artists, preservando a ordem da
   cascata e testando temas ivory/stage/minimal e personalização no navegador.
3. Isolar estilos da home e autenticação com verificação de navegação anônima.
4. Migrar os consumidores de .btn/.field/.feature ao Design System por jornada;
   remover a regra global somente quando o último consumidor tiver migrado.

A correção de CSS continua parcial. Nenhum deploy, SQL, configuração de publicação,
pagamento, credencial ou regra de autorização foi alterado nesta etapa.
