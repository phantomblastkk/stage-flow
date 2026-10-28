# Favoritos do Marketplace — UX e correção

Diagnóstico em 28/10/2026:
- A única listagem elegível do banco oficial podia ser exibida para seu próprio titular. Ao clicar no coração, a RPC retorna `invalid` porque proíbe `p_musician_id=auth.uid()`; a tabela possui ainda CHECK owner_id <> musician_id. O frontend convertia essa resposta em erro genérico.
- Teste transacional no projeto oficial: própria listagem devolve `invalid`; uma conta diferente consegue salvar, ver o vínculo e remover o favorito. `BEGIN/ROLLBACK` não alterou dados permanentes.
- Corrigido: card do titular mostra "Seu perfil" e não um coração enganoso. Para outros músicos, coração com `aria-pressed`, foco visível, spinner de envio, confirmação de salvamento/remover e mensagens específicas para sessão expirada e anúncio não listado.
- Nenhuma migração SQL, permissão ou política de privacidade alterada.
- Publicação da interface na Vercel permanece manual, apenas com autorização explícita.
