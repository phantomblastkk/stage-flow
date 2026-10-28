import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const src=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const panel=src("src/domains/dashboard/components/workspace-overview.tsx");
const shell=src("src/domains/navigation/components/workspace-shell.css");
const chat=src("app/conversas/conversas.css");
test("mobile panel displays actionable booking, invitations and chat priorities before promotional cards",()=>{
 const attention=panel.indexOf('className="sf-mobile-priority-rail"');
 const card=panel.indexOf('className="sf-operations-hero"');
 assert.ok(attention>0&&card>attention);
 for(const v of ["metrics.pending_contacts","metrics.pending_invites","metrics.unread_conversations"])
  assert.ok(panel.includes(v));
 assert.ok(shell.includes(".sf-mobile-priority-rail>a{"));
 assert.ok(shell.includes(".sf-operations-market>p{display:none}"));
});
test("mobile conversation keeps message composer accessible with iOS dynamic viewport and touch targets",()=>{
 assert.ok(chat.includes(".hiring-layout.has-active{height:clamp("));
 assert.ok(chat.includes("100dvh"));
 assert.ok(chat.includes(".hiring-messages{min-height:0;max-height:none"));
 assert.ok(chat.includes(".hiring-composer textarea{font-size:16px"));
 assert.ok(chat.includes(".hiring-composer .sf-ui-button{min-width:79px;min-height:44px"));
 assert.ok(shell.includes(".sf-workspace-route-content>.hiring-page>.container>.nav{display:none}"));
});
