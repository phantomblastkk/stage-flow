import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const get=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const nav=get("src/domains/navigation/components/workspace-mobile-nav.tsx");
const sidebar=get("src/domains/navigation/components/workspace-sidebar.tsx");
const boundary=get("src/domains/navigation/components/workspace-boundary.tsx");
const ownerEdit=get("components/musician-owner-edit-button.tsx");
const publicArtist=get("components/public-singer-site.tsx");
const marketplace=get("components/marketplace-catalog.tsx");
const shellCss=get("src/domains/navigation/components/workspace-shell.css");

test("mobile navigation has five consistent destinations including chat and account",()=>{
 for(const route of ["/painel","/eventos","/conversas","/marketplace","/minha-conta"])
  assert.ok(nav.includes('href:"'+route+'"'),"missing "+route);
 assert.ok(nav.includes('aria-current={active?"page":undefined}'));
 assert.ok(boundary.includes("<WorkspaceMobileNav/>"));
 assert.ok(!sidebar.includes("<WorkspaceMobileNav/>"));
 assert.ok(!sidebar.includes('label:"Convites",href:"/meus-convites"'));
});
test("single mobile navigation covers public, authentication, Marketplace and private pages",()=>{
 assert.ok(boundary.includes("path !== \"/marketplace\""));
 assert.ok(boundary.includes("<WorkspaceMobileNav/>"));
 assert.ok(!marketplace.includes("<WorkspaceMobileNav/>"));
 assert.ok(marketplace.includes('className="market-shell has-mobile-workspace-nav"'));
 assert.ok(shellCss.includes("body{padding-bottom:calc(84px + env(safe-area-inset-bottom))}"));
 assert.ok(shellCss.includes("min-height:54px"));
});
test("public musician edit action requires authenticated ownership of a published portfolio",()=>{
 assert.ok(publicArtist.includes("<MusicianOwnerEditButton slug={musician.slug}/>"));
 assert.ok(ownerEdit.includes('client.auth.getUser()'));
 assert.ok(ownerEdit.includes('client.rpc("stage_my_musician_portfolio")'));
 assert.ok(ownerEdit.includes("data?.is_published === true && data?.slug === slug"));
 assert.ok(ownerEdit.includes('event === "SIGNED_OUT"'));
 assert.ok(ownerEdit.includes('href="/perfil-artistico?aba=instrumentista"'));
 assert.ok(ownerEdit.includes('if (!slug || ownedSlug !== slug) return null'));
});
