# Contrato proposto — paginação de contratação v1

Estado: desenho técnico, sem RPC nova instalada, sem migration aplicada e sem
ativação no frontend. Não substituir as RPCs atuais apenas adicionando range/limit
sobre o JSON já agregado: isso não recupera registros além dos limites internos.

## Operações propostas

| Operação futura | Entrada | Ordem e escopo |
|---|---|---|
| stage_hiring_threads_page | cursor opcional, page_size (padrão 20, máximo 50) | last_message_at DESC, id DESC; participante autenticado |
| stage_hiring_messages_page | thread_id, cursor anterior opcional, page_size (padrão 50, máximo 100) | created_at DESC, id DESC; participante da conversa |
| leitura individual de conversa | thread_id | Confirma participação e retorna cabeçalho sem exigir que esteja na primeira página |
| confirmação de leitura | thread_id e marcador de mensagem efetivamente recebida | Mutação separada da consulta de histórico; validar marcador e participante |

Nomes são propostas, não endpoints disponíveis hoje. Uma página deve retornar
status, items, has_more, next_cursor e versão do contrato. Buscar page_size + 1
registros para determinar has_more; não calcular total global em cada polling.
Items vazios só equivalem a fim de histórico se status ok e has_more false.

## Cursor e ordenação

- Cursor versionado inclui timestamp completo e UUID de desempate. Preservar
  microssegundos do PostgreSQL; não converter o cursor com Date/toISOString.
- Ordenação por duas colunas e predicado de continuação devem ser idênticos.
  Para ordem descendente, continuar estritamente antes do par timestamp/UUID.
- Mensagens voltam da consulta em ordem descendente, mas o cliente apresenta cada
  conjunto mesclado em ordem cronológica, deduplicado por ID.
- Validar tamanho, versão, timestamp e UUID antes de construir o predicado.
  Cursor é dado de paginação, nunca prova de autorização.

## Concorrência

last_message_at é mutável. Uma inbox viva não é um snapshot imutável: mudanças
podem mover conversas entre páginas. Atualizar a lista deve reiniciar o cursor e
preservar a seleção por ID; não prometer completude de snapshot nem concatenar
silenciosamente páginas antigas com uma ordenação nova. Deduplicar IDs.
Se completude consistente durante múltiplas páginas for obrigatória, projetar
snapshot/materialização versionada separadamente; as_of sozinho não resolve
linhas cujo last_message_at mudou depois da primeira leitura.

Para mensagens, preservar âncora de rolagem ao inserir mensagens anteriores.
A navegação do histórico não deve marcar mensagens novas não vistas como lidas.
A RPC antiga de mensagens marca leitura na consulta; não reutilizar esse efeito
indiscriminadamente na futura busca de páginas anteriores.

## Segurança e implantação

Cada chamada deve validar auth.uid() e participação real, mesmo com cursor válido.
Não ler tabelas privadas diretamente do navegador. Negar execução anônima e
preservar grants/RLS, auditoria e isolamento entre participantes. Revisar funções
SECURITY DEFINER individualmente; não ampliar privilégios para corrigir erros.

Manter as assinaturas legadas. Antes de habilitar a nova API: implementar e testar
em PostgreSQL temporário, verificar índices existentes antes de propor novos,
EXPLAIN com volumes representativos, revisar limites/planos e executar testes de
isolamento. Aplicação em banco e deploy permanecem ações separadas e autorizadas.
Não fazer fallback de forbidden/erro de rede para uma API mais permissiva.

## Aceitação mínima

Testar empates de timestamp, microssegundos, inserções durante paginação, cursor
inválido, mudança de conta, conversa alheia, ausência de sessão, última página,
retry sem duplicação e preservação do item selecionado. Medir consultas, bytes,
latência e custo sob concorrência antes de alegar escala para 100 mil usuários.
