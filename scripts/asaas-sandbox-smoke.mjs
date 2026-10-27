/**
 * Sandbox-only webhook smoke tests. Never sends a payment or changes Pro access.
 * Run against the QA deployment only, with a disposable random test token in
 * ASAAS_WEBHOOK_AUTH_TOKEN configured on QA and SANDBOX_WEBHOOK_TEST_TOKEN locally.
 * Without an explicit token this script only tests rejection of missing auth.
 */
const base=process.env.ASAAS_QA_BASE_URL||"https://stage-flow-homologacao.vercel.app";
const url=new URL("/api/asaas/webhook",base);
if(url.hostname!=="stage-flow-homologacao.vercel.app")throw Error("QA host required");
const testId="stageflow_smoke_"+crypto.randomUUID().replaceAll("-","").slice(0,24);
const sample={
 id:"evt_"+testId,
 event:"PAYMENT_CREATED",
 payment:{id:"pay_"+testId,subscription:null,status:"PENDING"}
};
async function post(token,payload=sample){
 const headers={"content-type":"application/json"};
 if(token)headers["asaas-access-token"]=token;
 const response=await fetch(url,{method:"POST",headers,body:JSON.stringify(payload)});
 return {status:response.status,body:await response.json().catch(()=>null)};
}
const noAuth=await post(null);
if(![401,503].includes(noAuth.status))throw Error("No-auth request unexpectedly accepted: "+noAuth.status);
console.log("No authentication rejected: HTTP "+noAuth.status);
const token=process.env.SANDBOX_WEBHOOK_TEST_TOKEN;
if(!token){console.log("Authenticated smoke test skipped (no test token configured).");process.exit(0)}
if(token.length<32)throw Error("Use a 32+ character disposable QA token");
const first=await post(token);
if(first.status!==200)throw Error("First sandbox event failed: "+JSON.stringify(first));
const duplicate=await post(token);
if(duplicate.status!==200)throw Error("Duplicate sandbox event failed: "+JSON.stringify(duplicate));
console.log("Sandbox event persisted and duplicate acknowledged");
