import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read=(path)=>readFileSync(resolve(process.cwd(),path),"utf8");
const signup=read("app/cadastro/page.tsx");
const login=read("app/login/page.tsx");
const account=read("app/minha-conta/page.tsx");
const privacy=read("components/account-whatsapp-privacy.tsx");
const invites=read("app/meus-convites/page.tsx");
const conversations=read("app/conversas/page.tsx");
const migration=read("supabase/migrations/20261028230000_unified_whatsapp_privacy.sql");

test("artist signup requires one phone and verifies Supabase OTP before entry",()=>{
 assert.match(signup,/const needsMusicianPhone = Boolean\(inviteCode\) \|\| isArtist/);
 assert.match(signup,/phone: "\+" \+ internationalPhone/);
 assert.match(signup,/const whatsappOtpEnabled = process\.env\.NEXT_PUBLIC_STAGEFLOW_OTP_WHATSAPP_ENABLED === "true"/);
 assert.match(signup,/channel: whatsappOtpEnabled \? otpChannel : "sms"/);
 assert.match(signup,/whatsappOtpEnabled \? <div className="field"/);
 assert.match(signup,/type:"sms"/);
 assert.match(signup,/phone_confirmed_at/);
 assert.match(signup,/pendingPhone \? <form onSubmit=\{verifySignupPhone\}/);
 assert.match(signup,/Seu WhatsApp com DDD \(obrigatório\)/);
 assert.match(signup,/whatsapp_notifications_consent/);
 assert.doesNotMatch(signup,/required=\{whatsappConsent\}/);
 assert.match(login,/signInWithPassword/);
 assert.match(login,/isPhone\?\{phone:/);
});

test("privacy is one owner-only verified source, never accepts arbitrary phone",()=>{
 assert.match(migration,/public\.stage_my_whatsapp_privacy/);
 assert.match(migration,/public\.stage_set_whatsapp_privacy/);
 assert.match(migration,/auth\.users/);
 assert.match(migration,/phone_confirmed_at is not null/);
 assert.match(migration,/p_share boolean default null,p_notifications boolean default null/);
 assert.match(migration,/stage_sync_verified_account_phone/);
 assert.match(migration,/stage_hiring_whatsapp_outbox set status='expired'/);
 assert.match(migration,/stage_save_whatsapp_preference/);
 assert.match(migration,/phone_verification_required/);
 assert.match(migration,/stage_sent_invitations_with_whatsapp/);
 assert.match(migration,/revoke all on table public\.musician_whatsapp_preferences from public, anon, authenticated/);
 assert.doesNotMatch(migration,/grant select on public\.musician_whatsapp_preferences to anon/);
});

test("central account privacy handles phone change with phone_change OTP",()=>{
 assert.match(account,/AccountWhatsAppPrivacy/);
 assert.match(account,/activeTab==="privacidade"/);
 assert.match(privacy,/auth\.updateUser\(\{phone:/);
 assert.match(privacy,/type:otpType/);
 assert.match(privacy,/confirmingExisting\?"sms":"phone_change"/);
 assert.match(privacy,/stage_my_whatsapp_privacy/);
 assert.match(privacy,/stage_set_whatsapp_privacy/);
 assert.match(privacy,/Verificar número cadastrado/);
 assert.match(privacy,/Receber notificações de convites/);
 assert.match(privacy,/Permitir que contratantes autorizados/);
});

test("invites and chat link to privacy instead of requesting phone again",()=>{
 assert.match(invites,/minha-conta\?aba=privacidade/);
 assert.match(conversations,/minha-conta\?aba=privacidade/);
 assert.doesNotMatch(invites,/id="my-whatsapp-number"/);
 assert.doesNotMatch(conversations,/label="WhatsApp com DDD"/);
 assert.doesNotMatch(conversations,/stage_hiring_whatsapp_settings/);
});
