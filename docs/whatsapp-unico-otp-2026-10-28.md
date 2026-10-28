# Stage Flow — WhatsApp único, OTP e privacidade (28/10/2026)

## Escopo e isolamento
- Branch de código: `feature/whatsapp-unico-otp-20261028`, criada a partir de `main`.
- Migração de homologação aplicada no Supabase QA `zycuprhymoukhnuamtit` com sucesso.
- **Produção não foi alterada**: nenhum deploy, nenhuma migração no Supabase oficial, nenhum envio real.
- A branch ainda precisa de validação TypeScript/build/navegador e publicação manual em homologação.

## Regra de produto implementada
- Cantores e músicos novos usam o **número de telefone** como credencial de cadastro (com senha), com OTP por SMS ou WhatsApp (quando o provedor oferecer).
- Produtores puros continuam se cadastrando com e-mail/senha. Contas antigas continuam entrando por e-mail/senha.
- Login reconhece e-mail ou telefone brasileiro com DDD.
- O e-mail informado por artistas novos é **opcional e de contato não verificado**, armazenado apenas em metadados; não é credencial do Supabase Auth. Vinculação/recuperação segura de e-mail deve ser tratada em melhoria própria.
- O campo WhatsApp é obrigatório para artistas e é informado **uma vez** no cadastro.
- Edição do número e preferências ficam em `/minha-conta?aba=privacidade`.
- Convites e Conversas agora apontam para esta aba, sem campo redundante para redigitar WhatsApp.
- Contas existentes com telefone gravado em preferências/metadados recebem o campo pré-preenchido para verificação, **sem considerar esse número previamente confirmado**.
- O telefone verificado em `auth.users.phone` é a fonte autoritativa; tabelas antigas recebem cópias compatíveis para chat/convites e não permitem trocar telefone sem OTP.
- Notificações e compartilhamento com contratantes têm autorizações independentes, desativáveis.
- Número não verificado não é exposto por RPC a organizadores e não deve ser usado na fila de WhatsApp.

## Segurança e dependências operacionais
**Não publicar a nova experiência para usuários reais até configurar e validar:**
1. Supabase Auth → Phone habilitado, **Confirm phone** ativo, signup por telefone permitido.
2. Provedor de SMS testado e com crédito, rate limits e proteção antiabuso. Para WhatsApp como canal nativo de OTP, a documentação Supabase indica Twilio/Twilio Verify; alternativa posterior: Send SMS Hook.
3. Números reais em formato internacional +55, especialmente no Brasil.
4. Testar confirmação de cadastro, troca de telefone via `updateUser({phone})` + `verifyOtp({type:"phone_change"})` e tentativas inválidas/expiradas.
5. Confirmar que a sessão **não é liberada sem OTP**; Auth não deve auto-confirmar telefone no servidor.
6. Testar conta antiga por e-mail, cadastro de produtor, convite, permissões privadas, e reenvio de código.
7. Eventual recuperação de conta de artistas com autenticação por número exige plano de segurança específico, inclusive reciclagem de linhas e MFA.

Os templates de mensagens transacionais do WhatsApp Cloud são **outra integração**, não a mesma coisa que o provedor do código OTP. O dispatch atual permanece desligado até ativação oficial.

## Arquivos principais
- `app/cadastro/page.tsx`: número obrigatório, canal e confirmação OTP.
- `app/login/page.tsx`: login por número/e-mail.
- `components/account-whatsapp-privacy.tsx`: preferências e troca verificada.
- `app/minha-conta/page.tsx`: nova seção na aba Privacidade.
- `app/meus-convites/page.tsx`, `app/conversas/page.tsx`: sem número duplicado.
- `supabase/migrations/20261028230000_unified_whatsapp_privacy.sql`: privacidade, sincronização e compatibilidade.
- `tests/unified-whatsapp-otp.test.mjs`, `tests/chat-finance.test.mjs`: contratos atualizados.

## Evidência em homologação (banco)
- Migração `unified_whatsapp_privacy_20261028`: sucesso.
- Ajuste `unified_whatsapp_disable_unverified_20261028`: sucesso.
- RLS habilitada em `musician_whatsapp_preferences`.
- Funções novas e antigas de preferências: anônimo **sem EXECUTE**, autenticado com EXECUTE.
- Chamadas sem sessão a `stage_my_whatsapp_privacy`, `stage_set_whatsapp_privacy` e `stage_hiring_whatsapp_settings`: `login_required`.
- Um trigger `stage_account_phone_verified` no Auth.
- **Não foram realizados** testes E2E com OTP real, build completo ou entrega por SMS/WhatsApp.

## Testes pendentes em um runner com dependências
```bash
npm ci
node --test tests/unified-whatsapp-otp.test.mjs tests/chat-finance.test.mjs tests/signup-username-collision.test.mjs
npx tsc --noEmit
npm run build
```

Verificar ainda visuais e navegação em 320/360/375/430 px. Produção depende de autorização explícita.
