# Miniatura da conta no canto superior e notificações pendentes

Correção preparada em 28/10/2026. **Sem deploy sem aprovação explícita do proprietário.**

- Topo do painel: miniatura do perfil único, sempre usando a foto artística principal quando houver; foto do músico apenas como reserva. Mesmo avatar ao alternar entre cantar e tocar.
- Imagem recortada no próprio avatar, com overflow oculto, object-fit cover e enquadramento central levemente aproximado. Não altera a imagem original.
- Campainha: mostrar até cinco avisos **não lidos**; ao clicar, confirmar leitura com a RPC autenticada, retirar aviso da lista e atualizar contador. Caso a marcação falhe, ainda abrir o assunto e permitir nova tentativa.
- Minhas notificações: iniciar em Não lidas; abrir um aviso remove-o das pendências. Todas preserva o histórico já lido.
- Apenas alterações de frontend e testes; sem modificações em dados do usuário ou permissões.
