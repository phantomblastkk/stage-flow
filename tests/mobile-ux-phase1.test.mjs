import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const src=path=>readFileSync(resolve(process.cwd(),path),"utf8");
test("mobile Marketplace prioritizes searching and avoids three narrow recommendation cards",()=>{
 const code=src("components/marketplace-catalog.tsx");
 const css=src("components/marketplace-catalog.css");
 assert.ok(code.includes('className="market-discovery-body"'));
 assert.ok(css.includes(".market-discovery-body>.market-content{order:1"));
 assert.ok(css.includes(".market-discovery-body>.market-featured{order:2"));
 assert.ok(css.includes("grid-auto-columns:minmax(0,82%)"));
 assert.ok(!css.includes(".market-featured-rail{grid-auto-columns:calc((100% - 28px)/3)"));
 assert.ok(css.includes(".market-artist-card .market-favorite{width:44px;height:44px}"));
});
test("unified artistic identity and current Marketplace status are explained correctly",()=>{
 const signup=src("app/cadastro/page.tsx");
 const home=src("app/page.tsx");
 assert.ok(signup.includes("Quero ativar as duas funções na mesma conta"));
 assert.ok(signup.includes("terei um único perfil público"));
 assert.ok(!signup.includes("Meu perfil de cantor continua separado"));
 assert.ok(!home.includes("MARKETPLACE · EM BREVE"));
 assert.ok(home.includes("MARKETPLACE ABERTO"));
});
