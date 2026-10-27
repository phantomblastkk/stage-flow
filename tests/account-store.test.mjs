import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { loadTsModule } from "./helpers/load-ts-module.mjs";
const { createAccountStore } = await loadTsModule("src/domains/account/account-store.ts");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const profile = (id, name) => ({ id, display_name: name, role: "musician", is_artist: true, is_singer: false,
  is_musician: true, is_producer: false, artist_kind: "support", username: null, city: null, is_public: false, artist_avatar_path: null });
const deferred = () => { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; };
async function until(predicate) { for(let n=0;n<100;n++){if(predicate())return;await delay(3);}throw Error("Timed out waiting for account state"); }
function fixture(initial = A) {
  const state = { userId: initial, authError: null, profileError: false, ownerAllowed: false, partnerItems: [], authCalls: 0, unsubscribed: 0, calls: [], pending: new Map() };
  const listeners = new Set(), oldListeners = [];
  const db = createClient("https://example.supabase.co", "fixture-only", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      const location = new URL(url), name = location.pathname.split("/").at(-1);
      const userId = name === "profiles" ? location.searchParams.get("id").slice(3) : state.userId;
      state.calls.push({ name, userId, signal: options.signal });
      if(name === "profiles") {
        const pending = state.pending.get(userId);
        if(pending) { state.pending.delete(userId);await pending.promise; }
        if(state.profileError) return new Response(JSON.stringify({message:"offline"}),{status:503,headers:{"Content-Type":"application/json"}});
      }
      const data = name === "profiles" ? profile(userId, userId === A ? "Conta A" : "Conta B")
        : name === "stage_owner_admin_status" ? state.ownerAllowed : { status: "ok", items: state.partnerItems };
      return new Response(JSON.stringify(data), {status:200,headers:{"Content-Type":"application/json"}});
    } },
  });
  const client = { from: db.from.bind(db), rpc: db.rpc.bind(db), auth: {
    getUser: async () => { state.authCalls++;return { data: { user: state.authError || !state.userId ? null : { id: state.userId, email: "test@example.test", user_metadata: { isOwnerAdmin: true } } }, error: state.authError }; },
    onAuthStateChange: listener => { listeners.add(listener);oldListeners.push(listener);return { data: { subscription: { unsubscribe: () => { state.unsubscribed++;listeners.delete(listener); } } } }; },
  } };
  return { state, client, oldListeners, listeners, emit(event,id=state.userId){state.userId=id;for(const listener of listeners)listener(event,id?{user:{id,user_metadata:{isOwnerAdmin:true}},access_token:"never-store-this"}:null);} };
}

test("one provider shares a single validated profile and permission read, never token/metadata authorization", async () => {
  const f=fixture(),store=createAccountStore(()=>f.client);
  const unsubs=[store.subscribe(()=>{}),store.subscribe(()=>{})];
  await store.start();await store.start();
  assert.equal(f.state.calls.filter(c=>c.name==="profiles").length,1);
  assert.equal(f.state.calls.find(c=>c.name==="profiles").userId,A);
  assert.equal(store.getSnapshot().profile.display_name,"Conta A");
  assert.equal(store.getSnapshot().permissions.isOwnerAdmin,false);
  assert.deepEqual(Object.keys(store.getSnapshot().user).sort(),["email","id"]);
  assert.ok(!JSON.stringify(store.getSnapshot()).includes("never-store-this"));
  assert.equal(store.getServerSnapshot().profile,null);
  assert.throws(()=>{store.getSnapshot().profile.display_name="mutated";});
  unsubs.forEach(unsub=>unsub());store.stop();
});

test("token refresh and repeated SIGNED_IN for the same user do not refetch the profile", async () => {
  const f=fixture(),store=createAccountStore(()=>f.client);await store.start();
  const first=store.getSnapshot().profile;
  for(let n=0;n<5;n++){f.emit("SIGNED_IN");f.emit("TOKEN_REFRESHED");}
  await delay(10);
  assert.equal(f.state.calls.filter(c=>c.name==="profiles").length,1);
  await store.refresh();
  assert.equal(store.getSnapshot().profile,first,"unchanged profiles retain their reference for memoized consumers");
  store.stop();
});

test("sign-out clears private state synchronously and late profile responses cannot resurrect it", async () => {
  const f=fixture(),pending=deferred();f.state.pending.set(A,pending);
  const store=createAccountStore(()=>f.client),loading=store.start();
  await until(()=>f.state.calls.some(c=>c.name==="profiles"));
  f.emit("SIGNED_OUT",null);
  assert.equal(store.getSnapshot().status,"signed_out");assert.equal(store.getSnapshot().profile,null);
  assert.equal(store.getSnapshot().user,null);assert.equal(store.getSnapshot().permissions.isOwnerAdmin,false);
  pending.resolve();await loading;
  assert.equal(store.getSnapshot().status,"signed_out");store.stop();
});

test("account switch discards an old refresh and changes the private descendant key", async () => {
  const f=fixture(),store=createAccountStore(()=>f.client);await store.start();
  const epoch=store.getSnapshot().epoch,pending=deferred();f.state.pending.set(A,pending);
  const oldRefresh=store.refresh();await until(()=>f.state.calls.filter(c=>c.name==="profiles").length===2);
  f.emit("SIGNED_IN",B);
  assert.equal(store.getSnapshot().profile,null);assert.equal(store.getSnapshot().status,"loading");
  assert.ok(store.getSnapshot().epoch>epoch);
  await until(()=>store.getSnapshot().profile?.id===B);
  pending.resolve();await oldRefresh;
  assert.equal(store.getSnapshot().profile.id,B);assert.equal(store.getSnapshot().profile.display_name,"Conta B");
  store.stop();
});

test("auth event callback schedules network work after the callback returns", async () => {
  const f=fixture(),store=createAccountStore(()=>f.client);await store.start();
  const reads=f.state.authCalls;f.emit("USER_UPDATED");
  assert.equal(f.state.authCalls,reads,"no Auth call is awaited/reentered under the Auth lock");
  await until(()=>f.state.calls.filter(c=>c.name==="profiles").length===2);
  await until(()=>!store.getSnapshot().refreshing);store.stop();
});

test("temporary verification failure keeps the same validated account with an error, without sign-out", async () => {
  const f=fixture(),store=createAccountStore(()=>f.client);await store.start();
  const old=store.getSnapshot().profile;
  f.state.authError={name:"AuthRetryableFetchError"};await store.refresh();
  assert.equal(store.getSnapshot().status,"ready");assert.equal(store.getSnapshot().profile,old);
  assert.match(store.getSnapshot().error,/sessão não foi encerrada/);
  f.state.authError=null;await store.refresh();assert.equal(store.getSnapshot().error,"");store.stop();
});

test("initial network failure is retryable and is distinct from an actually missing session", async () => {
  const f=fixture();f.state.authError={name:"AuthRetryableFetchError"};
  const store=createAccountStore(()=>f.client);await store.start();assert.equal(store.getSnapshot().status,"error");
  f.state.authError=null;await store.refresh();assert.equal(store.getSnapshot().status,"ready");
  f.state.userId=null;f.state.authError={name:"AuthSessionMissingError"};await store.refresh();
  assert.equal(store.getSnapshot().status,"signed_out");assert.equal(store.getSnapshot().profile,null);store.stop();
});

test("permission RPC failures and non-boolean approval fail closed for menu presentation", async () => {
  const f=fixture();f.state.ownerAllowed="true";f.state.partnerItems={length:10};
  const store=createAccountStore(()=>f.client);await store.start();
  assert.deepEqual(store.getSnapshot().permissions,{isOwnerAdmin:false,partnerHouseCount:0});store.stop();
});

test("stop/restart removes listeners and stale callbacks cannot mutate a remounted provider", async () => {
  const f=fixture(),store=createAccountStore(()=>f.client);await store.start();
  const old=f.oldListeners[0];store.stop();assert.equal(f.listeners.size,0);
  assert.equal(store.getSnapshot().profile,null);
  f.state.userId=B;await store.start();old("SIGNED_OUT",null);
  assert.equal(store.getSnapshot().profile.id,B);assert.equal(f.listeners.size,1);store.stop();
});

test("stores never share private snapshots and can retry a failed client factory", async () => {
  const a=fixture(A),b=fixture(B);let first=true;
  const left=createAccountStore(()=>a.client),right=createAccountStore(()=>{if(first){first=false;throw Error("not ready");}return b.client;});
  await left.start();await right.start();assert.equal(right.getSnapshot().status,"error");
  await right.refresh();assert.equal(right.getSnapshot().profile.id,B);left.stop();
  assert.equal(right.getSnapshot().profile.id,B);right.stop();
});

test("late initial Auth verification cannot query the previous account after a sign-in event", async () => {
  const f=fixture(),pending=deferred(),verify=f.client.auth.getUser;
  let first=true;
  f.client.auth.getUser=async()=>{const result=await verify();if(first){first=false;await pending.promise;}return result;};
  const store=createAccountStore(()=>f.client),starting=store.start();
  await until(()=>f.state.authCalls===1);f.emit("SIGNED_IN",B);
  await until(()=>store.getSnapshot().profile?.id===B);
  pending.resolve();await starting;
  assert.equal(f.state.calls.filter(c=>c.name==="profiles"&&c.userId===A).length,0);
  assert.equal(store.getSnapshot().profile.id,B);store.stop();
});

test("failed verification of a different account never restores the previous profile or permissions", async () => {
  const f=fixture();f.state.ownerAllowed=true;
  const store=createAccountStore(()=>f.client);await store.start();
  assert.equal(store.getSnapshot().permissions.isOwnerAdmin,true);
  f.state.authError={name:"AuthRetryableFetchError"};f.emit("SIGNED_IN",B);
  assert.equal(store.getSnapshot().profile,null);
  await until(()=>store.getSnapshot().status==="error");
  assert.equal(store.getSnapshot().user,null);assert.equal(store.getSnapshot().profile,null);
  assert.equal(store.getSnapshot().permissions.isOwnerAdmin,false);
  f.state.authError=null;f.state.ownerAllowed=false;await store.refresh();
  assert.equal(store.getSnapshot().profile.id,B);store.stop();
});
