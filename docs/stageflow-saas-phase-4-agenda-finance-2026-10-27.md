# StageFlow — Parte 4: Agenda, Financeiro e isolamento de convites

Base verificada: `0f8b0465cd767fc6bd18e1def22ab4e4505c5055`, main.
Partes 1–3 preservadas. Nenhum deploy e nenhuma alteração no banco de produção.

## Problemas → impacto → alterações

| Problema | Impacto | Correção |
|---|---|---|
| Formulário extenso antes do calendário | A consulta da agenda exige rolagem no celular | Cadastro sob Novo show, com foco no título, cancelar e retorno ao botão; calendário acessível com filtro selecionado anunciado e botão limpar |
| Layout genérico dos cartões e campos de data | Ações comprimidas e campos largos em telas estreitas | CSS com escopo `agenda-page`, grade de campos em uma coluna no celular, ações que quebram linha, status visível, alvos de toque maiores |
| Acesso ao banco misturado na página | Mudanças difíceis de testar e respostas atrasadas | `src/domains/events/services/agenda-service.ts` e tipos separados; autenticação validada, consultas independentes em paralelo e AbortSignal para leituras |
| Falha de consulta parecia lista vazia | Usuário poderia entender que perdeu seus shows | Estados separados para erro próprio/participações, repetir consulta; nenhuma sessão descartada por erro transitório de Auth |
| Falta de validação de datas e exclusão sem contagem | Data inválida ou exclusão sem efeito podia aparentar sucesso | Validação anterior à mutação; proprietário vem de Auth; exclusão exige retorno da linha e usa Dialog compartilhado |
| Editor de flyer no carregamento inicial | Código de edição incluído antes de ser necessário | Import dinâmico do editor, carregado quando aberto |
| Oito indicadores e análises antes dos lançamentos | Financeiro excessivamente longo no celular | Quatro indicadores prioritários, demais indicadores e análises expansíveis, filtros com resumo visível e comandos separados |
| Resposta lenta da equipe A após abrir B | Cachês e campos podiam mostrar a equipe errada | Cancelar consulta anterior e ignorar resposta abortada; anunciar carregamento; impedir troca durante gravação |
| Resumo financeiro após falha de consulta | Zeros e estado vazio podiam parecer valores reais | Exibir erro/repetir; bloquear exportação com erro; não renderizar resumo indisponível |

Componentes compartilhados adotados: Button, Input, Textarea, Dialog, EmptyState,
LoadingState, StatusChip e StatCard. Regras financeiras, valores manuais, autorização
Pro e RPCs de pagamento permanecem os contratos existentes. Nada movimenta dinheiro.
Os CSS globais antigos não foram excluídos, pois outras telas ainda os utilizam.

## Banco QA: dependência ausente encontrada e corrigida

Consulta real ao catálogo de funções do QA `zycuprhymoukhnuamtit` mostrou
`stage_accepted_shows()` ausente; `stage_my_invitations` e `stage_respond_invite`
existiam. Aplicada em QA a migração já versionada
`supabase/accepted_shows_agenda_migration.sql`, sem mudar as tabelas ou os dados.

A verificação de privilégios mostrou que revogar somente PUBLIC não eliminava
a concessão direta para `anon` do ambiente. A migração agora revoga explicitamente
PUBLIC **e anon**; essa revogação também foi aplicada em QA.

Resultado confirmado em QA:
- função existe e mantém `search_path` vazio;
- `authenticated` tem EXECUTE; `anon` não tem;
- consulta com identidade sem perfil retorna zero participações;
- teste executado em transação com ROLLBACK;
- advisors de segurança consultados antes e após a alteração, sem ampliar grants.

Não foram criadas contas fictícias no Auth real nem usados convites reais para testes.
A instalação dessa função no banco oficial continua dependendo de release autorizada.

## Verificações automatizadas

- 151 testes Node locais aprovados, incluindo oito testes novos com o cliente PostgREST real e transporte fictício: isolamento por dono, erro parcial, cancelamento, Auth temporariamente indisponível, validação e mutações.
- TypeScript e build Next.js locais aprovados.
- `tests/browser/agenda-finance.mjs`: navegador em 360/768/1280px com API inteiramente simulada, cadastro/erro de datas, cancelamento de exclusão, filtros, isolamento de respostas de equipe e convite → aceite → agenda. Screenshots e log anexados ao CI. O script recusa configuração de Supabase real.
- `.github/workflows/agenda-isolation.yml`: PostgreSQL 17 descartável, migrações reais de convites/cachês/agenda, terceiros sem acesso, bloqueio por cachê pendente, aceite, ausência de duplicação e revogação após cancelamento. Fixtures guardadas por marcador de banco descartável, com ROLLBACK.
- O Chromium não pôde ser baixado neste host; a execução real foi realizada e aprovada no GitHub Actions em 360, 768 e 1280px. As capturas de 360px foram baixadas e inspecionadas; nenhuma rolagem horizontal foi detectada nos testes.

Limites: fixtures do navegador não validam Auth/PostgREST de uma conta real de QA.
O Postgres descartável usa shim de Auth e uma cadeia mínima de migrações, sem os
triggers completos de notificações da homologação. A consulta de QA comprova grants
e isolamento negativo; não certifica sozinha o fluxo completo com sessões reais.

## Evidência de entrega

Implementação: `f9423732a7016750726ed9d35e7ae274eaad3c26`.

Todos os workflows desse commit passaram:
- [Build, testes e navegador](https://github.com/phantomblastkk/stage-flow/actions/runs/40597492777).
- [PostgreSQL descartável: convite, cachê e agenda](https://github.com/phantomblastkk/stage-flow/actions/runs/40597492749).
- [Isolamento de casas existente](https://github.com/phantomblastkk/stage-flow/actions/runs/40597492771).
- [Contratos de segurança existentes](https://github.com/phantomblastkk/stage-flow/actions/runs/40597492736).
- [Seis screenshots e log do servidor](https://github.com/phantomblastkk/stage-flow/actions/runs/40597492777/artifacts/12777581748), retenção de sete dias.

No build local, a rota Agenda passou de aproximadamente 16,8kB para 15,8kB de
código específico após adiar o editor de flyer. O Financeiro incorpora componentes
compartilhados e ficou em 9,66kB; isso não é uma prova de melhoria de latência.
Não foram executados testes de carga.

## Continuidade

1. Testar com sessões Auth de músico e organizador de QA, incluindo notificações.
2. A Agenda ainda carrega o histórico existente: separar consultas por intervalo e
   paginar listas/RPCs antes de alegar adequação para 100 mil contas.
3. Extrair serviços de billing e revisar paginação/performance do Financeiro.
4. Consolidar contexto de conta do shell e páginas legadas, preservando autorização
   no banco e invalidando os dados ao trocar de conta.
