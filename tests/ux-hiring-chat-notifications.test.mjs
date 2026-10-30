import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const hiring=read("app/contratar/page.tsx");
const chat=read("app/conversas/page.tsx");
const chatCss=read("app/conversas/conversas.css");
const bell=read("components/notification-bell.tsx");
const bellCss=read("components/notification-bell.module.css");
const notices=read("app/notificacoes/page.tsx");

test("hiring sends organizers into the working Marketplace with selected event",()=>{
 assert.match(hiring,/eq\("producer_id",user\.id\)/);
 assert.match(hiring,/new URLSearchParams\(window\.location\.search\)\.get\("evento"\)/);
 assert.match(hiring,/isUuid\(target\)&&available\.some\(item=>item\.id===target\)/);
 assert.match(hiring,/\/marketplace\?evento=/);
 assert.match(hiring,/\/eventos\?novo=1&continuar=contratar/);
 assert.match(hiring,/href="\/conversas"/);
 assert.match(hiring,/href="\/convites"/);
 assert.doesNotMatch(hiring,/stage_discover_performance_profiles|stage_invite_performance_profile|stage_performance_availability/);
});
test("conversation list is searchable and unread-filterable without dropping the selected thread",()=>{
 assert.match(chat,/threadQuery/);
 assert.match(chat,/unreadOnly/);
 assert.match(chat,/thread\.unread>0\|\|thread\.id===activeId/);
 assert.match(chat,/type="search"/);
 assert.match(chat,/Nenhuma conversa corresponde à busca/);
 assert.match(chatCss,/@media\(max-width:750px\)/);
});
test("chat preserves the user's scroll position and offers manual jump to latest",()=>{
 assert.match(chat,/shouldStickToBottom/);
 assert.match(chat,/scrollHeight-el\.scrollTop-el\.clientHeight<96/);
 assert.match(chat,/showJumpToLatest/);
 assert.match(chat,/Ir para mensagens recentes/);
 assert.match(chat,/e\.ctrlKey\|\|e\.metaKey/);
 assert.match(chat,/requestSubmit\(\)/);
 assert.match(chatCss,/\.hiring-jump-latest/);
});
test("only the authenticated recipient's chat notices are acknowledged on thread opening",()=>{
 assert.match(chat,/stage_notifications_list/);
 assert.match(chat,/p_filter:"unread",p_limit:100/);
 assert.match(chat,/n\.source_type==="conversation"&&n\.thread_id===activeId/);
 assert.match(chat,/stage_notifications_mark/);
 assert.match(chat,/p_ids:ids,p_all:false/);
 assert.match(chat,/stageflow:notifications-updated/);
 assert.doesNotMatch(chat,/service_role|WHATSAPP_CLOUD_ACCESS_TOKEN|\.from\("stage_internal_notifications"\)/);
});
test("notification dropdown retries failures and refreshes after chat changes",()=>{
 assert.match(bell,/stageflow:notifications-updated/);
 assert.match(bell,/setRefreshRequest/);
 assert.match(bell,/Tentar novamente/);
 assert.match(bellCss,/\.retry/);
 assert.match(bell,/router\.push\(destination\(item\)\)/);
});
test("full notification inbox synchronizes after marking own notices read",()=>{
 assert.match(notices,/stageflow:notifications-updated/);
 assert.match(notices,/stage_notifications_mark/);
 assert.match(notices,/stage_notifications_list/);
 assert.match(notices,/Tentar novamente/);
 assert.match(notices,/type Filter="all"\|"unread"/);
});
