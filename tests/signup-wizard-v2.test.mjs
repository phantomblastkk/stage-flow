import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = path => readFileSync(resolve(process.cwd(),path),"utf8");
const signup = read("app/cadastro/page.tsx");
const sql = read("supabase/stage_signup_v2_whatsapp_consent_20261029.sql");
const css = read("app/cadastro/signup-wizard.css");

test("wizard has three progressive steps, a clear organizer path and singer/musician/both options", () => {
  assert.match(signup,/type WizardStep = 1 \| 2 \| 3/);
  assert.match(signup,/labels = \["O que você faz", "Seus dados", "Confirmar"\]/);
  assert.match(signup,/step === 1 &&/);
  assert.match(signup,/step === 2 &&/);
  assert.match(signup,/step === 3 &&/);
  assert.match(signup,/Divulgar meu trabalho/);
  assert.match(signup,/Contratar ou organizar shows/);
  assert.match(signup,/Canta e toca/);
  assert.match(signup,/is_producer: isProducer/);
  assert.match(signup,/is_musician: isArtist && \(artistKind === "support" \|\| alsoMusician\)/);
  assert.match(signup,/Somente|somente|aprovação|aprovado/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(signup,/aria-current=\{step === index\+1/);
});
test("WhatsApp is mandatory for all wizard roles but contact sharing and messages are two independent choices",()=>{
  assert.match(signup,/phonePattern\.test\(normalizePhone\(whatsappPhone\)\)/);
  assert.match(signup,/signup_flow: "wizard_v2"/);
  assert.match(signup,/whatsapp_phone: normalizePhone\(whatsappPhone\)/);
  assert.match(signup,/whatsapp_contact_share_opt_in: isArtist && whatsappShare/);
  assert.match(signup,/whatsapp_notifications_opt_in: whatsappNotifications/);
  assert.match(signup,/checked=\{whatsappShare\}/);
  assert.match(signup,/checked=\{whatsappNotifications\}/);
  assert.match(signup,/termsAccepted/);
  assert.match(signup,/terms_version: termsVersion/);
  assert.match(signup,/href="\/privacidade"/);
  assert.match(signup,/href="\/termos"/);
  assert.match(signup,/username: null/);
  assert.doesNotMatch(signup,/verificação por código enviada|WhatsApp verificado/);
});
test("backend stores consent evidence privately and independently initializes both WhatsApp uses",()=>{
  assert.match(sql,/create table if not exists public\.stage_registration_consents/);
  assert.match(sql,/alter table public\.stage_registration_consents enable row level security/);
  assert.match(sql,/revoke all on table public\.stage_registration_consents from public, anon, authenticated/);
  assert.match(sql,/wizard_signup := new\.raw_user_meta_data ->> 'signup_flow' = 'wizard_v2'/);
  assert.match(sql,/if wizard_signup then/);
  assert.match(sql,/terms_accepted/);
  assert.match(sql,/privacy_acknowledged/);
  assert.match(sql,/chosen_phone !~ '\^55\[1-9\]\[0-9\]\{9,10\}\$'/);
  assert.match(sql,/insert into public\.musician_whatsapp_preferences/);
  assert.match(sql,/values \(new\.id, chosen_phone, allow_contact_share\)/);
  assert.match(sql,/insert into public\.stage_hiring_whatsapp_preferences/);
  assert.match(sql,/values \(new\.id, chosen_phone, allow_notifications\)/);
  assert.match(sql,/insert into public\.stage_registration_consents/);
  assert.match(sql,/revoke all on function public\.handle_new_user\(\) from PUBLIC,anon,authenticated/);
  assert.doesNotMatch(sql,/update public\.profiles set/);
});
test("signup links to real readable legal pages rather than unimplemented routes",()=>{
  const terms=read("app/termos/page.tsx"), privacy=read("app/privacidade/page.tsx");
  assert.match(terms,/Termos de Uso/);
  assert.match(privacy,/Política de Privacidade/);
  assert.match(terms,/2026-10-29-v1/);
  assert.match(privacy,/2026-10-29-v1/);
  assert.match(privacy,/número.*não é exposto automaticamente/);
});
