import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const sql=read("supabase/internal_notifications_migration.sql");
const page=read("app/notificacoes/page.tsx");
const bell=read("components/notification-bell.tsx");
const dashboard=read("app/painel/page.tsx");
const conversation=read("app/conversas/page.tsx");
function func(name){
 const begin=sql.indexOf("create or replace function public."+name+"(");
 assert.notEqual(begin,-1,"Function missing: "+name);
 const end=sql.indexOf("\n$$;",begin);
 assert.notEqual(end,-1,"Unterminated "+name);
 return sql.slice(begin,end);
}
test("notification table is private and alerts are tied to business-record transactions",()=>{
 assert.match(sql,/create table if not exists public\.stage_internal_notifications/);
 assert.match(sql,/alter table public\.stage_internal_notifications enable row level security/);
 assert.match(sql,/revoke all on public\.stage_internal_notifications from public,anon,authenticated/);
 assert.match(sql,/unique\(recipient_id,source_type,source_id,event_code\)/);
 assert.match(sql,/after insert or update of status on public\.invitations/);
 assert.match(sql,/after insert or update of status on public\.stage_hiring_proposals/);
 assert.match(sql,/after insert on public\.stage_hiring_messages/);
 assert.doesNotMatch(sql,/\bhttp_post\b|\bpg_net\b|whatsapp\.com|graph\.facebook\.com/);
});
test("invitation status transitions route notices only to the correct account",()=>{
 const src=func("stage_notify_invitation_trigger");
 assert.match(src,/v_to:=new\.musician_id;v_code:='invite_received'/);
 assert.match(src,/v_to:=v_owner;v_code:='invite_accepted'/);
 assert.match(src,/v_to:=v_owner;v_code:='invite_declined'/);
 assert.match(src,/v_to:=new\.musician_id;v_code:='invite_cancelled'/);
 assert.match(src,/new\.status is not distinct from old\.status/);
 assert.match(src,/on conflict\(recipient_id,source_type,source_id,event_code\) do nothing/);
});
test("proposal status and chat notices are private, with chat grouped by thread",()=>{
 const proposal=func("stage_notify_proposal_trigger");
 assert.match(proposal,/v_to:=new\.musician_id;v_code:='proposal_received'/);
 assert.match(proposal,/v_to:=new\.requester_id;v_code:='proposal_accepted'/);
 assert.match(proposal,/v_to:=new\.requester_id;v_code:='proposal_declined'/);
 assert.match(proposal,/v_to:=new\.musician_id;v_code:='proposal_withdrawn'/);
 assert.match(proposal,/on conflict\(recipient_id,source_type,source_id,event_code\) do nothing/);
 const chat=func("stage_notify_chat_message_trigger");
 assert.match(chat,/t\.requester_id=new\.sender_id/);
 assert.match(chat,/t\.musician_id=new\.sender_id/);
 assert.match(chat,/v_to is null then return new/);
 assert.match(chat,/on conflict\(recipient_id,source_type,source_id,event_code\)/);
 assert.match(chat,/do update set read_at=null,created_at=excluded\.created_at/);
 assert.doesNotMatch(chat,/new\.body,'/);
});
test("list/read/count all require auth.uid and mark cannot affect other accounts",()=>{
 const list=func("stage_notifications_list");
 const mark=func("stage_notifications_mark");
 const count=func("stage_notifications_unread_count");
 assert.match(list,/recipient_id=auth\.uid\(\)/);
 assert.match(list,/p_filter not in \('all','unread'\)/);
 assert.match(list,/p_limit not between 1 and 100/);
 assert.match(mark,/n\.recipient_id=auth\.uid\(\)/);
 assert.match(mark,/cardinality\(p_ids\)>100/);
 assert.match(count,/recipient_id=auth\.uid\(\)/);
 assert.match(sql,/grant execute on function public\.stage_notifications_list\(text,integer\) to authenticated/);
 assert.match(sql,/grant execute on function public\.stage_notifications_mark\(uuid\[\],boolean\) to authenticated/);
 assert.match(sql,/grant execute on function public\.stage_notifications_unread_count\(\) to authenticated/);
});
test("new inbox shows unread filters, acknowledges own notices and navigates safely",()=>{
 assert.match(page,/stage_notifications_list/);
 assert.match(page,/stage_notifications_mark/);
 assert.match(page,/Marcar todas como lidas/);
 assert.match(page,/Abrir assunto/);
 assert.match(page,/\/conversas\?conversa=/);
 assert.match(page,/\/meus-convites/);
 assert.match(page,/\/convites\?evento=/);
 assert.match(page,/document\.visibilityState==="visible"/);
 assert.match(dashboard,/href:"\/notificacoes"/);
 assert.match(dashboard,/<NotificationBell\/>/);
 assert.match(bell,/stage_notifications_unread_count/);
 assert.match(conversation,/query\.get\("conversa"\)/);
 assert.match(conversation,/openedThreads\.some\(item=>item\.id===conversation\)/);
 assert.doesNotMatch(page,/service_role|WHATSAPP_CLOUD_ACCESS_TOKEN/);
});

test("bell opens a five-item preview and keeps full inbox available",()=>{
 const css=read("components/notification-bell.module.css");
 assert.match(bell,/useState\(false\)/);
 assert.match(bell,/aria-expanded=\{open\}/);
 assert.match(bell,/aria-controls=\{panelId\}/);
 assert.match(bell,/setOpen\(value => !value\)/);
 assert.match(bell,/stage_notifications_list/);
 assert.match(bell,/p_filter: "all", p_limit: 5/);
 assert.match(bell,/stage_notifications_unread_count/);
 assert.match(bell,/stage_notifications_mark/);
 assert.match(bell,/p_ids: \[item.id\], p_all: false/);
 assert.match(bell,/router\.push\(destination\(item\)\)/);
 assert.match(bell,/\/conversas\?conversa=/);
 assert.match(bell,/\/convites\?evento=/);
 assert.match(bell,/\/meus-convites/);
 assert.match(bell,/Ver todas as notificações/);
 assert.match(bell,/role="region"/);
 assert.match(bell,/event\.key === "Escape"/);
 assert.match(bell,/document\.addEventListener\("pointerdown"/);
 assert.match(bell,/document\.visibilityState !== "visible"/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/max-height/);
 assert.doesNotMatch(bell,/service_role|WHATSAPP_CLOUD_ACCESS_TOKEN|\.from\("stage_internal_notifications"\)/);
});


test("notification links focus the invitation belonging to the signed-in musician",()=>{
 const invites=read("app/meus-convites/page.tsx");
 assert.match(page,/\/meus-convites\?convite=/);
 assert.match(bell,/\/meus-convites\?convite=/);
 assert.match(page,/encodeURIComponent\(n\.source_id\)/);
 assert.match(bell,/encodeURIComponent\(item\.source_id\)/);
 assert.match(page,/\^\[0-9a-f\]\{8\}/);
 assert.match(bell,/\^\[0-9a-f\]\{8\}/);
 assert.match(invites,/focusedFromNotification = useRef\(false\)/);
 assert.match(invites,/invites\.some\(invite => invite\.id === id\)/);
 assert.match(invites,/setFilter\("all"\)/);
 assert.match(invites,/getElementById\("convite-" \+ id\)/);
 assert.match(invites,/scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
 assert.match(invites,/tabIndex=\{-1\}/);
 assert.match(invites,/highlightedInvite === invite\.id/);
 assert.match(invites,/stage_my_invitations/);
 assert.doesNotMatch(page,/source_id\)\+"https?:/);
});


test("inbox opens urgent briefing even if marking read fails or session refresh is transient",()=>{
 assert.match(page,/authClient\.auth\.getUser\(\)/);
 assert.match(page,/authClient\.auth\.getSession\(\)/);
 assert.match(page,/Sua conta não foi desconectada/);
 assert.match(page,/if\(!user\)\{router\.replace\("\/login"\);return;\}/);
 assert.match(page,/if\(!item\.read_at\)\{\s*try\{\s*await mark\(\[item\.id\]\);/);
 assert.match(page,/router\.push\(destination\(item\)\)/);
 assert.match(page,/Mark-as-read failures must not block/);
});
