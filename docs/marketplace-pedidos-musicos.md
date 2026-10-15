# Planejamento: pedidos de músicos no marketplace Stage Flow

**Estado:** ideia aprovada para uma fase futura. **Não implementado nem liberado no aplicativo.**

## Exemplo de uso
Um cantor/contratante cria o pedido: "Preciso de cavaquinho para sexta-feira em São Paulo, com cachê previsto entre R$ 350 e R$ 500".

## Fluxo proposto

1. O contratante publica um pedido com instrumento/função, cidade, local, data/horário, duração, descrição, faixa de orçamento **opcional** e prazo para candidaturas. Pode estar associado a um show já cadastrado.
2. Músicos que optaram por participar do marketplace encontram os pedidos filtrando por instrumento, região, agenda e outros critérios.
3. O músico pode se candidatar **uma vez por pedido**, informando seu valor proposto e uma mensagem; o contratante vê candidatos e seus portfólios simplificados.
4. A negociação acontece individualmente: oferta, contraproposta e aceitação, reaproveitando a lógica de propostas privadas dos convites Stage Flow.
5. O contratante seleciona músico(s), cria os convites do show e, se desejar, salva os selecionados numa **formação fixa** para apresentações futuras.
6. Pedidos podem ser encerrados, cancelados ou expirar; candidatos recebem atualizações do andamento.

## Privacidade e segurança inegociáveis

- **Nenhum músico vê cachês ou contrapropostas de outro candidato.** Só o contratante daquele pedido e o candidato envolvido visualizam sua negociação.
- A faixa de orçamento publicada é pública somente se o contratante optar por exibi-la; valores negociados são sempre privados.
- Número, e-mail e dados pessoais não são liberados a todos os candidatos nem a visitantes.
- Participar de pedidos deve ser uma ação voluntária do músico, mesmo que o perfil simples gratuito já exista.
- Permissões precisam ser impostas no **Supabase/RLS/RPC**, não apenas escondidas na interface.
- Evitar spam de candidaturas e contratações falsas: limites, reporte, bloqueio, moderação e indicadores de pedido encerrado.
- Nenhum pagamento automático ou cobrança antecipada enquanto isso não for implementado de modo seguro.

## Integração com as funcionalidades já disponíveis

- Perfil público simplificado do músico em /musico/[slug].
- Equipes fixas privadas em /equipes.
- Convites individuais e negociação privada de cachê.
- Agenda de apresentações confirmadas.

**Importante:** regras de plano gratuito/pago, monetização, posição em buscas, avaliações, reservas e pagamentos ainda serão decididas e implementadas separadamente. Não conceder recursos premium apenas por alteração no cliente.
