import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const src=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const panel=src("app/painel/page.tsx");
const menu=src("components/dashboard-account-menu.tsx");
const menuCss=src("components/dashboard-account-menu.css");
const bell=src("components/notification-bell.tsx");
const inbox=src("app/notificacoes/page.tsx");

test("top-right avatar uses canonical singer/artist photo in both work modes",()=>{
 assert.ok(panel.includes("const accountPhoto=singerPhoto||musicianPhoto"));
 assert.ok(!panel.includes("accountPhoto=isSupport?"));
 assert.ok(panel.includes("avatarUrl={accountPhoto}"));
 assert.ok(menu.includes('className="dashboard-profile-avatar"'));
 assert.ok(menu.includes('className="dashboard-profile-summary-avatar"'));
 assert.ok(menuCss.includes("object-fit:cover"));
 assert.ok(menuCss.includes("position:absolute;inset:0;width:100%;height:100%"));
 assert.ok(menuCss.includes("overflow:hidden;position:relative"));
 assert.ok(menu.includes("onError={()=>setImageBroken(true)}"));
});

test("bell shows unread notices only, and removes a clicked item once read",()=>{
 assert.ok(bell.includes('p_filter: "unread", p_limit: 5'));
 assert.ok(bell.includes('stage_notifications_mark'));
 assert.ok(bell.includes('previous.filter(notice=>notice.id!==item.id)'));
 assert.ok(bell.includes('Math.max(0, count - 1)'));
 assert.ok(bell.includes("router.push(destination(item))"));
 assert.ok(bell.includes("Ver todas as notificações"));
 assert.ok(inbox.includes('useState<Filter>("unread")'));
 assert.ok(inbox.includes('filter==="unread"'));
 assert.ok(inbox.includes('items.filter(n=>n.id!==item.id)'));
 assert.ok(inbox.includes('aria-pressed={filter==="all"}'));
});
