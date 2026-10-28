import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const src=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const contactSql=src("supabase/stage_public_booking_contacts_migration.sql");
const expandedSql=src("supabase/stage_musician_portfolio_expanded_migration.sql");
const singer=src("components/public-singer-site.tsx");
const musician=src("components/musician-portfolio-view.tsx");
const menu=src("components/dashboard-account-menu.tsx");
const panel=src("app/painel/page.tsx");
const musicianEditor=src("components/instrumentalist-profile-editor.tsx");
const contactEditor=src("components/booking-contact-settings.tsx");
const contactHelpers=src("lib/booking-contact.ts");
const singerEditor=src("components/artist-profile-editor.tsx");

test("booking phone is opt-in, account-scoped and never uses private WhatsApp preferences",()=>{
 assert.match(contactSql,/create table if not exists public\.stage_public_booking_contacts/);
 assert.match(contactSql,/alter table public\.stage_public_booking_contacts enable row level security/);
 assert.match(contactSql,/revoke all on public\.stage_public_booking_contacts from public,anon,authenticated/);
 assert.match(contactSql,/primary key\(owner_id,kind\)/);
 assert.match(contactSql,/where p\.id=auth\.uid\(\) and p\.is_artist=true/);
 assert.match(contactSql,/p_mode='whatsapp'/);
 assert.match(contactSql,/v_phone !~ '\^55/);
 assert.match(contactSql,/p_kind='musician' and p_mode='form'/);
 assert.match(contactSql,/join public\.profiles p on p\.id=c\.owner_id/);
 assert.match(contactSql,/p\.is_public=true and p\.username=p_slug/);
 assert.match(contactSql,/m\.is_published=true and m\.slug=p_slug/);
 assert.match(contactSql,/case when c\.mode='whatsapp' then c\.phone_e164 else null end/);
 assert.doesNotMatch(contactSql,/musician_whatsapp_preferences|service_role|raw_user_meta_data/);
 assert.doesNotMatch(contactSql,/grant (?:insert|select|update|delete) on public\.stage_public_booking_contacts/i);
 assert.match(contactHelpers,/^export type BookingMode/m);
 assert.match(contactHelpers,/https:\/\/wa\.me\//);
 assert.match(contactHelpers,/encodeURIComponent\(text\)/);
 assert.match(contactHelpers,/\/\^55\[1-9\]/);
});

test("singer's booking button goes to chosen WhatsApp, Instagram or private form",()=>{
 assert.match(singer,/stage_public_booking_contact/);
 assert.match(singer,/p_kind:musicianSlug\?"musician":"singer"/);
 assert.match(singer,/whatsappBookingUrl\(bookingContact\?\.phone/);
 assert.match(singer,/contactMode==="instagram"/);
 assert.match(singer,/contactIsForm/);
 assert.match(singer,/Contratar artista/);
 assert.match(singer,/href=\{contactHref\|\|"#premium-contato"\}/);
 assert.match(singer,/target=\{contactHref\?"_blank":undefined\}/);
 assert.match(singer,/rel=\{contactHref\?"noopener noreferrer":undefined\}/);
 assert.doesNotMatch(singer,/musician_whatsapp_preferences/);
});

test("artists can select each role's booking channel separately",()=>{
 assert.match(contactEditor,/stage_my_booking_contact/);
 assert.match(contactEditor,/stage_save_booking_contact/);
 assert.match(contactEditor,/kind:"singer"\|"musician"/);
 assert.match(contactEditor,/Número público para contratação/);
 assert.match(contactEditor,/Seu telefone privado da conta nunca é usado/);
 assert.match(contactEditor,/p_phone:mode==="whatsapp"\?phone:null/);
 assert.match(contactEditor,/instagramConfigured/);
 assert.match(singerEditor,/<BookingContactSettings kind="singer"/);
 assert.match(musicianEditor,/<BookingContactSettings kind="musician"/);
});

test("musician offers direct bookable contact and inline consent-gated Youtube previews",()=>{
 assert.match(musician,/bookingContact\?:PublicBookingContact\|null/);
 assert.match(musician,/whatsappBookingUrl\(bookingContact\.phone/);
 assert.match(musician,/bookingContact\?\.mode==="instagram"/);
 assert.match(musician,/className="mp-action-booking"/);
 assert.match(musician,/target="_blank" rel="noopener noreferrer"/);
 assert.match(musician,/setPlayingVideo\(id\)/);
 assert.match(musician,/https:\/\/www\.youtube-nocookie\.com\/embed\//);
 assert.match(musician,/playing\?/);
 assert.match(musician,/allowFullScreen/);
 assert.match(musician,/is-primary/);
 assert.match(musician,/MEU INSTRUMENTO PRINCIPAL/);
 assert.match(musician,/instagram\.handle/);
 assert.match(src("components/public-singer-site.tsx"),/p_kind:musicianSlug\?"musician":"singer"/);
 assert.match(src("components/musician-portfolio-polish.css"),/object-position:center 22%/);
});

test("free musician editor expanded limits are validated by the database, not just React",()=>{
 assert.match(expandedSql,/stage_save_musician_portfolio_v4/);
 assert.match(expandedSql,/coalesce\(cardinality\(p_performance_types\),0\) > 8/);
 assert.match(expandedSql,/coalesce\(cardinality\(p_career_highlights\),0\) > 6/);
 assert.match(expandedSql,/coalesce\(cardinality\(p_additional_media_urls\),0\) > 4/);
 assert.match(expandedSql,/public\.stage_save_musician_portfolio_v2/);
 assert.match(expandedSql,/where profile_id = auth\.uid\(\)/);
 assert.match(expandedSql,/grant execute on function public\.stage_save_musician_portfolio_v4/);
 assert.match(musicianEditor,/stage_save_musician_portfolio_v4/);
 assert.match(musicianEditor,/additionalLinks\.length > 4/);
 assert.match(musicianEditor,/highlightList\.length > 6/);
 assert.match(musicianEditor,/performanceList\.length > 8/);
 assert.match(musician,/slice\(0, 5\)/);
 assert.doesNotMatch(expandedSql,/update public\.profiles|update auth\.users|plan_code/);
});

test("dashboard avatar chooses uploaded singer or musician photo, falls back to initials",()=>{
 assert.match(panel,/artist_avatar_path/);
 assert.match(panel,/stage_my_musician_portfolio/);
 assert.match(panel,/stage-artist-public/);
 assert.match(panel,/stage-musician-media/);
 assert.match(panel,/const accountPhoto=singerPhoto\|\|musicianPhoto/);
 assert.match(panel,/avatarUrl=\{accountPhoto\}/);
 assert.match(menu,/const portrait=avatarUrl&&!imageBroken/);
 assert.match(menu,/onError=\{\(\)=>setImageBroken\(true\)\}/);
 assert.match(menu,/dashboard-profile-avatar" aria-hidden="true">\{portrait\}/);
 assert.match(menu,/dashboard-profile-summary-avatar" aria-hidden="true">\{portrait\}/);
 assert.match(menu,/split\(\/\\s\+\/\)/);
 assert.match(src("components/dashboard-account-menu.css"),/object-fit:cover/);
});
