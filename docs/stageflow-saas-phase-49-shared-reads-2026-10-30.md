# Parte 49 — Leituras compartilhadas no Dashboard e atualização seletiva de favoritos

Base de produto: `8fefd00c43860e6d95c72bec687b6171c69a69f1`.
Medição anterior às mudanças de produto instrumentada em commits de teste na main;
a base estabilizada da medição é f6b421ca0bb9c5606da186ac855a3f691ccbee36.

## Problema, impacto e solução aplicada

No Dashboard, avatar, progresso do perfil e guia inicial tinham leituras próprias
para os mesmos RPCs. Isso repetia consultas e permitia que os indicadores da mesma
tela usassem snapshots diferentes.

Criado `dashboard-artist-data.tsx`, provider limitado à página e identidade Auth
(id + epoch + papéis). Uma leitura por tipo necessário abastece os três consumidores.
Há cancelamento ao desmontar, coalescência de leituras concorrentes, erros genéricos
e nova tentativa explícita. O estado não é salvo em storage, não é global e não é
usado para conceder acesso. Reentrar no Dashboard faz uma nova leitura. Para conta
com papéis de cantor e músico, cada tipo tem snapshot/RPC próprio; não se mistura
portfólio de músico com dados do cantor.

- `app/painel/page.tsx`: usa o snapshot para a foto, preservando a validação do caminho/origem.
- `profile-readiness.tsx`: calcula progresso a partir do mesmo snapshot, sem RPC próprio.
- `first-session-guide.tsx`: usa esse snapshot e atualiza-o ao reabrir/retentar o guia;
  o caminho de organizador continua com sua consulta de eventos por producer_id.

No Marketplace, atualizar is_favorite recriava os arrays e disparava a leitura de
identidade, embora só o coração tivesse mudado. Na aba Favoritos, um nonce global
recarregava resultados e destaques após remover um salvo.

- Identidades usam assinatura canônica dos IDs e revisão de respostas do servidor.
- Mapear o estado local de favorito não invalida identidade.
- Novas respostas não vazias de busca/destaques ainda renovam identidades, preservando
  a atualização explícita de dados e a recuperação de erros anteriores.
- Remover favorito na aba específica atualiza a busca por uma revisão própria;
  os destaques recebem o estado local confirmado sem nova consulta de ranking.
- O SQL existente ordena destaques por avaliação/nome/ID, não por quantidade de favoritos.
  Não foi alterado o contrato nem a ordenação do servidor.

## Medição e verificação

`operational-home.mjs` percorre o mesmo cenário antes/depois em 360/768/1280 px:
Dashboard frio, favoritar no catálogo e remover na aba Favoritos. Os JSONs de auditoria
contêm contagens de requisições de API sintética. Não representam EXPLAIN SQL,
latência, custo de CPU ou teste de carga de produção.

A medição inicial foi ajustada para esperar dois frames de renderização, a resposta
específica da busca de favoritos e o estado final de lista vazia. Esperar apenas
networkidle pode retornar antes de o efeito React iniciar a próxima consulta. As
primeiras tentativas de instrumentação não são consideradas evidência final.

A versão final verifica: uma leitura inicial de portfólio do músico para os três
consumidores; erro de leitura sem expor detalhe SQL, retry com uma leitura; nova
leitura ao voltar para o Dashboard; favorito comum sem busca/destaque/identidade;
remoção do último favorito com uma busca e sem reconsultar destaques/identidade
quando os mesmos IDs continuam na vitrine.

310 testes Node e TypeScript locais aprovados; build local aprovado. Resultado final
do CI e tabela de contagens serão registrados após conclusão.

## Limites e continuidade

Não há cache compartilhado entre páginas/contas, nenhum dado privado persistido,
mudança em Auth, RLS, banco, realtime ou confirmação de salvamento. Não se afirma
que todas as consultas do Dashboard/Marketplace foram eliminadas ou otimizadas.
Os outros resumos e contadores mantêm seus contratos de atualização existentes.

Próxima parte: revisar SEO das rotas públicas (metadata, canonical, Open Graph,
sitemap/robots), mantendo rotas privadas fora da indexação. Permanecem pendentes a
revisão final das jornadas/segurança e o cabeçalho financeiro estreito no mobile
identificado na Parte 48. CSS segue incremental; escala de 100 mil usuários ainda
exige verificação do ambiente e testes de carga.

Main direta, sem deploy, credenciais, dados reais ou SQL. Auto deploy desabilitado.
