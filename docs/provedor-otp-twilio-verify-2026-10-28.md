# Stage Flow — Twilio Verify / Supabase Auth (homologação)

**Data:** 28/10/2026  
**Banco QA:** `zycuprhymoukhnuamtit` (`stage-flow-homologacao`)  
**Branch:** `feature/whatsapp-unico-otp-20261028`  
**Status:** configuração de aplicação preparada; provedor externo **ainda não ativado**. Não colocar credenciais em GitHub ou código.

## Arquitetura

1. **OTP de segurança do número:** Supabase Auth + **Twilio Verify**, canais `sms` e futuramente `whatsapp`. O Supabase valida os códigos.
2. **Notificações de shows e conversas:** subsistema separado do OTP. O envio pela WhatsApp Cloud API continua **desativado** até existir conta comercial, template aprovado e integração configurada.
3. **Telefone canônico:** `auth.users.phone` com `phone_confirmed_at` após confirmação; a RPC `stage_my_whatsapp_privacy` preserva visibilidade privada. Não gerar OTP no cliente nem criar tabela de códigos própria.

## Dados externos necessários para configurar o provedor

Criar conta em https://console.twilio.com (cobranças e autorização sob controle do titular), depois criar um Verify Service (nome sugerido `Stage Flow QA`) em https://console.twilio.com/us1/develop/verify/services .

**Na Twilio** anotar localmente:
- Account SID (`AC...`).
- Auth Token (**secreto**, não compartilhar em chat nem repositório).
- Verify Service SID (`VA...`).

**No Supabase QA** abrir https://supabase.com/dashboard/project/zycuprhymoukhnuamtit/auth/providers :
- Authentication → Providers → Phone.
- Habilitar Phone; **Confirm phone deve estar ativo** (não auto-confirmar).
- Selecionar SMS provider **Twilio Verify**.
- Preencher Account SID, Auth Token e **Twilio Verify Service SID** nos campos internos do dashboard.
- Salvar e verificar resultado. Não inserir esses valores no Vercel: a conexão de OTP é gerenciada pelo Supabase Auth.
- Ajustar rate limits de OTP, proteção anti-bot/CAPTCHA, países permitidos, regras anti-fraude na Twilio e custos. Primeiro liberar só destinos de teste sob controle da equipe.
- Utilizar configurações/telefones de teste do Supabase sem enviar OTP real, depois testar com número permitido e prova real.

## Canais

- **SMS:** primeira opção; disponível após configuração e teste do provedor.
- **WhatsApp:** também suportado pelo Supabase com Twilio Verify, mas a Twilio exige habilitação do canal, remetente WhatsApp vinculado e demais requisitos comerciais para operação real. Não habilitar no Stage Flow antes de obter uma entrega real bem-sucedida.
- A UI na branch atual usa **SMS por padrão**; somente exibe opção WhatsApp quando `NEXT_PUBLIC_STAGEFLOW_OTP_WHATSAPP_ENABLED=true`. Padrão seguro: ausente/false, sem opções falsas no cadastro.
- Após confirmar WhatsApp no QA, definir a flag **apenas na Vercel QA**, no ambiente de compilação adequado e redeployar QA; nunca colocar tokens secretos em `NEXT_PUBLIC_*`.

## Plano de teste seguro (antes de liberar)

1. Auth Phone ativo, confirm phone obrigatório, SMS provider funcionando; testar OTP sem usar conta real.
2. Cadastro com número +55 válido, código correto e incorreto; conferir que não há sessão utilizável antes de confirmar o telefone.
3. Reenvio, expiração, rate limit, cadastro duplicado e interrupção após envio.
4. Contas antigas por e-mail continuam entrando.
5. Em Minha conta → Privacidade: alterar telefone e confirmar por `phone_change`; número anterior só é substituído após sucesso.
6. Contatos não verificados não podem ser expostos aos produtores nem receber WhatsApp transacional.
7. Verificar que notificações de shows são um **serviço separado** e que a flag do OTP não ativa disparos de mensagens de eventos.
8. Revisar segurança e logs da Twilio e Auth; só depois pensar em ativação de produção com autorização específica.

## Fontes
- https://supabase.com/docs/guides/auth/phone-login
- https://www.twilio.com/docs/verify/whatsapp
- https://www.twilio.com/docs/verify/api/service
- https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook

## Limitações das ferramentas desta etapa

O conector Supabase disponível pode ler projetos, SQL e aplicar migrações, mas não dispõe de ação específica para configurar o **Phone Provider** da instância gerenciada no Dashboard. O conector Twilio não está instalado. Assim, criação de conta, contratação de serviço, configuração de segredos e habilitação efetiva do provedor devem ser feitas pelo titular diretamente nos painéis. Após conexão real, validar em homologação antes de publicar.
