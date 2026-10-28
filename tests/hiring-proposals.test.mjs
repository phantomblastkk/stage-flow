import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const sql=read("supabase/hiring_formal_proposals_migration.sql");
const component=read("components/hiring-proposals.tsx")+read("src/domains/booking/hooks/use-hiring-proposals.ts")+read("src/domains/booking/services/negotiation-service.ts");
const inbox=read("app/conversas/page.tsx");
function fn(name){
 const at=sql.indexOf("create or replace function public."+name+"(");
 assert.notEqual(at,-1,"Missing "+name);
 const end=sql.indexOf("\n$$;",at);
 assert.notEqual(end,-1,"No function terminator "+name);
 return sql.slice(at,end);
}

test("proposals are private and only chat participants can read",()=>{
 assert.match(sql,/alter table public\.stage_hiring_proposals enable row level security/);
 assert.match(sql,/revoke all on public\.stage_hiring_proposals from public,anon,authenticated/);
 assert.match(fn("stage_hiring_proposals"),/auth\.uid\(\) in \(requester_id,musician_id\)/);
 assert.match(sql,/create unique index if not exists stage_hiring_one_pending_proposal_idx/);
});
test("only chat requester can send, not for a different event or date",()=>{
 const src=fn("stage_hiring_proposal_send");
 assert.match(src,/requester_id=auth\.uid\(\) for update/);
 assert.match(src,/v_thread\.requested_date is not null/);
 assert.match(src,/producer_id=auth\.uid\(\)/);
 assert.match(src,/status='pending'/);
 assert.match(src,/status='accepted'/);
 assert.match(src,/p_starts_at<=now\(\)/);
 assert.match(src,/round\(p_fee,2\)<>p_fee/);
 assert.match(src,/stage_hiring_send\(p_thread_id/);
});
test("only musician can accept or decline; accepted creates private show and accepted invite",()=>{
 const src=fn("stage_hiring_proposal_decide");
 assert.match(src,/musician_id=auth\.uid\(\) for update/);
 assert.match(src,/v_proposal\.status<>'pending'/);
 assert.match(src,/existing_invite/);
 assert.match(src,/show_publicly/);
 assert.match(src,/'draft',false/);
 assert.match(src,/insert into public\.invitations/);
 assert.match(src,/'accepted',now\(\)/);
 assert.match(src,/insert into public\.stage_fee_negotiations/);
 assert.match(src,/linked_event_id=v_event,linked_invitation_id=v_invitation/);
 assert.match(src,/status='declined'/);
 assert.match(src,/stage_hiring_send\(v_proposal\.thread_id/);
});
test("requester can withdraw without deleting negotiation history",()=>{
 const src=fn("stage_hiring_proposal_withdraw");
 assert.match(src,/requester_id=auth\.uid\(\)/);
 assert.match(src,/status='withdrawn'/);
 assert.doesNotMatch(src,/delete\s+from\s+public\.stage_hiring_proposals/i);
});
test("chat includes form and feedback with no payment or secrets in browser",()=>{
 assert.match(inbox,/HiringProposals key=\{active\.id\}/);
 assert.match(component,/stage_hiring_proposal_send/);
 assert.match(component,/stage_hiring_proposal_decide/);
 assert.match(component,/stage_hiring_proposal_withdraw/);
 assert.match(component,/Nova proposta|Montar proposta/);
 assert.match(component,/linked_event_id/);
 assert.match(component,/Proposta enviada/);
 assert.doesNotMatch(component,/SUPABASE_SERVICE_ROLE_KEY|WHATSAPP_CLOUD_ACCESS_TOKEN/);
});
