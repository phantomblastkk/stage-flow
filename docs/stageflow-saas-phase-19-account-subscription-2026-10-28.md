# StageFlow — Parte 19: conta, planos e consulta de assinatura

Base: `0b858b8a009ae213178231de5bb73337e071a7b7`, diretamente na main.
Sem deploy, migrations, alterações em contas reais, pagamentos ou autorização Pro.

## Problema → impacto → implementação

| Problema | Impacto | Solução aplicada |
|---|---|---|
| Campos e ações da conta tinham estilos próprios | Foco, dimensões e feedback divergiam do restante do workspace | Button/Input/InlineNotice/LoadingState/EmptyState compartilhados; CSS local tokenizado |
| Planos e assinatura tinham 28 atributos style | Layout comercial disperso no JSX | subscription-ui.css no domínio billing, com classes locais compartilhadas |
| Falha ao consultar Pro era apresentada como exclusividade/indisponibilidade | Usuário autorizado podia interpretar erro como perda de acesso | Erro de consulta separado do estado comercial, sem CTA autorizado até leitura válida, com Tentar novamente |
| Falha inicial da conta deixava apenas mensagem sem recuperação | Usuário precisava recarregar a página | EmptyState e recuperação explícita usando a mesma consulta |
| Texto mencionava dois perfis independentes | Inconsistência com o Perfil Artístico único | Textos de visão geral e confirmação alinhados à conta e ao perfil únicos |
| Revelar senha e fechar confirmação tinham alvos pequenos | Dificuldade por toque e teclado | Alvos de 44 px; composição da senha e input com ref mantidos |
| CTA público dizia assinar apesar de não haver checkout | Expectativa comercial incorreta | Consultar acesso Pro, mantendo destino /assinatura e indisponibilidade comercial |
| Link direto para uma aba podia deixá-la fora da barra horizontal no celular | Seção ativa não ficava visível na navegação | Rolagem horizontal da barra para revelar aria-current, sem rolar a página |

## Preservado

- RPCs, parâmetros e regras de nome/@, inclusive prazos independentes de 60 dias.
- auth.getUser antes das alterações de e-mail/senha e auth.updateUser, sem manipular
  sessão por claims editáveis ou adicionar chaves privilegiadas.
- Senha mínima de 12 caracteres, confirmação coincidente, estados busy e mensagens
  de confirmação de e-mail. Nenhuma credencial real foi usada nos testes.
- Ativação de função continua com checkbox + ATIVAR + ação explícita. Ref do campo,
  retorno de foco, Escape, bloqueio durante gravação e trap de teclado mantidos.
- Inputs compostos de senha/confirmação com ref mantêm elementos nativos e classes
  do Design System. As abas estruturais mantêm aria-current e histórico de navegação.
- Acesso Pro continua dependendo de stage_my_pro_site_publication; true estrito é
  exigido para mostrar o atalho autorizado. Não há checkout nem concessão de acesso.
- Página /planos continua Server Component; estilos compartilhados não a tornam Client Component.
- Nenhum endpoint, webhook, preço, plano ou configuração Asaas foi alterado.

## Medição e limites

| Página | Atributos style antes | Depois |
|---|---:|---:|
| Minha conta | 0 | 0 |
| Assinatura | 5 | 0 |
| Planos | 23 | 0 |

28 atributos removidos, contados por AST TypeScript. As duas folhas locais não
usam cores hexadecimais nem variáveis de cor legadas. Nenhuma dependência adicionada.
O CSS global e outras páginas ainda possuem consumidores legados: migração geral
continua parcial. Não há medição de ganho de latência ou redução equivalente de bundle.

## Validação

- 262 testes Node, TypeScript e build de produção passaram localmente.
- Dezoito cenários de navegador anteriores mantidos; três cenários compostos
  adicionados em 360/768/1280 px com Auth/RPCs totalmente sintéticos.
- Consulta de conta com erro e recuperação; nome bloqueado e @ liberado de forma
  independente; payload de atualização e novo bloqueio após gravação simulada.
- Senhas divergentes bloqueiam envio; revelar/ocultar, atualização e limpeza de
  campos; e-mail com instrução de confirmação, sem troca prematura da identidade.
- Ativação exige ambos os critérios; Escape restaura foco e Shift+Tab permanece
  no diálogo; confirmação válida aciona apenas a RPC esperada.
- Pro com erro, recuperação sem direito, acesso autorizado e comparação pública
  sem nova consulta privada de direito. Nenhuma chamada a endpoint de cobrança.
- Overflow, contraste do erro e alvo do botão de senha nos estados exercitados.
- Revisão React: sem novas dependências; recuperação reutiliza consultas existentes.
  Um efeito local sincroniza a rolagem horizontal da navegação com a aba ativa e o
  fim do carregamento, sem novos listeners ou consultas. Sem mudanças de autorização, SQL ou RLS.
- CI aprovado no commit `65ca4f7d88ba407ccf00fd88ef39efd3ae2519ab`:
  [Integration and build](https://github.com/phantomblastkk/stage-flow/actions/runs/40739396086)
  e [Operational UX](https://github.com/phantomblastkk/stage-flow/actions/runs/40739396084).
- Os vinte e um cenários de navegador passaram. [Evidências com 63 PNGs e log do servidor](https://github.com/phantomblastkk/stage-flow/actions/runs/40739396086/artifacts/12838762398),
  com retenção de sete dias.
- Inspeção visual: dados pessoais, segurança e confirmação em 360 px; planos em
  360 px; segurança e assinatura em 1280 px. A aba ativa fica visível na barra
  horizontal, sem comprimir os controles. Navegação fixa aparece na posição da
  viewport nas capturas de páginas longas.
- O teste do alerta de acesso está limitado ao painel de assinatura para não
  confundir o aviso real com o anunciador de navegação do Next.js.
- [Diff completo](https://github.com/phantomblastkk/stage-flow/compare/0b858b8a009ae213178231de5bb73337e071a7b7...65ca4f7d88ba407ccf00fd88ef39efd3ae2519ab).

A verificação é de integração com respostas simuladas; não altera Auth, identidade
ou acesso Pro no Supabase real e não certifica entrega real de e-mails.

## Continuidade

Próxima fatia: inventário dos consumidores restantes de globals.css e dos
componentes de layout antes de remover regras compartilhadas por rotas ainda
não migradas. Encerrar por consumidores comprovados, não por quantidade de arquivos.
