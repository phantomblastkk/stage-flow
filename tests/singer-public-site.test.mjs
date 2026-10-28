import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const source=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const root=source("app/[username]/page.tsx");
const shared=source("components/public-singer-site.tsx");
const legacy=source("app/pro/[username]/page.tsx");
const legacyLayout=source("app/pro/[username]/layout.tsx");
const metadata=source("app/[username]/layout.tsx");
const style=source("components/public-singer-site.css");
const config=JSON.parse(source("vercel.json"));
const publication=source("app/meu-perfil-artistico/site-profissional/pro-publish-controls.tsx");

test("the public singer @ is the shared Pro-style design, whether free or entitled",()=>{
 assert.match(root,/PublicSingerSite/);
 assert.match(shared,/premium-site premium-theme-/);
 assert.match(shared,/premium-site-hero/);
 assert.match(shared,/premium-site-agenda/);
 assert.match(shared,/stage_public_pro_artist_site/);
 assert.match(shared,/stage_public_artist_page/);
 assert.match(shared,/stage_public_artist_events/);
 assert.match(shared,/stage_public_artist_accepts_bookings/);
 assert.match(shared,/setProUnlocked\(false\)/);
 assert.match(shared,/setProUnlocked\(true\)/);
 assert.match(shared,/proUnlocked\?"Recursos Pro publicados":proEligible\?"Pro liberado/);
 assert.match(shared,/Seu Pro já está liberado/);
});

test("free singer Pro features are deliberately blurred but no private content is fetched",()=>{
 assert.match(shared,/proUnlocked\s*\? <PremiumGalleryShowcase items=\{media\} section="photos"/);
 assert.match(shared,/proUnlocked\s*\? <PremiumGalleryShowcase items=\{media\} section="videos"/);
 assert.match(shared,/LockedProFeature type="photos"/);
 assert.match(shared,/LockedProFeature type="videos"/);
 assert.match(shared,/singer-premium-blurred/);
 assert.match(shared,/aria-hidden="true"/);
 assert.match(shared,/\/planos/);
 assert.match(shared,/const allMedia=Array\.isArray\(result\.media\)/);
 assert.match(shared,/setMedia\(\[\]\)/);
 assert.doesNotMatch(shared,/stage_premium_gallery_draft_list|stage_my_pro_site_publication/);
 assert.match(style,/filter:blur\(9px\)/);
});

test("old /pro/username is a compatibility redirect, not a paid 404 gate",()=>{
 assert.match(legacy,/permanentRedirect\("\/"\+encodeURIComponent\(username\)\)/);
 assert.match(legacy,/if\(!\/\^\[a-z0-9-\]\{3,30\}\$\/.test\(username\)\)notFound\(\)/);
 assert.ok(!legacyLayout.includes("getPublishedProSite("));
 assert.ok(!legacyLayout.includes("notFound("));
 assert.match(legacyLayout,/canonical:"\/"\+encodeURIComponent\(username\)/);
 assert.match(publication,/const canonicalProfilePath=info\?\.username/);
 assert.match(publication,/href=\{canonicalProfilePath\}/);
});

test("search and social metadata for the singer use only public server functions",()=>{
 assert.match(metadata,/getPublishedProSite\(username\)/);
 assert.match(metadata,/\.rpc\("stage_public_artist_page",\{p_username:username\}\)/);
 assert.match(metadata,/if\(error\|\|!data\|\|data\.username!==username\|\|!data\.name\)return unavailable/);
 assert.match(metadata,/index:false,follow:false,noarchive:true/);
 assert.match(metadata,/alternates:\{canonical\}/);
 assert.doesNotMatch(metadata,/SERVICE_ROLE|stage_my_artist_page|stage_my_pro_site_publication/);
});

test("main and develop require manual Vercel deployments",()=>{
 assert.equal(config.git.deploymentEnabled,false);
});

test("published musician links reuse the unified public page and keep safe metadata",()=>{
 const musicianMetadata=source("app/musico/[slug]/layout.tsx");
 const musicianPage=source("app/musico/[slug]/page.tsx");
 assert.match(musicianPage,/PublicSingerSite musicianSlug=\{slug\}/);
 assert.match(source("components/public-singer-site.tsx"),/stage_public_musician_portfolio/);
 assert.match(musicianMetadata,/stage_public_musician_portfolio/);
 assert.match(musicianMetadata,/createClient\(endpoint, anon/);
 assert.match(musicianMetadata,/if \(musician\.slug !== slug/);
 assert.match(musicianMetadata,/index: false, follow: false, noarchive: true/);
 assert.match(musicianMetadata,/NEXT_PUBLIC_STAGE_FLOW_ENV === "homologation"/);
 assert.match(musicianMetadata,/alternates: \{ canonical \}/);
 assert.match(musicianMetadata,/openGraph:/);
 assert.match(musicianMetadata,/twitter:/);
 assert.match(musicianMetadata,/safePublicImage/);
 assert.doesNotMatch(musicianMetadata,/SERVICE_ROLE|stage_my_musician_portfolio|stage_my_account_identity/);
});

test("singer URL helpers use the one canonical free-and-Pro public path",()=>{
 const helpers=source("lib/pro-site-public.ts");
 assert.match(helpers,/return getStageFlowOrigin\(\)\+"\/"\+encodeURIComponent\(username\)/);
 assert.doesNotMatch(helpers,/getStageFlowOrigin\(\)\+"\/pro\/"/);
 assert.doesNotMatch(helpers,/agenda de shows deste artista no Stage Flow Pro/);
});

test("singer has one editing workspace for free identity and Pro features",()=>{
 const editor=source("components/artist-profile-editor.tsx");
 const premium=source("components/singer-pro-editor.tsx");
 const legacyEditor=source("app/meu-perfil-artistico/site-profissional/page.tsx");
 assert.match(editor,/import SingerProEditor from/);
 assert.match(editor,/aria-label="Áreas do Perfil Artístico"/);
 assert.match(editor,/Dados e publicação/);
 assert.match(editor,/Aparência e galerias/);
 assert.match(editor,/activeTab === "dados"/);
 assert.match(editor,/proVisited &&/);
 assert.match(editor,/className="singer-editor-data-panel"/);
 assert.match(editor,/style=\{\{ display: activeTab === "dados" \? "block" : "none" \}\}/);
 assert.match(editor,/singer-editor-canonical/);
 assert.doesNotMatch(editor,/href="\/meu-perfil-artistico\/site-profissional"/);
 assert.match(legacyEditor,/redirect\("\/perfil-artistico\?aba=midia"\)/);
 assert.match(premium,/MESMO PERFIL PÚBLICO/);
 assert.match(premium,/O link antigo com \/pro\/ apenas redireciona/);
 assert.doesNotMatch(premium,/publicado em <strong>\/pro\//);
 assert.match(publication,/Endereço único do seu perfil de cantor/);
 assert.match(publication,/Ativar recursos Pro/);
 const tabs=source("app/meu-perfil-artistico/singer-unified-editor.css");
 assert.match(tabs,/\.singer-editor-tabs/);
 assert.match(tabs,/@media\(max-width:700px\)/);
});

test("musician showcase has calm colors, safe previews, and a real full-screen editor",()=>{
 const view=source("components/musician-portfolio-view.tsx");
 const musicianEditor=source("components/instrumentalist-profile-editor.tsx");
 const musicianCss=source("src/domains/artists/styles/musician-portfolio.css");
 const editorCss=source("src/domains/artists/styles/musician-portfolio-editor.css");
 const singerCss=source("app/meu-perfil-artistico/site-profissional/premium-preview.css");
 assert.doesNotMatch(view,/#c6f36b|label: "Lima"/);
 assert.doesNotMatch(musicianCss,/#c6f36b|#b2e65f/);
 assert.doesNotMatch(editorCss,/#c6f36b|#b2e65f|var\(--lime\)/);
 assert.doesNotMatch(singerCss,/#b2e65f|#d4f2a8/);
 assert.match(view,/portfolio\.accent === "lime" \? "violet"/);
 assert.match(view,/instanceId/);
 assert.match(view,/onClick=\{preview \? event => event\.preventDefault\(\) : undefined\}/);
 assert.match(musicianEditor,/aria-haspopup="dialog"/);
 assert.match(musicianEditor,/role="dialog" aria-modal="true"/);
 assert.match(musicianEditor,/event\.key === "Escape"/);
 assert.match(musicianEditor,/document\.body\.style\.overflow = "hidden"/);
 assert.match(musicianEditor,/instanceId="editor-compact"/);
 assert.match(musicianEditor,/instanceId="editor-full"/);
 assert.match(editorCss,/\.mp-preview-dialog/);
 assert.match(musicianCss,/@media\(max-width:520px\)/);
});

test("free singer chosen accent applies to the one shared public design",()=>{
 assert.match(shared,/palette\.includes\(artist\.accent as Accent\)/);
 assert.match(shared,/accent:palette\.includes/);
 const freeEditor=source("components/artist-profile-editor.tsx");
 assert.match(freeEditor,/\["lime", "Rosa", "#e6a3c8"\]/);
 const themes=source("app/meu-perfil-artistico/site-profissional/premium-preview.css");
 assert.match(themes,/\.premium-site-lime\{--pro-accent:#e6a3c8/);
});

test("public musician sharing falls back to a selectable URL when clipboard is blocked",()=>{
 const publicMusician=source("components/public-singer-site.tsx");
 const css=source("components/public-singer-site.css");
 assert.match(publicMusician,/setManualUrl\(url\)/);
 assert.match(publicMusician,/id="mp-manual-share" readOnly/);
 assert.match(publicMusician,/event=>event\.currentTarget\.select\(\)/);
 assert.match(css,/\.premium-profile-manual-share input:focus-visible/);
});

test("switching singer editor tabs refreshes eligibility and preserves the Pro draft",()=>{
 const editor=source("components/artist-profile-editor.tsx");
 const premium=source("components/singer-pro-editor.tsx");
 const publication=source("app/meu-perfil-artistico/site-profissional/pro-publish-controls.tsx");
 assert.match(editor,/proVisited &&/);
 assert.match(editor,/active=\{activeTab === "pro"\}/);
 assert.match(editor,/onEditData=\{\(\) => switchTab\("dados"\)\}/);
 assert.match(premium,/if \(!active \|\| loading\) return/);
 assert.match(premium,/stage_my_artist_page/);
 assert.match(premium,/onEditData\(\)/);
 assert.match(publication,/useEffect\(\(\)=>\{if\(active\)void load\(\);\},\[active\]\)/);
 assert.doesNotMatch(publication,/setInfo\(\{entitled:true/);
});


test("singer headline is written once in the autograph area, not repeated in the introduction",()=>{
 const presentation=source("lib/profile-presentation.ts");
 const editor=source("components/artist-profile-editor.tsx");
 assert.match(presentation,/export function distinctPublicBiography/);
 assert.match(presentation,/normalizeProfileCopy\(text\) === normalizeProfileCopy\(signature\)/);
 assert.match(presentation,/toLocaleLowerCase\("pt-BR"\)/);
 assert.match(shared,/distinctPublicBiography\(artist\.headline,artist\.bio\)/);
 assert.match(shared,/className="premium-site-signature"/);
 assert.match(shared,/className="premium-site-intro">\{biography/);
 assert.match(shared,/MINHA HISTÓRIA/);
 assert.match(shared,/<p>\{biography\|\|/);
 assert.doesNotMatch(shared,/artist\.bio\|\|artist\.headline/);
 assert.doesNotMatch(shared,/artist\.headline\|\|"Conheça meu trabalho/);
 assert.match(style,/\.premium-site-signature::before/);
 assert.match(style,/\.premium-site-signature::after/);
 assert.match(editor,/Frase de assinatura/);
 assert.match(editor,/Aparece apenas uma vez/);
 assert.match(editor,/artist-free-editor-preview-signature/);
});

test("musician bio is distinct from its featured headline",()=>{
 const musician=source("components/musician-portfolio-view.tsx");
 const musicianCss=source("src/domains/artists/styles/musician-portfolio.css");
 assert.match(musician,/distinctPublicBiography\(portfolio\.headline,portfolio\.bio\)/);
 assert.match(musician,/mp-description">\{biography \|\|/);
 assert.match(musicianCss,/scroll-snap-type:x proximity/);
});
