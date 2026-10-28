# StageFlow — Parte 24: folhas do portfólio e validação dos temas

Base atualizada: `8883fcd95a83b86d0747e4e17f6f1f5156aed74e`, diretamente na main.
As Partes 21–23 de outra sessão já extraíram a base do portfólio, perfil gratuito,
autenticação e cadastro. Essas alterações foram preservadas integralmente. O trabalho
inicial ainda não publicado deste chat foi reconciliado com essa main antes do commit;
a extração anterior não é apresentada como novidade desta etapa.

## Problema → impacto → implementação

| Problema | Impacto | Solução aplicada |
|---|---|---|
| Componente de editor importava CSS de uma rota legada | Dependência entre componente reutilizável e página | Folha movida para src/domains/artists/styles |
| Apresentação do portfólio permanecia fora do domínio | Estilos do mesmo recurso em três estruturas | Folha de apresentação no domínio artists ao lado da base existente |
| Contratos só conferiam presença das classes de temas | Ausência de prova visual da cascata após extrações | Combinações reais de três temas e dois layouts em três larguras pelo editor |
| Prévia ampliada não exercitada nesta jornada operacional | Risco de regressão de layout, teclado ou publicação acidental | Prévia ampliada, avatar circular, overflow, Escape/retorno de foco e ausência de gravação verificados |

## Diff aplicado

- components/musician-portfolio-polish.css →
  src/domains/artists/styles/musician-portfolio.css: arquivo idêntico, 29.648 bytes.
- app/meu-portfolio/musician-portfolio-editor.css →
  src/domains/artists/styles/musician-portfolio-editor.css: arquivo idêntico, 9.621 bytes.
- components/musician-portfolio-view.tsx e instrumentalist-profile-editor.tsx:
  somente caminhos de imports CSS; JSX, hooks, formulários, handlers e RPCs intactos.
- Quatro arquivos de testes atualizam somente os caminhos das folhas movidas,
  mantendo todas as asserções anteriores.
- tests/browser/operational-home.mjs: seleção por teclado dos três temas × dois
  layouts, prévia compacta e ampliada, screenshots e retorno de foco em 360/768/1280 px.

Reproduzir diff: `git diff 8883fcd -- components app/meu-portfolio src/domains/artists tests`.

## Cascata e limites

Nenhuma regra CSS foi alterada ou removida nesta etapa. As duas folhas foram
comparadas byte a byte com a main atual. Ordem de imports do layout e oito segmentos
extraídos nas Partes 21–23 permanecem intactos; teste de recomposição integral
continua exigindo hash `eee026ce` e comprimento 48.480 caracteres.

As folhas da apresentação e do editor continuam importadas pelos mesmos componentes,
com caminhos estáticos. Não houve novo carregamento global nem nova dependência.
39.269 bytes de fonte foram reorganizados; redução líquida de CSS nesta etapa: zero.
Não há alegação de melhoria de bundle, gzip, latência ou capacidade de usuários.

As cinco classes candidatas da revisão inicial (mp-location, mp-hero-type,
mp-work-pending, mp-public-wrap, mp-public-head) não foram excluídas após a
reconciliação: continuam no contrato integral atual e ficam para limpeza própria,
com comparação explícita do conjunto de regras antes de atualizar o contrato.
Classes dinâmicas mp-theme-ivory/mp-theme-stage/mp-layout-minimal foram preservadas.

## Validação

- Testes Node, TypeScript, build e CI: em validação; evidência final será atualizada.
- Suíte operacional ampliada: Midnight, Ivory, Stage × Destaque, Minimalista;
  variáveis de tema e composição flex, classes dinâmicas e overflow por combinação.
- Prévia ampliada do último tema/layout, avatar circular, Escape e retorno de foco;
  alterações locais não podem salvar nem publicar perfis.
- Cenários existentes de wizard, rascunho de instrumentos, teclado mobile,
  dashboard, grupos, disponibilidade e convite mantidos.
- Revisão React: apenas imports CSS em dois componentes, sem novos hooks,
  listeners, queries, fronteira server/client ou dependências.
- Testes usam fixture sintética example.supabase.co. Nenhum usuário real,
  notificação ou publicação é acionado.

## Continuidade

1. Confirmar os dois workflows no commit desta etapa e revisar as novas capturas.
2. Migrar consumidores de .btn/.field/.feature por jornada para o Design System;
   o editor instrumental ainda possui controles legados e estilos inline.
3. Revisar os candidatos sem uso em uma alteração própria, mantendo equivalência
   de todas as regras que sobreviverem e a ordem da cascata.

Sem deploy. Sem SQL, alteração de credencial, autorização, pagamento ou configuração
Vercel. A padronização de CSS e componentes continua parcial.
