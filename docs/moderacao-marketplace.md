# Stage Flow | Moderação de perfis e avaliações do marketplace

## Estado de lançamento

**O marketplace permanece privado.** O endereço público \`/marketplace\` continua mostrando apenas **Em breve**. A interface completa permanece em \`/marketplace/preview\` para usuários autorizados. A central de moderação \`/marketplace/moderacao\` só carrega dados para moderadores cadastrados manualmente; acesso por URL não concede permissão.

## O que esta etapa faz

- Botão **Denunciar perfil** nas fichas do catálogo e na faixa **Músicos em destaque**.
- Botão **Denunciar avaliação** ao lado de cada avaliação verificada, no painel do músico.
- Relato com motivo (spam, falsidade de identidade, conteúdo inadequado, informação enganosa ou outro) e detalhes opcionais de até 900 caracteres.
- O remetente deve estar autenticado e ter acesso ao marketplace/preview. **Denúncias não ocultam conteúdo automaticamente**. Há restrição de uma denúncia em aberto por pessoa/alvo e limite de cinco novas denúncias por conta em 24 horas.
- Central de moderação com filtros **pendentes**, **todas**, **resolvidas** e **arquivadas**. Apenas moderadores nomeados podem ler denúncias e os nomes dos denunciantes.
- Decisões manuais com nota interna obrigatória de 5 a 500 caracteres: **ocultar**, **restaurar** ou **arquivar**. Todo uso é salvo na tabela privada de auditoria, inclusive restaurações.
- Ocultar uma avaliação tira sua nota da média e sua participação do número de avaliações **no marketplace**. O ranking de **Músicos em destaque** é atualizado naturalmente.
- Ocultar um músico remove seu perfil da **busca**, dos **destaques**, da **lista de avaliações**, e impede **novos convites feitos pelo marketplace**. Favoritar perfis ocultos também é bloqueado.
- Moderação atua somente no **catálogo**. **Não apaga** o portfólio gratuito em \`/musico/[slug]\`, não cancela convites pré-existentes e não expõe contatos ou dados financeiros.
- Ações não acionam cobranças, anúncios, premiações ou alterações de plano.

## Passo 1 — Executar a migração de moderação

**Pré-requisitos:** execute primeiro
\`supabase/marketplace_private_launch_migration.sql\` e
\`supabase/marketplace_featured_musicians_migration.sql\`,
além das migrações anteriores do portfólio e dos convites.

Execute **somente** \`supabase/marketplace_moderation_migration.sql\` no Supabase SQL Editor. **Não reexecute o schema inicial nem altere a flag de lançamento.**

Esta migração cria as tabelas privadas:

- \`stage_marketplace_moderators\` — contas autorizadas a moderar.
- \`stage_marketplace_reports\` — denúncias e justificativas.
- \`stage_marketplace_hidden_musicians\` — ocultações de perfis.
- \`stage_marketplace_hidden_reviews\` — ocultações de avaliações.
- \`stage_marketplace_moderation_audit\` — histórico de todas as decisões.

Todas têm RLS ativada e **sem acesso direto** dos clientes autenticados ou anônimos. As operações ocorrem somente por RPCs \`security definer\` com verificações explícitas.

## Passo 2 — Autorizar somente sua conta como moderador

No Supabase SQL Editor, execute o SQL abaixo, trocando o e-mail. O usuário precisa existir no Stage Flow:

\`\`\`sql
insert into public.stage_marketplace_moderators (profile_id)
select p.id
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('SEU_EMAIL_AQUI')
on conflict (profile_id) do nothing;
\`\`\`

A conta precisa **também** estar na allowlist \`stage_marketplace_preview_access\` para abrir o catálogo ainda não lançado. A função da fila de denúncias verifica separadamente a permissão de moderação.

Acesse a prévia em \`https://stage-flow-lemon.vercel.app/marketplace/preview\`. Se autorizado como moderador, verá um link para **Central de moderação**, ou poderá abrir diretamente \`https://stage-flow-lemon.vercel.app/marketplace/moderacao\`.

Para revogar permissão de moderação, sem apagar os dados:

\`\`\`sql
delete from public.stage_marketplace_moderators
where profile_id in (
  select id from auth.users
  where lower(email) = lower('SEU_EMAIL_AQUI')
);
\`\`\`

## Checklist de teste

1. Confirme que \`/marketplace\` continua em **Em breve**. Confira que \`stage_marketplace_control.launched\` continua **false**.
2. No laboratório, abra um músico que publicou o portfólio e ativou a participação. Clique **Denunciar perfil**. Preencha um motivo e envie.
3. Acesse \`/marketplace/moderacao\` como moderador. Confira que aparece uma denúncia pendente com nome do denunciado, motivo e detalhes do relato. A conta que denunciou não deve poder ler a fila.
4. Use **Arquivar** com uma justificativa e confirme que o músico permanece visível.
5. Envie uma nova denúncia; escolha **Ocultar** com justificativa. Confirme que o músico some do catálogo e dos destaques, mas o endereço independente do portfólio permanece intacto.
6. Abra o filtro **Todas** na moderação, escolha **Restaurar** na denúncia anterior e confira que o músico volta a ser elegível (se mantiver a publicação e o opt-in).
7. Repita com uma **avaliação específica**. Confirme que ela some da lista e da nota média, enquanto outras avaliações válidas continuam visíveis.
8. Verifique limite de denúncias em 24 horas, denúncia repetida do mesmo alvo e bloqueio de acesso a moderador para usuário comum.
9. Confirme que não houve convite automático, modificação no pagamento ou lançamento público.

## Questões para preparar o lançamento (etapas posteriores)

- Ferramentas de apelação para músico/avaliador, com notificação privada da decisão.
- Política de conteúdo, suporte e fila operacional, prevenção de abuso e monitoramento.
- Ajustes de privacidade para perfis cuja imagem ainda esteja acessível por links públicos de mídia.
- A moderação do marketplace **não** é automaticamente aplicada aos demais módulos do Stage Flow. Bloqueios globais de contas e prevenção de abuso em convites exigem projeto separado.

**Apenas quando o proprietário do Stage Flow solicitar o lançamento** deverão ser discutidas alterações na rota pública e a flag \`launched\`. Esta migração não faz nenhuma dessas alterações.
