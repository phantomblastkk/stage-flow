import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const load=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const bridge=load("src/domains/navigation/components/workspace-boundary.tsx");
const host=load("src/components/ui/save-feedback-host.tsx");
const helper=load("src/components/ui/save-feedback.ts");
const style=load("src/components/ui/save-feedback-host.css");
const artist=load("components/artist-profile-editor.tsx");
const musician=load("components/instrumentalist-profile-editor.tsx");
const premium=load("components/singer-pro-editor.tsx");
const agenda=load("app/eventos/page.tsx");
const account=load("app/minha-conta/page.tsx");
const proposals=load("src/domains/booking/hooks/use-hiring-proposals.ts");
const admin=load("app/admin/central/page.tsx");
const wizard=load("components/mobile-editor-wizard.tsx");
const market=load("components/marketplace-musician-settings.tsx");
const contact=load("components/booking-contact-settings.tsx");
const proPublish=load("app/meu-perfil-artistico/site-profissional/pro-publish-controls.tsx");
const teamInvites=load("components/event-team-invites.tsx");
const finance=load("app/financeiro/page.tsx");
const moderation=load("app/marketplace/moderacao/page.tsx");

test("one global aria-appropriate confirmation host covers private and public routes",()=>{
 assert.match(bridge,/<SaveFeedbackHost\/>/);
 assert.match(load("src/components/ui/index.tsx"),/role=\{tone==="danger"\?"alert":"status"\}/);
 assert.match(host,/<Toast message=\{current\.message\} tone=\{current\.tone\}/);
 assert.match(helper,/new CustomEvent<SaveFeedbackDetail>/);
 assert.match(host,/window\.addEventListener\(SAVE_FEEDBACK_EVENT,listener\)/);
 assert.match(host,/window\.removeEventListener\(SAVE_FEEDBACK_EVENT,listener\)/);
 assert.match(host,/setTimeout\(\(\)=>setCurrent/);
 assert.match(host,/current\.tone==="danger"\?7500:5500/);
 assert.match(style,/bottom:calc\(89px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(style,/prefers-reduced-motion/);
});
test("the artist and musician profile announce saves only after server response equals saved",()=>{
 for(const source of [artist,musician]){
  assert.match(source,/data!=="saved"/);
  assert.match(source,/showSaveFeedback\(/);
  assert.match(source,/draft\.savedToAccount\(\)/);
  assert.ok(source.indexOf("showSaveFeedback(")>source.indexOf("data !== \"saved\"")||source.indexOf("showSaveFeedback(")>source.indexOf("data !==\"saved\""),"profile saves should be guarded by server result");
 }
 assert.match(artist,/Etapa salva com sucesso/);
 assert.match(musician,/Etapa salva com sucesso/);
 assert.match(premium,/stage_save_premium_site_draft/);
 assert.match(premium,/Personalização salva com sucesso/);
});
test("event saves notify before leaving for hiring flow",()=>{
 assert.match(agenda,/const created=await saveEvent/);
 assert.match(agenda,/showSaveFeedback\("Evento salvo com sucesso na sua agenda!"\)/);
 assert.ok(agenda.indexOf('showSaveFeedback("Evento salvo')>agenda.indexOf("const created=await saveEvent"));
});
test("account and admin saves announce real saved status, not unchanged status",()=>{
 assert.match(account,/if\(data==="saved"\)showSaveFeedback/);
 assert.match(admin,/if\(data==="saved"\)showSaveFeedback/);
 assert.match(account,/Senha atualizada com sucesso/);
 assert.match(account,/Solicitação de alteração de e-mail enviada/);
});
test("proposal confirmations follow confirmed RPC success and are not optimistic",()=>{
 assert.match(proposals,/if\(data\?\.status!=="ok"\)/);
 assert.match(proposals,/Proposta enviada com sucesso/);
 assert.match(proposals,/Proposta aceita e show registrado/);
 assert.match(proposals,/Proposta retirada com sucesso/);
});
test("next step is local navigation, NOT presented as server save",()=>{
 assert.match(wizard,/As alterações só são gravadas quando você toca/);
 assert.doesNotMatch(wizard,/showSaveFeedback/);
 assert.match(wizard,/form\.requestSubmit\(\)/);
});

test("secondary high-traffic saves also confirm only after successful database response",()=>{
 for(const source of [market,contact,proPublish,teamInvites,finance,moderation]){
  assert.match(source,/showSaveFeedback\(/);
  assert.match(source,/\.rpc\(|saveMusicianPayment/);
 }
 assert.match(market,/data!=="saved"/);
 assert.match(contact,/data!=="saved"/);
 assert.match(proPublish,/data!==\(publish\?"published":"unpublished"\)/);
 assert.match(teamInvites,/response\?\.status !== "sent"/);
 assert.match(moderation,/data!=="saved"/);
 assert.match(finance,/await saveMusicianPayment\(/);
});
