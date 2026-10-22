# Stage Flow | Painel privado de desempenho do músico

## O que foi criado

O painel **Meu desempenho** fica em \`/meu-desempenho\`, com acessos no **Painel Stage Flow** (experiência músico e cantor/artista) e no editor de **Meu portfólio de músico**.

A tela oferece períodos de **7, 30 e 90 dias** e mostra:

- **Visitas ao portfólio público:** carregamentos de \`/musico/[slug]\` com portfólio publicado. A própria conta do músico (quando logada) é ignorada na contagem.
- **Aparições na busca:** cartões retornados nas páginas de resultados no laboratório/marketplace. Não significa que o visitante rolou até o cartão ou o viu fisicamente na tela.
- **Aparições nos destaques:** presença entre os até seis músicos do carrossel superior.
- **Aberturas via catálogo:** cliques em “Ver portfólio” na listagem, na vitrine de destaques ou no painel detalhado.
- **Convites recebidos:** dados reais do sistema de convites, por data de criação do convite. A situação de aceitação/recusa/pendência é o **estado atual** de convites criados no intervalo.
- **Gráfico comparativo de períodos**, com escolha da métrica, resumo de respostas e taxa de aceite (aceites / convites recebidos, contabilizando também os pendentes no denominador).

O cálculo do gráfico utiliza dados agregados por dia e compacta períodos de 30 e 90 dias em blocos de três e sete dias para preservar a leitura no celular.

## Privacidade, limitações e precisão

A migração cria somente \`public.stage_musician_metrics_daily\`, com chave composta \`(musician_id,day)\` e totais por tipo de exibição. **Não armazena IP, cookies, e-mail, user-agent, localização, perfil ou identificador pessoal de visitantes** na tabela. O banco recebe somente o identificador do **músico divulgado**, a data e os contadores.

Para atenuar recarregamentos e visitas repetidas, a instrumentação frontend tenta contar no máximo **uma ação por músico/superfície/dia no mesmo navegador**, usando \`localStorage\` somente no dispositivo do visitante. Isso não equivale a proteção perfeita contra bots ou visitantes únicos. O servidor aceita registros após validar o portfólio publicado ou (no marketplace) o catálogo autorizado e o músico elegível. Os números são **indicativos e aproximados**; não representam pessoas únicas ou resultado financeiro.

A leitura de estatísticas é realizada exclusivamente por \`stage_my_musician_performance(p_days)\`, com autorização baseada em \`auth.uid()\`, sem parâmetro para consultar outro usuário. As tabelas têm RLS habilitada, com acesso direto revogado aos papéis anônimo e autenticado.

**Não existe histórico retroativo de acessos:** os contadores de visita e exibição começam após aplicação desta migração. Os convites históricos, por outro lado, já existem na tabela de convites e são consultados normalmente para o intervalo.

A coleta de páginas gratuitas públicas funciona independentemente de o marketplace estar liberado. A coleta de buscas, destaques e cliques do marketplace usa **a mesma trava \`stage_marketplace_gate()\`** das funcionalidades anteriores: antes do lançamento, **somente no laboratório autorizado**. A rota pública \`/marketplace\` permanece **“Em breve”**, e nada neste recurso altera \`stage_marketplace_control.launched\`.

## Instalação no Supabase

Pré-requisitos: migrações do portfólio gratuito, convites e marketplace até \`marketplace_moderation_migration.sql\`, incluindo a função de exclusão de perfis moderados.

Execute **somente**:

\`\`\`
supabase/musician_performance_migration.sql
\`\`\`

No Supabase → SQL Editor → Run.

Não reexecute o \`schema.sql\` inicial em ambiente já utilizado.

A migração cria as funções:

- \`stage_track_musician_portfolio_view(p_slug text)\` — contador público com validação de publicação.
- \`stage_track_marketplace_metrics(p_musician_ids uuid[], p_surface text)\` — contadores de cartões retornados na busca, destaques e cliques, protegidos pelo gate do marketplace.
- \`stage_my_musician_performance(p_days integer)\` — estatísticas privadas, somente do usuário logado com função de músico/artista.

## Teste de ponta a ponta

1. Depois da migração, abra \`/meu-desempenho\` logado como músico. Sem tráfego novo, os contadores devem começar em **0**, salvo convites realmente existentes no período.
2. Publique um portfólio gratuito e acesse \`/musico/<slug>\` em outro navegador ou em uma janela privada. Volte ao dashboard e clique **Atualizar**: a visita deve ser contabilizada. Recarregar a mesma página várias vezes no mesmo navegador/dia não deve inflar a contagem.
3. Sem liberar o marketplace, entre no laboratório \`/marketplace/preview\` com conta autorizada. Tenha ao menos um músico com portfólio publicado e **participação habilitada** no catálogo. Busque esse músico e abra seu portfólio pelo botão do catálogo.
4. Na conta desse músico, confirme as aparições de busca e aberturas via marketplace no dashboard. Se ele estiver entre os mais avaliados e aparecer nos destaques, o contador de destaques deve aumentar.
5. Envie um convite REAL de outra conta para um show. Confira **Convites recebidos** no período, e depois aceite ou recuse para verificar atualização do quadro de status.
6. Troque entre 7, 30 e 90 dias; confira que a soma do gráfico corresponde ao total da métrica escolhida e não produz valores inventados.
7. Tente abrir \`/meu-desempenho\` com conta apenas de produtor; o banco deve responder \`artist_required\`. Tente executar a RPC com outra conta: cada conta só recebe seus próprios números.
8. Confirme que nenhuma estatística de desempenho aparece na página pública \`/musico/<slug>\` nem no marketplace. Verifique que o catálogo público segue mostrando **Em breve**.

## Futuras evoluções

- Comparativo com período anterior e tendência percentual.
- Estatísticas agregadas por instrumento ou cidade, somente depois de avaliação de privacidade e volume suficiente.
- Indicadores de conversão para contratações confirmadas, após definição de uma fonte confiável de conclusão.
- Proteção de métricas contra tráfego automatizado em escala e retenção de dados por janela temporal.

O recurso é gratuito, não cria produtos patrocinados, não exige plano do cantor e não habilita assinaturas ou subdomínios.
