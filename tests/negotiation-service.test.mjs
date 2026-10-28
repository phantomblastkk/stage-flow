import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {loadTsModule} from './helpers/load-ts-module.mjs';
const {parseFeeInput,parseProposalFee}=await loadTsModule('src/domains/booking/model/fee-input.ts');
const service=await loadTsModule('src/domains/booking/services/negotiation-service.ts');
test('decimal negotiation input preserves cents and the supported upper bound',()=>{
 for(const [input,value] of [['0,01',0.01],[' 350,29 ',350.29],['350.29',350.29],['999999,99',999999.99]])assert.equal(parseFeeInput(input),value);
});
test('negotiation rejects exponent, hex, overflow, zero, negatives and extra decimals',()=>{
 for(const input of ['','0','-1','1e2','0x10','Infinity','NaN','1.001','1,000','1000000','99999999999999999999','1.000,50'])assert.equal(parseFeeInput(input),undefined,input);
});
test('an unknown formal fee is distinct from zero or an invalid number',()=>{
 assert.equal(parseProposalFee(' '),null);assert.equal(parseProposalFee('0'),undefined);assert.equal(parseProposalFee('400,50'),400.5);
});
function fixture(response){
 const calls=[];
 const db=createClient('https://example.supabase.co','fixture-only',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,options)=>{
 options.signal?.throwIfAborted();
 calls.push({name:new URL(url).pathname.split('/').at(-1),body:JSON.parse(options.body)});
 return new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json'}});
 }}});return {db,calls};
}
test('formal proposals preserve thread, amount, date and the atomic decision RPC',async()=>{
 const f=fixture({status:'schedule_conflict'});
 const args={p_thread_id:'thread',p_title:'Show',p_venue:null,p_city:null,p_starts_at:'2026-12-01T23:00:00Z',p_fee:null,p_details:null};
 await service.sendProposal(f.db,args);
 const result=await service.decideProposal(f.db,{p_proposal_id:'proposal',p_accept:true});
 assert.equal(result.data.status,'schedule_conflict');
 assert.deepEqual(f.calls,[{name:'stage_hiring_proposal_send',body:args},{name:'stage_hiring_proposal_decide',body:{p_proposal_id:'proposal',p_accept:true}}]);
});
test('fee agreement and counters retain server statuses without confirming participation',async()=>{
 const f=fixture('waiting_other');
 assert.equal((await service.offerFee(f.db,{p_invitation_id:'invite',p_amount:350.29,p_note:null})).data,'waiting_other');
 await service.acceptFee(f.db,{p_invitation_id:'invite'});
 assert.deepEqual(f.calls.map(c=>c.name),['stage_offer_fee','stage_accept_fee']);
 assert.equal(f.calls[0].body.p_amount,350.29);
});
test('read RPC builders remain abortable and never select public tables',async()=>{
 const f=fixture(null),request=new AbortController();request.abort();
 const result=await service.readFeeDetails(f.db,{p_invitation_id:'invite'}).abortSignal(request.signal);
 assert.ok(result.error);assert.equal(f.calls.length,0);
 await service.readProposals(f.db,{p_thread_id:'thread'});
 assert.ok(f.calls.every(c=>['stage_fee_details','stage_hiring_proposals'].includes(c.name)));
});

const {isFeeSnapshot}=await loadTsModule('src/domains/booking/model/fee-snapshot.ts');
const snapshot={status:'pending',is_owner:false,has_offer:true,last_amount:400,last_by_me:false,last_note:null,agreed_amount:null,history:[]};
test('a private pending offer is valid without inventing an agreement',()=>{assert.equal(isFeeSnapshot(snapshot),true);assert.equal(isFeeSnapshot({...snapshot,agreed_amount:400}),true);});
test('malformed or forbidden fee responses cannot appear as agreed amounts',()=>{for(const value of [null,{},[],{status:'forbidden'},{...snapshot,agreed_amount:undefined},{...snapshot,agreed_amount:'400'},{...snapshot,last_amount:NaN},{...snapshot,history:[{amount:-1}]}])assert.equal(isFeeSnapshot(value),false);});

test('an invitation without an offer accepts the SQL null author flag',()=>{assert.equal(isFeeSnapshot({...snapshot,has_offer:false,last_amount:null,last_by_me:null}),true);assert.equal(isFeeSnapshot({...snapshot,has_offer:true,last_amount:null}),false);});

const {isProposalSnapshot}=await loadTsModule('src/domains/booking/model/proposal-snapshot.ts');
const proposal={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Show',venue:null,city:null,details:null,starts_at:'2026-12-02T23:00:00Z',created_at:'2026-11-01T15:00:00Z',responded_at:null,status:'pending',fee_amount:null,linked_event_id:null,linked_invitation_id:null};
test('formal snapshot distinguishes an empty inbox from an invalid response',()=>{assert.equal(isProposalSnapshot([]),true);for(const value of [null,{},[{status:'forbidden'}]])assert.equal(isProposalSnapshot(value),false);});
test('formal snapshot preserves unknown fees and accepted linked show IDs',()=>{assert.equal(isProposalSnapshot([proposal]),true);assert.equal(isProposalSnapshot([{...proposal,status:'accepted',fee_amount:400.25,linked_event_id:proposal.id,linked_invitation_id:proposal.id}]),true);});
test('formal snapshot rejects malformed money, dates, status and links',()=>{for(const invalid of [{fee_amount:'400'},{fee_amount:NaN},{fee_amount:0},{starts_at:'invalid'},{status:'forbidden'},{linked_event_id:'javascript:alert(1)'},{id:'bad'}])assert.equal(isProposalSnapshot([{...proposal,...invalid}]),false);});
