# Parte 48 — Medição de bundles e painéis sob demanda

Base inicial: `a5fb97f0bbc1d1c0c952898003b294860028904f`. Main sincronizada antes
da publicação e medição repetida em `2f04325b2dcf5c0777c08814e9250e63e8d4d1ad` em 30/10/2026,
preservando as melhorias concorrentes de realtime, chat, perfis e confirmação de salvamento.

## Problema e impacto

A Agenda importava EventTeamInvites estaticamente, incluindo EventBudgetPanel,
embora só montasse o painel após o usuário abrir equipe/convites/financeiro.
Financeiro e Operação também importavam o editor financeiro antes de expandi-lo.
Os formulários opcionais e seus estilos aumentavam os assets iniciais dessas rotas.

## Modificação aplicada

- `app/eventos/page.tsx`: EventTeamInvites via next/dynamic, mantendo a condição
  openTeamEventId e o estado no componente existente. Fallback acessível LoadingState.
- `app/financeiro/page.tsx` e `app/eventos/operacao/page.tsx`: EventBudgetPanel via
  next/dynamic, mantendo as condições de expansão e os props existentes.
- Imports dinâmicos no escopo do módulo, caminhos literais e SSR padrão preservado.
  Não há novo efeito, listener, pacote, cache de dados ou alteração de RPC/autorização.
- `scripts/audit-bundles.mjs`: relatório reproduzível a partir do build, sem dependências
  novas. Soma arquivos únicos da rota e layouts ancestrais, JS e CSS separados.
- `tests/browser/agenda-finance.mjs`: salva bundle-audit.json no artefato do CI;
  verifica que os módulos opcionais estão fora dos manifests iniciais das três rotas.
  Na Agenda, verifica que não há requests desses chunks antes da abertura; segura um
  chunk para validar o loading e a ausência de consultas do painel antes do carregamento.
  Solta o chunk e mantém os testes de equipe, convite e edição financeira existentes.

## Medição antes/depois

Dois builds locais de produção, Next 15.5.28, mesma instalação e configuração.
Baseline na main limpa 2f04325; depois na árvore com as três alterações de importação.
O campo revision do JSON identifica o HEAD base nos dois snapshots, pois a medição
posterior foi feita antes de criar o commit. Não indica que os builds tinham fontes iguais.

Metodologia: app-build-manifest + layouts ancestrais, arquivos únicos por rota;
gzip nível 9 por arquivo, somado. São bytes de artefatos, não medição de transferência
real, tempo de execução, LCP, TTFB ou capacidade para 100 mil usuários. Não inclui
chunks montados pelo runtime, imagens, payload RSC ou consultas. Não somar rotas,
pois compartilham arquivos. Dados completos no JSON desta parte.

| Rota | JS gzip antes | JS gzip depois | Redução | CSS gzip antes → depois |
| --- | ---: | ---: | ---: | ---: |
| /eventos | 203461 B | 194723 B | 8738 B (4,29%) | 22279 → 19090 B |
| /financeiro | 199164 B | 196711 B | 2453 B (1,23%) | 20862 → 19526 B |
| /eventos/operacao | 196219 B | 193134 B | 3085 B (1,57%) | 20736 → 19400 B |

O custo é adiado, não eliminado: abrir o painel pela primeira vez exige carregar seus
chunks e CSS; acessos seguintes aproveitam o cache normal do navegador. Outros bundles
compartilhados tiveram pequenas variações por causa do mapa de chunks: Painel +208 B, Marketplace +128 B, perfil público +132 B gzip JS nos manifests medidos. Não se atribui ganho de performance a essas rotas nem redução de consultas a esta mudança.

## Validação e limites

310 testes Node e os builds locais passaram. CI final e evidências serão registrados
após conclusão. As jornadas existentes cobrem a abertura dos painéis e seus formulários;
a verificação de rede nova é específica da Agenda. Para Financeiro/Operação, a exclusão
do bundle inicial é verificada pelos manifests, sem afirmar que houve medição de rede
individual nas duas rotas. APIs de testes sintéticas; nenhum convite/pagamento real.

Revisão React: estado e lifecycle dos painéis existentes mantidos; o painel continua
sendo desmontado ao fechar, como antes. Loading acessível por status, sem alterações
em foco, consentimento ou confirmação de escrita. Consultas começam ao montar, como
antes; o download assíncrono apenas antecede essa montagem.

## Continuidade

Próxima parte: medir consultas repetidas e carregamento de dados do Dashboard e
Marketplace, corrigindo somente duplicações demonstradas nas jornadas. Depois, SEO
público e fechamento de jornadas/segurança. Estimativa restante de 3–7 entregas para o
escopo original, sujeita aos achados. CSS continua parcial; nenhuma promessa de escala
sem testes de carga e verificação do ambiente real.

Sem deploy; main direta; auto deploy permanece desabilitado; nenhum SQL, dado,
credencial, regra de assinatura ou política de segurança foi alterado.

## Integração da main

- Preservadas as confirmações showSaveFeedback adicionadas nos fluxos de agenda, financeiro e equipe.
- Corrigido um seletor de teste preexistente que encontrava simultaneamente a confirmação local de ativação de músico e o Toast global. O teste agora verifica as duas regiões separadamente, sem remover confirmações da interface.
- Medição refeita na mesma base integrada, antes/depois apenas das importações opcionais; os números preliminares da base a5fb97f foram substituídos.
