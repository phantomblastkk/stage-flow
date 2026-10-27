# StageFlow — Parte 3: navegação nas telas internas

## Estado confirmado antes de alterar

Base: `965d482449622293d44bb20a84e3f7abbcf64f79`, main.
As Partes 1 e 2 já tinham dashboard, navegação agrupada, primitives, próxima ação,
feed limitado e migrations de performance documentadas. Não foram refeitas.
O relatório da Parte 2 registra aplicação em QA; esta execução não revalidou o banco.

## Problema, impacto e solução aplicada

A navegação completa existia somente em `/painel`. Abrir agenda ou financeiro
retirava o menu e obrigava o usuário a voltar ao painel para trocar de ferramenta.

`WorkspaceBoundary` no layout raiz seleciona explicitamente 16 prefixos internos.
O frame compartilhado permanece montado ao navegar entre essas áreas usando Next Link,
conservando sidebar, grupos abertos e estado de navegação. Nenhuma URL foi movida.
O dashboard continua com seu shell existente; entrar/sair dele remonta o frame.
Login, cadastro, convite público, perfis públicos e admin não recebem este frame.

- `workspace-routes.ts`: seleção pura por segmento completo; `/eventos-publico` não casa com `/eventos`.
- `workspace-boundary.tsx`: frame em import dinâmico; páginas públicas não montam consultas autenticadas.
- `workspace-frame.tsx`: menu existente, localização e link de salto para o conteúdo.
- `use-workspace-role.ts`: consulta somente perfil da identidade validada e duas RPCs existentes em paralelo; sem SQL novo, cache global ou armazenamento local de permissões. Falha na navegação não esconde a página nem encerra sessão. Assinatura Auth síncrona, com limpeza ao desmontar; troca de identidade invalida o estado.
- `workspace-shell.css`: largura flexível, contêineres internos limitados, espaço para barra inferior e safe area.
- `app/layout.tsx`: continua Server Component e recebe boundary client por composição.

A sidebar é apresentação; RLS e RPCs das páginas continuam responsáveis pela autorização.
O frame faz uma carga de permissões por montagem/alteração de identidade, não por rota.
As consultas legadas de autenticação das páginas ainda existem: a extração para um provider
único deve acompanhar a futura migração dos serviços, sem alterar contratos agora.

## CI e validação

Incluídos no workflow principal os testes da Parte 2, antes omitidos, e os testes de rotas
novos. Ao ativar a suíte, identificou-se uma asserção antiga que exigia `key===Tab`,
embora o código use o guard equivalente `key!==Tab`; corrigido o contrato para o código real.

- 143 testes Node aprovados, incluindo execução da seleção de rotas e contratos estáticos.
- TypeScript sem erros.
- Build Next.js de produção aprovado localmente; CI deve ser conferido no commit desta entrega.
- Não houve teste autenticado com contas reais nem certificação de layout em dispositivos físicos.
- Nenhum deploy, migration ou alteração no banco oficial nesta parte.

## Próxima parte delimitada

Revisar Agenda e Financeiro em 360px, extrair consultas de `app/eventos` para domínio
`events` e validar músico → convite → aceite com contas de QA. A navegação compartilhada
não equivale a consolidar todos os formulários ou concluir as jornadas.
