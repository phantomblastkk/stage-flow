# Parte 44 — Convites no domínio Marketplace

Base verificada: `92996a504eb54beece18a7b9f3e33bbbf0125fee`, branch main.

## Problema, impacto e solução aplicada

O catálogo acumulava apresentação, busca, modal, avaliações e todo o ciclo de convites.
Essa concentração dificulta revisar mudanças sem afetar fluxos financeiros e de contratação.
Extraído `src/domains/marketplace/hooks/use-marketplace-invitation.ts`: tipos do destino e
shows, leitura/retry de shows, rascunho, confirmação, envio, tratamento de status,
proteção síncrona contra duplicidade e recuperação com o mesmo payload.
O catálogo caiu de 981 para 914 linhas. A extração organiza responsabilidades;
não demonstra redução de bundle, rerenders ou latência.

O catálogo continua responsável pelo modal nativo, foco, scroll e coordenação com a
publicação de avaliações. Refs de sessão do painel e bloqueio de escrita são explicitadas
na interface do hook. Abrir outro músico chama resetInvitation no evento de abertura;
não há efeito que limpe o texto durante interação. A limpeza de feedback ao fechar permanece.

## Contratos preservados

- Mesmas RPCs, parâmetros, confirmação explícita e mensagens.
- Leitura distingue transporte inválido, carregamento, lista vazia e lista válida.
- Respostas antigas não atualizam um painel desmontado/substituído.
- Apenas um envio em andamento; fechar, avaliar e trocar músico seguem bloqueados.
- Falha incerta preserva mensagem/evento e permite somente repetição explícita do payload original.
- sent limpa mensagem; already_exists preserva mensagem e bloqueia novo envio do par.
- Retry de shows não dispara busca do catálogo nem convite.
- Sem alteração SQL, dependências, CSS, credenciais ou deploy.

## Validação

Local: 266 testes Node aprovados e TypeScript sem erros. CI de build e jornadas de
navegador será conferido no commit desta parte. Reutilizados testes comportamentais
existentes de convites e avaliações em 360/768/1280 px, sem testes que apenas espelham
a estrutura do hook. Todos os convites de teste usam API sintética.

## Plano restante e critérios de encerramento

Estimativa de 8–12 entregas incluindo esta, sujeita aos achados da auditoria final.
As 43 partes anteriores são entregas incrementais, não 43 requisitos integralmente concluídos.

| Frente | Entregas estimadas | Critério de encerramento |
| --- | --- | --- |
| Arquitetura Marketplace (esta parte) | 1 | Convites extraídos e regressões aprovadas |
| CSS e componentes compartilhados | 2–3 | Inventário atualizado, duplicações priorizadas removidas, telas críticas verificadas |
| Mobile e jornadas completas | 1–2 | Cadastro até contratação, músico e local, com estados de erro e teclado |
| Performance | 1–2 | Medições de bundle/consultas e correções verificadas |
| SEO público | 1 | Metadata, canonical, OG, sitemap e robots conferidos |
| Segurança/banco e fechamento | 2–3 | Relatório RLS/índices/isolamento, correções de código e pendências de produção explícitas |

A limpeza CSS ainda é parcial. Não se afirma prontidão para 100 mil usuários sem
métricas de carga, capacidade e verificação do ambiente real. Migrations/dados de
produção dependem de autorização específica conforme AGENTS.md.

Próxima parte: inventário atualizado dos CSS e migração das duplicações prioritárias
para os componentes compartilhados, com verificação mobile. Auto deploy desabilitado.
