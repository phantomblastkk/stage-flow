# Parte 47 — Cascata global e retirada de CSS sem consumidores

Base da main conferida antes de editar: `5e55208770cc4422506e7d9c1bb12c58f6ac7575`.

## Problema e impacto

O layout raiz importava o antigo seletor de papéis do cadastro, embora o cadastro
atual já use signup-wizard.css. A cauda global mantinha seletores dessa versão e de
atalhos de edição substituídos por MobileEditorWizard. Uma folha antiga de confirmação
de perfil duplo também não possuía importação. O teste anterior fixava tamanho/hash
de todo o CSS histórico, impedindo retirar regras órfãs sem alterar a regra do teste.

## Mapa da cascata preservada

A ordem abaixo segue o layout raiz. Não foram criadas layers nem movidos imports
para layouts de rotas: isso poderia mudar a prioridade em navegação entre páginas.

| Ordem | Folha | Consumidores e responsabilidade |
| --- | --- | --- |
| 1 | app/globals.css | Reset, variáveis de marca, containers, botões antigos e fundação da home |
| 2 | src/domains/auth/styles/legacy-auth-forms.css | Login/cadastro e formulários que ainda consomem field/field-help |
| 3 | app/styles/legacy-base-responsive.css | Breakpoints da fundação e autenticação |
| 4 | src/domains/artists/styles/legacy-musician-portfolio.css | Perfil e prévia de músico, temas/classes dinâmicas preservados |
| 5 | app/styles/legacy-global-tail.css | Foco global, estados disabled e home |
| 6 | src/domains/artists/styles/legacy-free-singer.css | Classes públicas e de editor ainda consumidas; sem remoção automática |
| 7 | app/styles/legacy-after-free-singer.css | Marca final, home/parceiros/verificados, legibilidade mobile e destinos de âncora do editor |

Componentes UI carregam tokens.css pelo módulo compartilhado; signup-wizard.css
continua ligado à rota de cadastro; o wizard de edição mantém sua própria folha.
As classes usadas por temas dinâmicos não foram consideradas mortas pela ausência
de um literal completo numa busca simples.

## Modificações aplicadas

- Removido import do layout e excluída legacy-signup-roles.css: zero consumidores
  em app/components/src para as famílias signup-role-* e signup-producer-add.
- Excluída app/cadastro/hybrid-confirm.css: zero imports/consumidores do estilo antigo
  signup-hybrid-confirm; a seleção atual de atuação e consentimentos segue intacta.
- Retirados da cauda global os overrides dessas famílias e de artist-mobile-edit-steps,
  substituída pelo componente MobileEditorWizard. Regras ativas do editor foram mantidas.
- Retirada a dimensão de brand-mark em legacy-base-responsive.css: era sempre
  sobreposta pela definição final da marca, inclusive pelo breakpoint final de 480 px.
- Testes de cascata agora verificam ordem/import único, regras ativas e ausência de
  consumidores runtime dos seletores aposentados. Não congelam whitespace/hash histórico.
- audit-css.mjs passa a excluir deleções da árvore de trabalho ao gerar o inventário,
  permitindo auditar a remoção antes de criar o commit. Não altera arquivos do produto.

CSS rastreado: 64 → 62 folhas. Fonte CSS retirada nas folhas limpas: **3423 bytes**. O reforço do seletor de foco
adiciona 55 bytes em outra folha: redução líquida de **3368 bytes**. Inventário atualizado
com tamanho de fonte, não tamanho transferido, minificado, comprimido ou CSS efetivamente usado.

## Validação e limites

271 testes Node, TypeScript e build aprovados no CI final; testes locais e build
também passaram. Nenhuma regra funcional de cadastro/autorização foi alterada.

Comparação local por AST com o PostCSS já instalado: as 86 regras ativas restantes da
cauda global e as 20 regras restantes da fundação responsiva mantêm seletores,
declarações ordenadas e contextos @media exatamente iguais à base. A comparação
exclui somente as famílias aposentadas e a dimensão da marca comprovadamente sobreposta.
A fundação do foco também foi corrigida de forma intencional: a regra global
:where(...):focus-visible perdia em especificidade para .field input{outline:none}.
Acrescentados .field input:focus-visible e .field select:focus-visible ao mesmo bloco
de outline, para o foco por teclado ficar visível em login e formulários legados.
Não foram duplicadas as declarações. As demais regras da cascata permanecem intactas.

Navegador: mantidas jornadas de cadastro, consentimentos, editor de cantor/músico e
perfil público. Acrescentadas verificações de dimensões/SVG da marca, login com layout
responsivo, fonte mobile, altura de campo, foco e overflow em 360/768/1280 px.
Sem novas dependências de produção; não se afirma que todos os CSS restantes são necessários
nem que todo CSS legado foi migrado. O inventário é ponto de partida, não ferramenta
para exclusão automática de seletores ou de temas dinâmicos.

## Continuidade

Próxima etapa: medir bundles e carregamento inicial das telas principais, priorizar
componentes pesados e consultas repetidas com evidência antes/depois. Limpeza CSS
continua incremental junto às telas que forem alteradas. Estimativa restante de 4–8
entregas para o escopo original, sujeita às verificações de jornadas e segurança.
Sem deploy, banco, credenciais ou mudanças em autorização; auto deploy desabilitado.

## Evidências finais e checkpoint

Implementação validada: `30cca27d4c6a23fb666cfd94d30c7d33fb37b9ae`.

- [Diff aplicado](https://github.com/phantomblastkk/stage-flow/compare/5e55208770cc4422506e7d9c1bb12c58f6ac7575...30cca27d4c6a23fb666cfd94d30c7d33fb37b9ae).
- [Integration and build aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40988363659): cadastro, login, agenda e financeiro em navegador com APIs sintéticas. PASS global CSS cascade em 360/768/1280 px.
- [Operational UX aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40988363580): 271 testes, TypeScript, build, isolamento em PostgreSQL temporário e jornadas dos editores/perfis/marketplace/moderação.
- Artefato agenda-finance-browser-evidence ID 12947569894: três novas capturas public-login-cascade. Revisadas login 360/1280 e cadastro 360. Foco, layout e dimensões finais de marca aprovados.
- Artefato operational-ux-evidence ID 12947359696: evidências das jornadas existentes, todas aprovadas.
- Primeira alteração retirou folhas/regras mortas; segundo commit corrigiu a prioridade do foco no formulário legado. A validação final cobre os dois. Não se afirma equivalência visual do foco: essa mudança é intencional para acessibilidade.
- Estado de produto: StageFlow, Next App Router/TypeScript/Supabase/Vercel; main direta; auto deploy desabilitado; sem deploy manual, SQL, dados ou credenciais nesta parte.
- Continuidade: Parte 48 deve medir os bundles e carregamento inicial antes de escolher otimizações. CSS segue com 62 folhas; não considerar limpeza integral concluída. Manter temas dinâmicos, contratos de RPC e alterações concorrentes; conferir a main atual antes de editar.
