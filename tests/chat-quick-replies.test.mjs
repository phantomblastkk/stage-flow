import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const src=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const chat=src("app/conversas/page.tsx");
const css=src("app/conversas/conversas.css");

test("quick replies are role-specific editable drafts and never auto-send",()=>{
 assert.match(chat,/active\?\.acting_as==="musician"/);
 assert.match(chat,/Estou disponível nessa data\./);
 assert.match(chat,/Você tem disponibilidade nessa data\?/);
 assert.match(chat,/className="hiring-quick-replies" role="group"/);
 assert.match(chat,/type="button" key=\{reply\}/);
 assert.match(chat,/onClick=\{\(\)=>setText\(/);
 assert.match(chat,/text\.trimEnd\(\)/);
 assert.match(chat,/text\.length\+reply\.length\+1>1500/);
 assert.match(css,/\.hiring-quick-replies\{/);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/min-height:44px/);
});
