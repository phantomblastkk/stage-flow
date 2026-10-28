import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const card=read("components/marketplace-catalog.tsx");
const css=read("components/marketplace-catalog.css");
const rpc=read("supabase/marketplace_moderation_migration.sql");

test("own portfolio gets a visible self label, not an invalid clickable favorite",()=>{
 assert.match(card,/authUserId===m\.musician_id/);
 assert.match(card,/ownProfile\s*\?/);
 assert.match(card,/className="market-own-profile"/);
 assert.match(card,/Seu perfil/);
 assert.match(card,/setAuthUserId\(user\?\.id\|\|null\)/);
 assert.match(rpc,/p_musician_id=auth\.uid\(\)/);
 assert.match(css,/\.market-own-profile\{/);
});
test("other musicians can be favorited with session-aware feedback and safe pending state",()=>{
 assert.match(card,/aria-pressed=\{musician\.is_favorite\}/);
 assert.match(card,/disabled=\{favoriteBusy\}/);
 assert.match(card,/stage_marketplace_toggle_favorite/);
 assert.match(card,/data!=="saved"/);
 for(const message of ["login_required","not_listed","not_released","invalid"])
   assert.ok(card.includes('data==="'+message+'"'),"missing error "+message);
 assert.match(card,/setFavoriteFeedback\(\{kind:"success",message:nextFavorite/);
 assert.match(card,/finally\s*\{\s*setFavoriteBusy\(null\)/);
 assert.match(card,/setFeatured\(old=>old\.map/);
 assert.match(card,/setItems\(old=>old\.map/);
 assert.match(rpc,/return 'saved'/);
 assert.match(rpc,/where owner_id=auth\.uid\(\) and musician_id=p_musician_id/);
});

test("favorite feedback is immediately visible near the thumb and dismissible",()=>{
 assert.ok(card.includes('className={"market-favorite-toast is-"+favoriteFeedback.kind}'));
 assert.ok(card.includes('aria-label="Fechar aviso de favoritos"'));
 assert.ok(card.includes('role={favoriteFeedback.kind==="error"?"alert":"status"}'));
 assert.ok(card.includes('setFavoriteFeedback({kind:"error",message:reason})'));
 assert.ok(css.includes("bottom:calc(91px + env(safe-area-inset-bottom))"));
});
