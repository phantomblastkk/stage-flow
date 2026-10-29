# StageFlow — Parte 25: controles compartilhados no editor instrumental

Base: `d7c1b4fd2d778660dad3970556ef4e184ae8c815`, diretamente na main.

## Problema → impacto → implementação

| Problema | Impacto | Solução aplicada |
|---|---|---|
| Campos nativos repetiam estrutura e estilo | Manutenção duplicada e foco/ajuda inconsistentes | 13 Input e 3 Textarea do Design System |
| Textos de ajuda não estavam ligados aos controles | Leitores de tela podiam perder instruções e contagem | hint com aria-describedby, IDs existentes preservados |
| Textareas repetiam fieldStyle no JSX | Estilo de formulário duplicado | Objeto removido; textarea compartilhado e regra local de resize vertical |
| Salvamento, remoção de imagem e compartilhamento usavam botões legados | Dimensões e feedback de ação divergentes | Button compartilhado, submit explícito, loading e bloqueio durante upload |
| Mensagens e carregamento tinham apresentação própria | Feedback menos consistente | InlineNotice e LoadingState compartilhados |
| Ação de prévia tinha apresentação compacta própria | Alvo de toque pequeno | Classe do Design System, mantendo botão nativo e ref para retorno de foco |

## Escopo e regras preservadas

16 campos migrados: endereço, frase, biografia, cidade, instrumentos, estilos,
apresentação principal, anos de experiência, formatos, destaques, disponibilidade,
vídeos adicionais, Instagram, YouTube, Spotify e cachê de referência.

IDs, values, onChange, required, type, min/max/step, limites de texto, padrões,
normalização do endereço e condições de exibição foram preservados. A comparação
textual do corpo do componente antes do primeiro retorno de renderização confirmou
que hooks, consultas, save, uploadPhoto e regras de negócio continuam idênticos.

Button bloqueia o submit durante saving ou upload como antes. Botões de remoção
continuam type=button pelo padrão do componente compartilhado. Abrir prévia mantém
elemento nativo e ref; os seletores de tema/layout/cor e inputs de upload continuam
específicos deste domínio. A publicação continua exigindo ação explícita.

## Diff

- components/instrumentalist-profile-editor.tsx: substituição dos 16 campos,
  ações, feedback e loading; remoção de fieldStyle e imports de ícones sem uso.
- src/domains/artists/styles/musician-portfolio-editor.css: espaçamento e resize
  dos novos campos, fontes legíveis no celular e estado de carregamento. Tokens
  existentes do Design System, sem alterar as folhas de compatibilidade.
- tests/browser/operational-home.mjs: fixture de gravação e cenário de formulário
  completo em 360/768/1280 px, com erro de validação simulado e nova tentativa.

Diff completo: `git diff d7c1b4f -- components/instrumentalist-profile-editor.tsx src/domains/artists/styles/musician-portfolio-editor.css tests/browser/operational-home.mjs`.

## Medição e limites

Atributos style no componente, contados por AST: 47 → 31 (16 removidos).
O componente ainda tem estilos específicos/inline e não foi migrado integralmente.
As regras globais .field/.btn permanecem porque outros consumidores as utilizam.
Nenhum novo pacote, hook, listener ou requisição em produção. Nenhuma alegação de
melhoria de bundle, gzip, latência ou capacidade de usuários.

## Verificação

- 265 testes Node e TypeScript aprovados localmente.
- Build, CI e evidência de navegador em validação; relatório será atualizado.
- Cenário novo preenche as quatro etapas e confere os valores do payload da mesma
  RPC de gravação. Testa ajuda associada à biografia, validação nativa de URL,
  rejeição simulada invalid_price, mensagem de erro, nova tentativa e sucesso.
- Rascunho permanece privado: p_is_published=false, sem notificar usuários reais.
- Testes anteriores de 18 combinações tema/layout/largura, prévia ampliada,
  teclado, rascunho entre etapas, grupos, convites e isolamento mantidos.
- Revisão React: controles permanecem controlados; props/IDs preservados; apenas
  composição visual, sem mudar fronteira server/client ou efeitos.

## Próximo passo

Migrar apresentação e controles restantes do editor (uploads, grupos de opções,
publicação e prévia) em um bloco separado, preservando foco, teclado e composição
com o perfil artístico único. Continuar depois nos consumidores compartilhados de
.field/.btn por jornada, sem substituição global por busca e troca.

Sem deploy, SQL, mudanças em autenticação, pagamentos, credenciais ou permissões.
