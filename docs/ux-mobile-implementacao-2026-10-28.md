# StageFlow — UX mobile revisada, 28/10/2026

## Etapas implementadas
1. Marketplace: busca e resultados antes do bloco de destaques no celular; card de recomendacao com largura legivel, banner compacto, tipografia adequada, alvos de toque de 44px.
2. Navegacao: barra inferior reutilizavel `WorkspaceMobileNav` com Início, Agenda, Chats, Explorar e Conta. Marketplace publico mostra essa barra apenas para visitantes autenticados. O menu lateral completo mantém Convites, Financeiro, Perfil Artístico, Configurações e outras rotas, sem suprimir funcionalidades.
3. Painel: pendencias de contratacao, convites e chat no inicio; resumo do próximo show; Marketplace secundario no mobile.
4. Conversas: altura dinamica `100dvh`, mensagens rolaveis, envio acessivel, controles com pelo menos 44px, inputs com 16px.
5. Perfil artístico: atalhos por secao e botao Salvar no topo mobile, alem do botao existente ao fim do formulario. Dados de cantor e músico permanecem no perfil único, com permissões opt-in intocadas.
6. Formulários, Minha Conta, Notificações e perfil público: controles e textos mais legíveis, contraste, áreas de toque e rolagem horizontal nas abas.

## Segurança, escopo e publicacao
- Nenhum dado de usuário foi alterado nem nenhuma migration SQL aplicada.
- React/Next + testes automatizados no CI antes da publicacao; revisão visual manual em Safari/iOS (320,375,430px), Android (360,412px) e desktop ainda deve acontecer no ambiente de teste.
- Correcoes anteriores de miniatura do canto superior e avisos nao lidos continuam apenas em codigo ate o proximo deploy.
- **Proibido deploy antes de autorização explícita do proprietário.** `vercel.json` deve manter `git.deploymentEnabled=false`.
