# StageFlow — Parte 29: fotos, cores e publicação do cantor

Base integrada: `a0e9e085e0261442a67f337420a23aba2915b4ea`, diretamente na main.
As mudanças paralelas de barra mobile global e atalho de edição do músico foram
preservadas por fast-forward; não são apresentadas como novidades desta etapa.

## Problema → impacto → solução aplicada

| Problema | Impacto | Implementação |
|---|---|---|
| Uploads com input invisível sobre o rótulo | Interação/foco pouco claros | Input type=file compartilhado, visível, com label/hint e aria-busy |
| Cores com rótulo sem associação formal e botões próprios | Grupo e alvos inconsistentes | Fieldset/legend e Button com aria-pressed e altura mínima de 44 px |
| Layout, prévia e publicação espalhados em estilos inline | Manutenção duplicada | Classes locais com tokens e checkbox nativo com descrição associada |
| Texto de checkbox sugeria ativação antes de salvar | Expectativa incorreta de publicação imediata | Texto explícito de que a escolha só se aplica ao salvar |
| Visibilidade dos painéis definida por style display | Apresentação misturada ao JSX | hidden nos mesmos painéis, mantendo proVisited e conteúdo montado |

## Arquivos e diff

- components/artist-profile-editor.tsx: arquivos, cores, checkbox e ações com
  componentes/classes compartilhados; organização dos estilos estáticos.
- app/meu-perfil-artistico/singer-unified-editor.css: composição local, alvos de
  toque, fieldset, ações, textos de ajuda, prévia e garantia de display:none para
  painéis hidden. Sem mudar os oito arquivos de compatibilidade do layout global.
- tests/singer-public-site.test.mjs: contrato de visibilidade atualizado de inline
  display para hidden, exigindo ambas as condições e preservando proVisited.
- tests/workspace-saas.test.mjs e mobile-editor-wizard.test.mjs: contratos alinhados
  à barra global existente, sem reinserir a barra no sidebar ou ocultá-la ao focar.
  O navegador exige campo visível acima da barra durante foco em viewport baixo.
- tests/browser/operational-home.mjs: Storage simulado distingue stage-artist-public
  de stage-musician-media e mantém validação de pasta do ator/UUID/upsert=false;
  uploads, três cores e ciclo explícito publicar/privado nas três larguras.

Diff: `git diff a0e9e08 -- components/artist-profile-editor.tsx app/meu-perfil-artistico/singer-unified-editor.css tests/singer-public-site.test.mjs tests/browser/operational-home.mjs`.

## Preservado

Comparação textual do componente antes do primeiro retorno de renderização:
hooks, consultas, uploadPhoto, save, reserva de @ e regras de contratação idênticos.
Nenhuma alteração em bucket, permissões, Auth, RLS, assinatura de RPC ou preparação
do retrato. JPG/PNG/WebP até 5 MB, pasta por usuário e UUID, upsert=false e bloqueio
por upload continuam. Remover imagem continua alterando somente o rascunho local.

Apenas selecionar cor, enviar arquivo ou marcar publicação não grava o perfil.
Salvar e publicar continua bloqueado sem @; recursos profissionais continuam
submetidos às mesmas condições. proVisited continua mantendo o editor avançado
montado após a primeira visita, com a mesma prop active; hidden não desmonta campos.
Nenhuma consulta adicional de recursos avançados foi adicionada à jornada.

## Medição e limites

Atributos style, contados por AST: 26 → 3 (23 removidos). Restam somente a cor da
amostra, a variável de cor da prévia e a imagem de capa, todos derivados do estado.
Estilos específicos de paleta e layout continuam no domínio; não há medição de
bundle, gzip ou latência. Outros componentes e CSS da plataforma ainda são legados.

## Validação

- 266 testes Node, TypeScript e build aprovados localmente na main integrada; CI em validação.
- Três novos cenários de aparência em 360/768/1280 px: arquivo visível/focável,
  tipo inválido e mais de 5 MB recusados antes de Storage, retrato JPG simulado,
  envio ocupando controles, capa, prévia com URL da pasta do ator e retirada local
  sem DELETE nem save automático. Tudo usa example.supabase.co e imagens sintéticas.
- Nove prévias de cor: Rosa, Azul e Roxo em três larguras; variáveis de cor,
  aria-pressed, alvos de 44 px e ausência de overflow.
- Sem @, publicação bloqueada; com @ e dados salvos, marcar checkbox não grava,
  Salvar e publicar envia p_is_public=true, desmarcar não grava e Salvar rascunho
  envia false. Link público usa o mesmo /cantor-teste da conta de teste.
- Cenários existentes de cantor (sete campos e pré-requisitos de contato), músico,
  financeiro, preferências e uploads mantidos. Painéis avançados conservam seus
  contratos de visibilidade; não foi acrescentado um teste novo completo do editor Pro.
- Revisão React: sem novo hook/listener/dependência, mesmos controles e handlers,
  botões de opções/remoção type=button e submit explícito nas gravações.

## Continuidade

Revisar recuperação de leitura do editor de cantor e os textos técnicos remanescentes
nos erros de configuração, seguindo depois para controles do editor avançado por
blocos. Conferir sempre a main antes de editar para preservar trabalho paralelo.
A migração geral de CSS e componentes continua parcial.

Sem deploy, migrations, dados de produção, credenciais, mensagens ou pagamentos.
