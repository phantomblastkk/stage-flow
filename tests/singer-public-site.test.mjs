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
 assert.match(shared,/proUnlocked\?\s*"Site Pro publicado":"Perfil público gratuito"/);
 assert.match(shared,/Seu site já tem o visual profissional do StageFlow/);
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
 assert.doesNotMatch(legacyLayout,/getPublishedProSite|\\bnotFound\\s*\\(/);
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
 assert.deepEqual(config.git.deploymentEnabled,{develop:false,main:false});
});
