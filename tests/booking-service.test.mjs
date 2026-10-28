import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadTsModule } from "./helpers/load-ts-module.mjs";
const service=await loadTsModule("src/domains/booking/services/booking-service.ts");
const links=await loadTsModule("src/domains/booking/model/booking-links.ts");
const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const signal=()=>new AbortController().signal;
function fixture(responses={},auth={data:{user:{id:A}},error:null}){
 const calls=[];
 const db=createClient("https://example.supabase.co","fixture-only",{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:async(url,options)=>{
   const name=new URL(url).pathname.split("/").at(-1),body=options.body?JSON.parse(options.body):null;
   calls.push({name,body});
   const value=responses[name];const result=typeof value==="function"?await value():value;
   return new Response(JSON.stringify(result),{status:200,headers:{"Content-Type":"application/json"}});
  }}
 });
 return {calls,db:{auth:{getUser:async()=>auth},rpc:db.rpc.bind(db)}};
}
test("booking links retain exact event/conversation IDs and reject injected or malformed IDs",()=>{
 assert.equal(links.invitationAgendaHref(A),"/eventos?evento="+A);
 assert.equal(links.conversationHref(B),"/conversas?conversa="+B);
 for(const id of ["../admin","x".repeat(36),A+"&equipe=1",""]){
  assert.throws(()=>links.invitationAgendaHref(id));assert.throws(()=>links.conversationHref(id));
 }
 assert.equal(links.validBookingDate("2028-02-29"),true);
 for(const date of ["2026-02-29","2026-02-31","2026-13-01","2026-1-1"])assert.equal(links.validBookingDate(date),false);
});
test("booking reads use private RPCs with the real request builder",async()=>{
 const f=fixture({stage_my_invitations:[{id:A}],stage_hiring_list:[{id:B}],stage_hiring_messages:{status:"ok",messages:[{body:"Private fixture"}]}});
 assert.deepEqual(await service.loadInvitations(f.db,signal()),[{id:A}]);
 assert.deepEqual(await service.loadThreads(f.db,signal()),[{id:B}]);
 assert.deepEqual(await service.loadThreadMessages(f.db,B,signal()),[{body:"Private fixture"}]);
 assert.deepEqual(f.calls.map(c=>c.name),["stage_my_invitations","stage_hiring_list","stage_hiring_messages"]);
 assert.deepEqual(f.calls[2].body,{p_thread_id:B});
});
test("malformed/forbidden booking responses never masquerade as an empty inbox",async()=>{
 const f=fixture({stage_my_invitations:null,stage_hiring_list:{status:"forbidden"},stage_hiring_messages:{status:"ok",messages:null}});
 await assert.rejects(service.loadInvitations(f.db,signal()),/carregar os convites/);
 await assert.rejects(service.loadThreads(f.db,signal()),/lista de conversas/);
 await assert.rejects(service.loadThreadMessages(f.db,A,signal()),/abrir as mensagens/);
});
test("aborted booking reads discard a late successful response",async()=>{
 const request=new AbortController();
 const f=fixture({stage_hiring_messages:()=>{request.abort();return {status:"ok",messages:[{body:"Old"}]};}});
 await assert.rejects(service.loadThreadMessages(f.db,A,request.signal),{name:"AbortError"});
});
test("responding preserves fee_pending and already_responded without faking acceptance",async()=>{
 for(const result of ["accepted","declined","fee_pending","already_responded"]){
  const f=fixture({stage_respond_invite:result});
  assert.equal(await service.respondToInvitation(f.db,A,B,true),result);
  assert.deepEqual(f.calls[0].body,{p_invitation_id:B,p_accept:true});
 }
 const denied=fixture({stage_respond_invite:"not_found"});
 await assert.rejects(service.respondToInvitation(denied.db,A,B,true),/Não foi possível responder/);
});
test("account mismatch blocks all booking mutations before any RPC",async()=>{
 const f=fixture({}, {data:{user:{id:B}},error:null});
 for(const operation of [()=>service.respondToInvitation(f.db,A,B,true),()=>service.sendThreadMessage(f.db,A,B,"Test"),
  ()=>service.startConversation(f.db,A,B,null,null),()=>service.saveThreadAvailability(f.db,A,B,"available")])
  await assert.rejects(operation(),/Sua conta mudou/);
 assert.equal(f.calls.length,0);
});
test("temporary Auth failure never becomes a missing session or sends a message",async()=>{
 const retry=fixture({}, {data:{user:null},error:{name:"AuthRetryableFetchError"}});
 await assert.rejects(service.sendThreadMessage(retry.db,A,B,"Test"),error=>!(error instanceof service.BookingSessionRequired)&&/não foi desconectada/.test(error.message));
 assert.equal(retry.calls.length,0);
 const absent=fixture({}, {data:{user:null},error:{name:"AuthSessionMissingError"}});
 await assert.rejects(service.respondToInvitation(absent.db,A,B,false),service.BookingSessionRequired);
 assert.equal(absent.calls.length,0);
});
test("message validation precedes RPC and trims content without leaking SQL errors",async()=>{
 const f=fixture({stage_hiring_send:{status:"ok"}});
 for(const text of [" ","a".repeat(1501)])await assert.rejects(service.sendThreadMessage(f.db,A,B,text),/1.500/);
 assert.equal(f.calls.length,0);
 await service.sendThreadMessage(f.db,A,B,"  Olá  ");
 assert.deepEqual(f.calls[0].body,{p_thread_id:B,p_body:"Olá"});
 const throttled=fixture({stage_hiring_send:{status:"rate_limited"}});
 await assert.rejects(service.sendThreadMessage(throttled.db,A,B,"Olá"),/muitas mensagens/);
});
test("starting a conversation carries musician/date/event and rejects impossible dates",async()=>{
 const f=fixture({stage_hiring_start:{status:"ok",thread_id:B}});
 for(const date of ["2026-02-31","2026-13-01"])await assert.rejects(service.startConversation(f.db,A,B,date,A),/Data inválida/);
 assert.equal(f.calls.length,0);
 assert.equal(await service.startConversation(f.db,A,B,"2026-11-01",A),B);
 assert.deepEqual(f.calls[0].body,{p_musician_id:B,p_date:"2026-11-01",p_event_id:A});
 const unavailable=fixture({stage_hiring_start:{status:"not_released"}});
 await assert.rejects(service.startConversation(unavailable.db,A,B,null,null),/não está disponível para esta conta/);
});
test("availability changes retain the participant-scoped RPC contract",async()=>{
 const f=fixture({stage_hiring_availability:"saved"});
 await service.saveThreadAvailability(f.db,A,B,"ask_later");
 assert.deepEqual(f.calls[0].body,{p_thread_id:B,p_response:"ask_later"});
});
