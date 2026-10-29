# StageFlow — Parte 27: preferências de contratação e Marketplace

Base: `2be6389305363355a5130782444b692959d83387`, diretamente na main.

## Problema → impacto → solução

| Problema | Impacto | Implementação |
|---|---|---|
| Contato com erro de leitura ainda mostrava opções padrão graváveis | Risco de sobrescrever uma preferência que não foi consultada | Estado de falha com retry; edição/salvamento só após leitura válida |
| Marketplace mostrava instrução SQL ou formulário bloqueado ao falhar | Usuário sem recuperação e mensagens técnicas no fluxo | Falha recuperável separada de indisponibilidade por função |
| Componentes tinham botões/campos/feedback próprios | Duplicação de CSS, foco e dimensões inconsistentes | Button/Input/Textarea/Select/LoadingState/EmptyState/InlineNotice/Badge compartilhados |
| Contato é renderizado dentro do formulário do perfil | Enter no telefone podia enviar o formulário pai | Enter nos inputs desse bloco não envia o perfil; botão Salvar contato continua explícito |
| Confirmação dizia que o botão apareceria mesmo após escolher Não exibir contato | Mensagem contraditória sobre privacidade | Confirmação específica de que o botão está oculto, testada após salvar off |
| Texto de lançamento futuro e aviso em breve no editor | Contradição com a descoberta do Marketplace | Texto de preferências e link Explorar Marketplace, sem prometer publicação automática |
| Rejeição de requisição podia deixar carregamento ocupado | Fluxo sem recuperação | try/catch/finally em leitura e gravação, mensagens de erro seguras |

## Diff

- components/booking-contact-settings.tsx: leitura com falha/retry, controles
  compartilhados, fieldset para as opções e bloqueio durante gravação. Proteção
  contra submit do formulário pai ao pressionar Enter em inputs; textarea mantém
  quebra de linha e botão mantém acionamento por teclado.
- components/marketplace-musician-settings.tsx: retry de leitura, distinção de conta
  sem função aplicável, controles compartilhados, mensagens e textos atuais.
- Folhas CSS dos dois componentes: tokens e layout local, sem estilos próprios de
  botões/campos/alertas que já pertencem ao Design System.
- components/instrumentalist-profile-editor.tsx: somente texto “futuro marketplace”
  substituído por “Marketplace” no bloco de desempenho.
- tests/browser/operational-home.mjs: preferências com erro de leitura, recuperação,
  validação, envio explícito, dados gravados e ausência de submissão do perfil pai.

Diff: `git diff 2be6389 -- components/booking-contact-settings* components/marketplace-musician-settings* components/instrumentalist-profile-editor.tsx tests/browser/operational-home.mjs`.

## Contratos preservados

As mesmas RPCs e parâmetros são usados: stage_my_booking_contact,
stage_save_booking_contact (kind/mode/phone/greeting), stage_my_marketplace_settings
e stage_save_marketplace_settings (listed/availability_mode/blocked_dates).
Nenhum SQL, regra RLS, modo de contato, origem do telefone ou padrão de consentimento
foi alterado. WhatsApp continua publicado apenas na opção explícita de contato;
telefone privado da conta não é puxado por esta mudança.

Os modos auto/whatsapp/instagram/off e form apenas para cantor continuam iguais;
Instagram sem link e formulário do cantor sem ativação continuam impedindo gravação.
Datas permanecem limitadas a 45, sem duplicatas, entre hoje e 366 dias. Disponibilidade
não confirma agenda. A RPC continua exigindo perfil publicado para autorizar listed.
Os textos respeitam essa restrição e as condições do catálogo; não liberam catálogo,
não ativam participação, não publicam perfil nem alteram preços.

Read retry executa somente a consulta original, mediante ação do usuário; mensagens
não expõem SQL ou erros técnicos de infraestrutura. Requests pendentes de leitura
ignoram resposta de componente desmontado. Busy bloqueia campos/opções de contato.

## CSS e limites

Duas folhas: 7.373 → 5.725 bytes UTF-8 (menos 1.648 bytes, 22,4%). Isso mede arquivo
fonte, não bundle, gzip ou latência. Ambas usam tokens existentes para cores, foco,
espaçamento e superfícies, com regras locais apenas para composição. Sem novas
dependências. As folhas globais de compatibilidade permanecem intactas.

## Verificação

- 265 testes Node, TypeScript e build aprovados localmente. Revisão final no commit
  `6ba399628d42b71b38a62d91096c60842fb573a0`, com ambos os workflows aprovados:
  [Integration and build](https://github.com/phantomblastkk/stage-flow/actions/runs/40813274057)
  e [Operational UX](https://github.com/phantomblastkk/stage-flow/actions/runs/40813274053).
  O operacional também aprovou os 265 testes e PostgreSQL temporário.
- Três cenários novos de preferências passaram (360/768/1280 px), além dos anteriores
  de uploads, formulário, temas e jornada operacional. Evidência:
  [42 PNGs e log](https://github.com/phantomblastkk/stage-flow/actions/runs/40813274053/artifacts/12870729516).
  Inspeção visual das opções de contato e Marketplace em 360/1280 px; confirmação
  final específica de contato oculto conferida na nova captura. Os campos WhatsApp
  foram exercitados por automação; capturas finais mostram a opção off salva.
  Capturas de página inteira incluem controles fixos do workspace. Sem Safari físico.
- Os 24 cenários PASS de agenda-finance continuam aprovados:
  [Artefato](https://github.com/phantomblastkk/stage-flow/actions/runs/40813274057/artifacts/12871845457).
  Retenção de sete dias para artefatos de navegador.
- Novo cenário em 360/768/1280 px: falha de leitura impede salvar preferências
  desconhecidas, retry recupera o WhatsApp armazenado, Enter no telefone não grava
  perfil/contato, invalid_phone mostra erro e nova tentativa salva os mesmos parâmetros.
- Controles ficam bloqueados durante uma gravação de contato artificialmente
  demorada. Modo off envia phone=null e greeting vazio.
- Marketplace não vem marcado por padrão; data passada é rejeitada, repetida não
  duplica, edições de datas não submetem o formulário, listed com perfil não publicado
  recebe rejeição simulada; desativação explícita salva disponibilidade e datas.
- As ações de preferências não geram novas chamadas de gravação/publicação do perfil.
  Verificação de overflow e capturas por bloco. Todas as APIs são fixtures sintéticas.
- Jornada de navegador nova cobre o músico; modos exclusivos de cantor conservam
  seus condicionais e contratos, sem teste novo de navegador específico para cantor.
- Checklist React: estados mínimos para erro/retry; efeitos dependem de kind/reload
  ou reload; sem novos listeners globais ou mudança server/client.

## Continuidade

Validar a mesma composição na edição de cantor e seguir para os demais consumidores
de controles legados por jornada. A padronização global permanece parcial. Backend
de WhatsApp único/verificação e provedor não são parte desta migração de UI.

Sem deploy, banco de produção, credenciais, envio de mensagens ou pagamentos.
