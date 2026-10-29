# StageFlow — Parte 28: campos e contratação na edição de cantor

Base: `015b392623219bffe391677023cceab1b55dbbd3`, diretamente na main.

## Problema → impacto → implementação

| Problema | Impacto | Solução aplicada |
|---|---|---|
| Sete campos repetiam estrutura e estilos legados | Manutenção duplicada e ajuda sem vínculo acessível | Seis Input e um Textarea do Design System, preservando IDs e atributos |
| Salvar/reservar @, carregamento e feedback tinham apresentação própria | Estados e alvos divergentes do editor instrumental | Button, LoadingState e InlineNotice compartilhados |
| Instagram recém-salvo não atualizava config usada pelo contato | Opção Instagram seguia bloqueada até recarregar | Sincronização local de instagram_url somente no ramo de resposta saved da RPC |
| Modo de formulário do cantor não tinha cenário de navegador novo | Pré-requisitos podiam regredir sem evidência da jornada real | Conta somente cantor na rota real, formulário bloqueado até habilitar pedidos |

## Diff aplicado

- components/artist-profile-editor.tsx: campos de @, assinatura, biografia, cidade,
  Instagram, YouTube e Spotify; ações de reservar/salvar, loading e mensagens.
  No sucesso de salvar perfil, atualiza somente instagram_url na config local.
- app/meu-perfil-artistico/singer-unified-editor.css: layout local dos novos campos,
  feedback, resize do textarea, labels/ajuda legíveis e inputs a 16 px no celular.
- tests/browser/operational-home.mjs: fixtures de cantor ativadas somente após a
  jornada de músico existente, recarregando /perfil-artistico?aba=dados; três novos
  cenários compostos em 360/768/1280 px e capturas do editor e contratação.

Diff: `git diff 015b392 -- components/artist-profile-editor.tsx app/meu-perfil-artistico/singer-unified-editor.css tests/browser/operational-home.mjs`.

## Preservado

Parâmetros e validações das RPCs de perfil, reserva de @, upload e recebimento de
pedidos. A comparação textual da lógica anterior ao primeiro retorno de renderização
confirmou que a única mudança é a atualização local de Instagram no sucesso. Não
há atualização dessa config ao digitar ou quando o servidor rejeita o salvamento.

Nome, identidade, @ único, bloqueio de publicação sem @ e confirmação explícita de
salvamento permanecem. Inputs conservam values, onChange, required, pattern,
minLength/maxLength, type=url, IDs e limites da biografia. O alvo artist-edit-bio
continua existindo como wrapper para navegação/rolagem, agora com label do textarea
associado pelo htmlFor gerado no componente compartilhado.

Button mantém submit explícito e bloqueio durante saving/upload. Formulário de
contratação do cantor depende de bookingEnabled e autorização da RPC como antes;
Instagram depende do link salvo. Nenhuma chamada extra para publicar ou contratar.

## Medição e limite

Atributos style no componente, por AST: 32 → 26 (seis removidos). O editor de cantor
ainda possui controles e estilos legados, incluindo fotos, cores, publicação,
prévia e recursos avançados. Não houve migração integral ou ganho de bundle medido.
Sem novas dependências, hooks, listeners ou alteração de fronteira server/client.
A UI dos componentes compartilhados de contratação foi preservada nesta etapa.

## Verificação

- 265 testes Node aprovados localmente; TypeScript, build e CI em validação.
- Teste do cantor: sem @, publicação fica bloqueada; reserva rejeitada por @ ocupado,
  nova tentativa aceita e normalização para minúsculas preservada.
- Campos compartilhados e aria-describedby da biografia; validação nativa de URL;
  erro invalid_link simulado ao salvar, retry e payload completo do perfil privado.
- Instagram de contratação permanece bloqueado ao digitar e após salvar com erro;
  só desbloqueia depois da resposta saved, sem recarregar a página.
- Opção Formulário StageFlow permanece bloqueada antes de habilitar pedidos;
  habilitação e escolha do contato usam as mesmas RPCs, com kind=singer.
- Ações de contato não geram novas gravações/publicação do perfil. Overflow e
  capturas em três larguras. Nenhum servidor real de conta ou banco acessado.
- Os cenários anteriores de músico, preferências, uploads, navegação, financeiro e
  equipes permanecem; a fixture de cantor é usada apenas ao final de cada largura.

## Continuidade

Migrar uploads, aparência e publicação do editor de cantor, preservando as imagens
públicas, a validação de arquivos, o wizard e as condições dos recursos avançados.
A padronização da plataforma continua parcial. Próximas alterações devem conferir
novamente a main, pois outras sessões trabalham no mesmo projeto.

Sem deploy, SQL, credenciais, pagamentos, envio de mensagens ou mudança de permissão.
