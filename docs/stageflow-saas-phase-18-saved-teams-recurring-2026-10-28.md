# StageFlow — Parte 18: formações salvas e shows recorrentes

Base: `0e7fbb9019b28ef4b24b09c9dbc06fc63ff3888d`, diretamente na main.
Sem deploy, migrations, banco remoto ou envio de mensagens reais.

## Problema → impacto → alteração aplicada

| Problema | Impacto | Solução |
|---|---|---|
| Página de equipes tinha 67 atributos style e um objeto de estilo para campos | Aparência e manutenção dispersas no JSX | equipes.css com classes locais; zero style inline e remoção de fieldStyle |
| Campos e ações com controles próprios | Foco, labels e dimensões divergiam das demais telas | Button/Input/Select/Textarea/InlineNotice/LoadingState compartilhados |
| Programação com falha de leitura também mostrava lista vazia | Usuário podia entender que seus dados sumiram | EmptyState de indisponibilidade com tentativa de recuperação; lista vazia só após leitura válida |
| Atualizar programação não tratava rejeição de load | Falha podia virar erro não tratado no navegador | refreshList com loading, catch e finally; carregamento explícito durante a recuperação |
| Pausar/reativar era botão apenas com ícone e title | Nome pouco claro para leitores de tela | aria-label inclui ação e nome da programação; alvo mínimo 44 px |
| Estado ativa/pausada e cores próprias | Inconsistência com a Agenda | StatusChip e tokens semânticos |
| Títulos longos dividiam espaço com ações | Texto podia ficar comprimido em painéis estreitos | Bases flexíveis para cabeçalhos, quebra de texto e campos com min-width 0 |

## Comportamento preservado

- Criação/edição/exclusão de formações mantém RPCs, parâmetros e validações.
- Adicionar músico a uma formação não cria convite nem compromisso permanente.
- Remover músico/excluir equipe mantém convites anteriores; confirmação explícita preservada.
- Equipe é privada e seleciona músicos com vínculo profissional prévio.
- Convite para show mantém confirmação e negociação individual de cachê.
- Programação cria rascunhos; não publica show nem convida automaticamente.
- Pausar não apaga shows ou convites já criados; gerar datas mantém as regras do backend.
- Limites de temporada, lote e quantidade permanecem no banco e no fluxo existente.
- Alteração de dados financeiros, permissões e schema não faz parte desta etapa.

## Medição

AST TypeScript: app/equipes/page.tsx, 67 → 0 atributos style.
Shows recorrentes já não tinha style inline: os controles e a folha local foram migrados.
As duas folhas locais não usam hexadecimais ou variáveis de cor legadas.
Uma folha adicionada para substituir estilos inline, sem dependências novas.
Não há alegação de ganho medido de latência ou redução equivalente de bundle.
CSS global e outras rotas ainda têm consumidores legados: migração geral segue parcial.

## Validação

- 262 testes Node, TypeScript e build de produção passaram localmente.
- Mantidos os quinze cenários de navegador existentes; três cenários compostos
  adicionados em 360/768/1280 px com API totalmente sintética.
- Formações: nome duplicado, criar, adicionar integrante, editar, selecionar show,
  convite cancelado/confirmado, remover integrante e excluir equipe sem apagar convites anteriores.
- Recorrentes: falha de leitura inicial e repetida, recuperação, lista vazia válida,
  erro retornado na criação, oito rascunhos, pausa cancelada/confirmada, reativação,
  geração sem novas datas e convite explícito de uma única ocorrência.
- Overflow, largura legível dos cabeçalhos, tamanho de campo no celular,
  alvo mínimo de toque e contraste do aviso de erro nos estados exercitados.
- Revisão React: sem novos efeitos ou dependências; refresh reutiliza o carregamento
  existente e trata falhas de atualização sem novas consultas paralelas.
- CI aprovado no commit integrado `ed1f19716735f5f6e96b820548a2d4459673a92d`:
  [Integration and build](https://github.com/phantomblastkk/stage-flow/actions/runs/40736155572)
  e [Operational UX](https://github.com/phantomblastkk/stage-flow/actions/runs/40736155745).
- Dezoito cenários de navegador passaram, incluindo as três larguras da Parte 18.
  [Evidências finais](https://github.com/phantomblastkk/stage-flow/actions/runs/40736155572/artifacts/12838025954).
- Inspeção visual das telas de equipes e recorrentes em 360/1280 px realizada
  nas [capturas da mesma implementação de UI](https://github.com/phantomblastkk/stage-flow/actions/runs/40735467887/artifacts/12837112501):
  48 PNGs e log do servidor, com retenção de sete dias. Cabeçalhos, campos,
  integrantes e ações permanecem dentro dos cards; elementos fixos aparecem
  na posição da viewport nas capturas de páginas longas.
- O teste de remoção de integrante usa o nome acessível completo do botão.
  Também foi estabilizada a ativação de salvar casa no teste operacional de perfis:
  foco explícito + Enter no botão submit, preservando validade do formulário e
  assertivas de RPC/payload. Nenhum código de produção de perfis foi alterado.
- [Diff completo](https://github.com/phantomblastkk/stage-flow/compare/0e7fbb9019b28ef4b24b09c9dbc06fc63ff3888d...ed1f19716735f5f6e96b820548a2d4459673a92d).

Os cenários confirmam apresentação e integração com respostas simuladas. A idempotência,
os limites e a autorização reais do banco continuam cobertos pelos contratos existentes;
esta etapa não executa operações no Supabase remoto.

## Continuidade

O conjunto operacional principal agora usa os controles compartilhados nas telas
migradas. Próxima fatia: conferir consumidores globais em configurações/assinatura
antes de retirar seletores ainda utilizados. Não apagar estilos globais por contagem de arquivos.
