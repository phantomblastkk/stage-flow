import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pending = { id:string; phone:string };
/**
 * Dispatch intentionally opt-in and disabled by default. Designed for Vercel Cron
 * authenticated with CRON_SECRET or another secret. No user data in responses.
 * Meta Cloud API only sends the approved generic utility template.
 */
export async function GET(request:Request) {
 const cronSecret=process.env.STAGE_CHAT_CRON_SECRET || process.env.CRON_SECRET;
 if(!cronSecret||request.headers.get("authorization")!==`Bearer ${cronSecret}`) {
  return NextResponse.json({error:"unauthorized"},{status:401});
 }
 const enabled=process.env.STAGE_CHAT_WHATSAPP_ENABLED==="true";
 const serverKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const token=process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
 const phoneId=process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
 const template=process.env.WHATSAPP_CLOUD_TEMPLATE_NAME;
 if(!enabled) return NextResponse.json({status:"disabled",sent:0});
 if(!serverKey||!url||!token||!phoneId||!template) {
  return NextResponse.json({error:"missing_configuration"},{status:503});
 }
 const db=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc("stage_hiring_claim_notifications",{p_limit:10});
 if(error||!Array.isArray(data))return NextResponse.json({error:"queue_unavailable"},{status:503});
 let accepted=0,failed=0;
 for(const item of data as Pending[]){
  let success=false;let providerId="";let reason="";
  try{
   const version=process.env.WHATSAPP_GRAPH_API_VERSION||"v23.0";
   if(!/^v\d+\.\d+$/.test(version))throw Error("invalid_graph_version");
   const response=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`,{
    method:"POST",
    headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      messaging_product:"whatsapp",to:item.phone,type:"template",
      template:{name:template,language:{code:"pt_BR"}}
    }),
    signal:AbortSignal.timeout(12000)
   });
   const body=await response.json().catch(()=>null) as {messages?:{id?:string}[];error?:{code?:number}}|null;
   success=response.ok&&!!body?.messages?.[0]?.id;
   providerId=body?.messages?.[0]?.id||"";
   // Do not keep provider payloads or phone numbers in errors/logs.
   reason=success?"":`cloud_http_${response.status}`;
  }catch(e){reason=e instanceof Error&&e.message==="invalid_graph_version"?
    "invalid_graph_version":"cloud_request_failed";}
  const {error:completeError}=await db.rpc("stage_hiring_finish_notification",{
   p_id:item.id,p_success:success,p_provider_id:success?providerId:null,
   p_error:success?null:reason
  });
  if(completeError)failed++;else if(success)accepted++;else failed++;
 }
 return NextResponse.json({status:"ok",accepted_by_provider:accepted,failed,processed:data.length});
}
