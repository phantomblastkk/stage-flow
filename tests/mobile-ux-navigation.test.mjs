import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const get=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const nav=get("src/domains/navigation/components/workspace-mobile-nav.tsx");
const sidebar=get("src/domains/navigation/components/workspace-sidebar.tsx");
const marketplace=get("components/marketplace-catalog.tsx");
const shellCss=get("src/domains/navigation/components/workspace-shell.css");

test("mobile navigation has five consistent destinations including chat and account",()=>{
 for(const route of ["/painel","/eventos","/conversas","/marketplace","/minha-conta"])
  assert.ok(nav.includes('href:"'+route+'"'),"missing "+route);
 assert.ok(nav.includes('aria-current={active?"page":undefined}'));
 assert.ok(sidebar.includes("<WorkspaceMobileNav/>"));
 assert.ok(!sidebar.includes('label:"Convites",href:"/meus-convites"'));
});
test("Marketplace bottom navigation is restricted to signed-in users",()=>{
 assert.ok(marketplace.includes("authUser&&!preview&&<WorkspaceMobileNav/>"));
 assert.ok(marketplace.includes("authUser&&!preview?"));
 assert.ok(shellCss.includes("env(safe-area-inset-bottom)"));
 assert.ok(shellCss.includes("min-height:54px"));
});
