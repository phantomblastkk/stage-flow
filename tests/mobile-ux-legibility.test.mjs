import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const get=p=>readFileSync(resolve(process.cwd(),p),"utf8");
test("small-screen operational content uses readable typography and touch targets",()=>{
 const nav=get("src/domains/navigation/components/workspace-shell.css");
 const account=get("app/minha-conta/minha-conta.css");
 const notice=get("app/notificacoes/notificacoes.css");
 const profile=get("components/public-singer-site.css");
 assert.ok(nav.includes(".sf-workspace-activity-copy strong{font-size:14px}"));
 assert.ok(nav.includes(".sf-workspace-group-items .sf-workspace-link{min-height:44px"));
 assert.ok(account.includes(".account-form input,.account-form select,.account-form textarea{font-size:16px}"));
 assert.ok(notice.includes(".notifications-item-actions .btn,.notifications-actions .btn{font-size:13px;min-height:44px}"));
 assert.ok(profile.includes(".pro-public-page .premium-site-socials a{width:44px;height:44px}"));
});
