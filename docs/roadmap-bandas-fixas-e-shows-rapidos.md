# Roadmap futura — vínculos fixos de músicos e cadastro rápido de shows

Estas ideias foram solicitadas como **melhorias para depois** e NÃO são parte do marketplace em construção. Não alterar dados ou regras atuais sem nova autorização.

## 1. Músico fixo de um grupo / banda

Exemplos de grupos mencionados: **Bolinha Santos** e **Pegada Top**.

Fluxo futuro proposto:

- O perfil de um músico poderá indicar em quais bandas/grupos ele toca de forma **fixa** e qual seu instrumento/função (por exemplo, pandeirista fixo do grupo Bolinha Santos).
- O vínculo deverá ter comprovação/aceitação dos dois lados: convite da banda, aprovação do músico ou outra confirmação bilateral; nenhum outro usuário poderá declarar unilateralmente que o músico integra uma banda.
- Um grupo poderá manter uma formação padrão persistente e organizar shows dessa banda sem convidar manualmente todos os fixos a cada evento, mas os convites/participações continuarão controlados por permissões explícitas e regras de consentimento.
- No perfil público do músico, será possível mostrar **"Músico fixo do grupo X"**, apenas após aprovação e opção de divulgação.
- Quando shows forem atribuídos à formação, os compromissos confirmados de cada músico deverão entrar em sua disponibilidade, **sem expor na busca os detalhes privados** de locais, contratantes ou cachês.
- Para evitar choque de agenda, bloquear aceites para **intervalos de tempo que se sobrepõem** a shows já confirmados do músico. Definir antes do desenvolvimento: evento que passa da meia-noite, fuso, folga/deslocamento, exceções e mudança/cancelamento de horário.
- O bloqueio precisa ocorrer no **backend**, dentro da mesma transação que confirma o compromisso, para evitar conflito mesmo com dois convites aceitos simultaneamente.
- Não considerar músico "ocupado" apenas porque recebeu um convite pendente; definir estado correto de reserva/confirmação.
- A data indisponível declarada no marketplace é um recurso atual e **não** equivale a checagem de choque de horários. Ainda não sincroniza banda fixa.

## 2. Cadastro de show simplificado com horários pré-selecionados

Fluxo futuro proposto:

- Permitir criar show rapidamente sem pedir todos os detalhes logo no começo.
- Oferecer **chips ou caixas de seleção de horários comuns** para começar (por exemplo, 14h, 18h, 20h e 22h), com edição manual opcional.
- Oferecer duração pré-selecionada (por exemplo, 1h, 1h30, 2h, 3h ou 4h), calculando automaticamente horário final quando desejar.
- Alternativamente, marcar **"Horário a definir"**, criando rascunho privado e exigindo confirmação do horário antes de convidar músicos ou publicar. Isso precisará de planejamento no schema, pois \`events.starts_at\` atualmente é obrigatório.
- Reduzir campos obrigatórios de entrada inicial, deixando local, equipe e cachês para completar após criar o show.
- Os padrões são apenas sugestões rápidas; horários nunca devem ser assumidos como acordados sem confirmação.

## Prioridade

**Aguardar autorização futura.** Por enquanto, continuar construindo o marketplace em área privada e manter sua rota pública em **"Em breve"**.
