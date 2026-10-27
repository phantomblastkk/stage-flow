# StageFlow — Parte 7: contexto de conta compartilhado

Base verificada: `3abe938d0332f32ed31abe7357cca7f595ec3247`.
Trabalho diretamente na `main`, sem develop, homologação, banco remoto,
migrations, alteração de credenciais ou deploy.

## Problema → impacto → solução aplicada

| Problema | Impacto | Código aplicado |
|---|---|---|
| Menu, painel e Financeiro carregavam o perfil por caminhos independentes | Leituras duplicadas e apresentação de funções potencialmente divergente | Domínio `account`, com store por provider, snapshot compartilhado e perfil consultado pelo ID confirmado por `getUser` |
| A identidade do shell podia mudar enquanto a página mantinha seus dados | Rascunhos, valores e seleções da conta anterior poderiam continuar na tela | Boundary privado desmonta os descendentes na troca de identidade e na saída; nova conta recebe uma árvore com chave diferente |
| Requisições podiam terminar após troca de conta ou desmontagem | Uma resposta antiga poderia sobrescrever a apresentação atual | Cancelamento por `AbortController`, geração de requisição e ciclo de vida do listener; verificação após cada espera |
| Evento de token podia provocar consultas repetidas | Custo de rede e renderizações sem mudança de perfil | Eventos repetidos da mesma conta são ignorados; objetos de perfil/permissão inalterados preservam referência |
| Falha temporária de rede confundida com sessão ausente | Redirecionamento indevido e perda de formulário | Sessão realmente ausente limpa e redireciona; falha transitória da mesma conta preserva o último snapshot validado e apresenta ação de tentar novamente |
| Mudanças de nome/função podiam deixar o menu desatualizado | Usuário precisava recarregar a página | Salvar Minha conta ou mudar experiência atualiza o provider; sair dos editores de perfil/portfólio também revalida |
| Envolver todas as rotas de marketplace exigiria login na página pública de anúncio | Visitantes perderiam acesso ao “Em breve” | Exceção explícita para `/marketplace`; o preview restrito mantém seu controle existente |

## Arquivos e responsabilidades

- `src/domains/account/account-types.ts`: contrato mínimo de apresentação da conta.
- `src/domains/account/account-store.ts`: ciclo Auth, consulta paralela de perfil/permissões, invalidação e proteção contra respostas antigas.
- `src/domains/account/account-context.tsx`: integração React com `useSyncExternalStore`; revalidação ao voltar à aba após 60 segundos.
- `src/domains/navigation/components/workspace-root.tsx`: estado de carregamento/erro/saída e remontagem dos descendentes privados.
- `workspace-boundary.tsx`: carregamento adiado do provider nas rotas privadas existentes e no painel; não adiciona um segundo frame ao painel.
- `use-workspace-role.ts` e `app/painel/page.tsx`: consomem o mesmo perfil e as permissões de apresentação.
- `app/financeiro/page.tsx` e `finance-service.ts`: reaproveitam os campos financeiros do perfil; mantêm `getUser` atualizado antes da leitura das RPCs e rejeitam ID divergente.
- `app/minha-conta/page.tsx`: sincroniza o contexto depois de alterações salvas.
- `tests/account-store.test.mjs`: testes executáveis de concorrência, invalidação, falhas e isolamento de instâncias.
- `tests/browser/agenda-finance.mjs`: navegação Next, contagem de consultas, troca entre abas, limpeza de formulário e resposta financeira atrasada.

## Limites de segurança e escopo

Os dados são mantidos somente na memória de cada provider. O snapshot não contém
token, sessão completa ou metadados editáveis. O snapshot vazio de SSR não contém
dados de usuário e não há cache global de contas. Mensagens Auth indicam apenas
que é necessário invalidar: o carregamento usa o usuário retornado por `getUser`.

O callback Auth é síncrono e agenda a consulta para uma tarefa posterior, evitando
reentrada sob o lock do Supabase. A limpeza da identidade é imediata. Falha ao
validar uma conta diferente nunca restaura o perfil anterior. Atualizar a mesma
conta preserva os formulários montados.

Flags de owner e quantidade de casas servem à navegação. Erros ou formatos
inesperados das RPCs não concedem esses itens de menu. A autorização continua nas
RPCs/RLS existentes; o contexto não concede permissões e nenhum SQL foi alterado.

As rotas públicas de artistas/músicos/casas, login, cadastro e administração
continuam fora desse provider. Páginas legadas ainda fazem suas validações Auth e
consultas de domínio; esta etapa elimina as leituras independentes do perfil no
menu/painel/Financeiro, sem alegar remoção de todas as consultas repetidas do app.

## Validação

- 191 testes Node aprovados localmente: 12 novos casos do store e um novo contrato financeiro, além dos testes existentes adaptados à responsabilidade compartilhada.
- TypeScript e build de produção Next.js aprovados com URL/chave fictícias.
- Revisão React: provider por montagem, SSR sem dados privados, cleanup de listeners/requisições, dependências primitivas e leituras independentes em paralelo.
- Script de navegador mantém os cenários em 360/768/1280 px e acrescenta um cenário de conta em 360 px.
- O novo cenário exige uma única leitura de perfil e de cada permissão ao navegar Financeiro → Agenda → Painel → Financeiro, sem recarregar a página.
- Simula troca de identidade e saída em outra aba pelo canal do Supabase. Verifica novo perfil, remoção de permissões anteriores, formulário limpo e rejeição de resposta financeira atrasada.
- Verifica acesso ao marketplace público após sair, sem consultas privadas.
- Execução do navegador no CI: pendente de publicação deste commit; registrar abaixo o resultado antes da entrega.

Somente fixtures sintéticas são usadas nos testes. Esse resultado não substitui
testes com Auth/RLS reais nem uma avaliação de carga para 100 mil usuários.
Não houve leitura de dados reais nesta etapa.

## Próxima etapa

Consolidar os serviços de convites/conversas no domínio `booking`, preservando o
contexto da negociação ao aceitar um show. Reutilizar o contexto de conta onde
ele eliminar leituras duplicadas, mantendo a autorização no banco.
