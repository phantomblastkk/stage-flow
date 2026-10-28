import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const get=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const sql=get("supabase/stage_hiring_public_launch_guard_20261028.sql");
const chat=get("app/conversas/page.tsx");
const market=get("components/marketplace-catalog.tsx");
const base=get("supabase/hiring_chat_whatsapp_migration.sql");

test("chat start only permits published artists who opted into Marketplace and are not moderated",()=>{
 assert.match(sql,/m\.is_published=true/);
 assert.match(sql,/s\.listed=true/);
 assert.match(sql,/stage_marketplace_hidden_musicians/);
 assert.match(sql,/p\.is_artist=true/);
 assert.match(sql,/p_musician_id=v_user/);
 assert.match(sql,/stage_hiring_can_start\(v_user\)/);
 assert.match(sql,/daily_limit/);
 assert.doesNotMatch(sql,/update public\.stage_hiring_control set released/);
 assert.match(base,/revoke all on public\.%I from public,anon,authenticated/);
 assert.match(base,/auth\.uid\(\) in \(t\.requester_id,t\.musician_id\)/);
});

test("Marketplace chat waits for authenticated identity and links to public catalog",()=>{
 assert.match(chat,/if\(account\.status==="loading"\)return/);
 assert.match(chat,/if\(account\.status!=="ready"\|\|!accountId\)return/);
 assert.match(chat,/startConversation\(createClient\(\),accountId,musician/);
 assert.match(chat,/href="\/marketplace"/);
 assert.doesNotMatch(chat,/href="\/marketplace\/preview"/);
 assert.match(market,/Iniciar chat privado/);
 assert.match(market,/\/conversas\?musico=/);
});
