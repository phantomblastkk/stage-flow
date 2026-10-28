# StageFlow — Parte 13: RPCs de leitura paginada

Base: `b80e11716b0ed1994d4c47092b7c5ee636192605`. Branch main.
Sem acesso a homologação, banco remoto ou deploy. Frontend não foi ativado para
estas RPCs. O SQL candidato é aplicado somente no PostgreSQL descartável do CI.

## Código aplicado

`supabase/migrations/20261028035231_booking_cursor_reads_v1.sql`, criada pelo CLI:

- `stage_hiring_threads_page`: páginas de 20 (máximo 50), com mais um registro
  para determinar continuidade; ordenação last_message_at DESC, id DESC.
- `stage_hiring_messages_page`: páginas de 50 (máximo 100), ordenação created_at
  DESC, id DESC; cursor inclui a conversa e preserva microssegundos.
- `stage_hiring_thread`: cabeçalho individual autorizado, inclusive fora da
  primeira página; não depende da lista legada de 80 registros.

Problema: JSON agregado legado corta dados em 80/200 e não fornece continuidade.
Impacto: frontend não consegue abrir conversas antigas nem carregar todo o histórico.
Solução: consultas keyset diretamente nas tabelas, antes da agregação, com limites
explícitos e resposta versionada contendo status, items, has_more e next_cursor.
Os detalhes de conversa são agregados somente após limitar os candidatos da página.

## Segurança e compatibilidade

Cada função lê auth.uid() e verifica participação real. Funções são SECURITY
DEFINER porque as tabelas legadas são RPC-only; não foram concedidos SELECT ou
permissões de tabela a clientes. search_path vazio, relações qualificadas,
EXECUTE negado a PUBLIC/anon e concedido somente a authenticated.

Cursores são dados não confiáveis: versão, tipo, tamanho, data, UUID e conversa
são validados; casts inválidos retornam invalid_cursor. Consulta não concede acesso
por conhecer ID ou cursor. O SQL é transacional, verifica pré-requisitos e pode
ser reaplicado. Nenhuma função antiga, RLS, grant de tabela, índice ou dado real
foi alterado.

As três leituras são STABLE e não atualizam marcadores de leitura. A nova confirmação
de leitura ainda não foi implementada: exige um desenho explícito de marcador
(timestamp/ID, inclusive empates) e autorização. O frontend permanece nas RPCs
antigas, com os avisos de limite da Parte 12; não há fallback permissivo nem
ativação automática de uma API ausente no banco remoto.

## Testes de banco

`.github/workflows/booking-pagination.yml` cria PostgreSQL 17 descartável e usa
somente `tests/booking-db/fixture.sql` e `isolation.sql`. Não utiliza credenciais,
conexões ou scripts de ambientes remotos.

O teste aplica a migration duas vezes e verifica: 85 conversas e 205 mensagens
atravessando os limites legados; timestamp empatado e microssegundos; retry sem
duplicação; última página; vazio; cursor malformado/data impossível/timezone
inválido; cursor de outra conversa; limites de página; os dois participantes;
conta alheia; ausência de sessão; bloqueio anônimo e falta de SELECT direto;
leitura individual antiga; inserção entre páginas; ausência de efeitos em read_at.
As verificações executam com SET ROLE authenticated/anon e rollback.

A fixture reproduz as colunas e índices necessários, não toda a instalação
Supabase. Ela não valida assinatura JWT, PostgREST nem Auth real. Não há PostgreSQL
local disponível neste executor; a execução SQL é verificada no CI descartável.
Advisors remotos não foram executados, para respeitar o escopo sem banco remoto.

- 220 testes Node existentes verificados localmente.
- CI de PostgreSQL 17 aprovado no commit `7e35ce1bbc718650f40ccc5c61e684f10f81b102`, com aplicação dupla e execução das assertions de paginação/isolamento.
- [Suíte de banco aprovada](https://github.com/phantomblastkk/stage-flow/actions/runs/40629818985).
- [CI geral aprovado](https://github.com/phantomblastkk/stage-flow/actions/runs/40629819082): contratos, TypeScript, build e doze cenários de navegador preservados.
- [Diff aplicado](https://github.com/phantomblastkk/stage-flow/compare/b80e11716b0ed1994d4c47092b7c5ee636192605...7e35ce1bbc718650f40ccc5c61e684f10f81b102).

## Performance e limites

O índice legado de mensagens já corresponde a thread_id/created_at DESC/id DESC;
não foi duplicado. Os índices de participantes conhecidos cobrem o prefixo
participante/last_message_at; um índice com UUID de desempate e o custo da condição
OR precisam de EXPLAIN e dados representativos antes de propor índices adicionais.
Não há benchmark nem garantia de escala para 100 mil usuários nesta entrega.

Inbox usa last_message_at mutável: atualização deve reiniciar cursor e deduplicar,
não prometer snapshot consistente durante mudanças concorrentes. Mensagens são
retornadas em ordem descendente; o futuro adaptador deve mesclar por ID e apresentar
ordem cronológica sem reconverter o timestamp do cursor.

## Próxima etapa

Adaptador cliente tipado e testes de página/mesclagem, ainda sem ativação remota.
Depois: marcador de leitura, planos de execução e estratégia de índices. Aplicação
no banco e deploy exigem pedido específico; commit na main não os executa.
