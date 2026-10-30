import {createClient} from "@supabase/supabase-js";
import {NextRequest,NextResponse} from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const blockedSubscriptions=new Set(["active","trialing","past_due","unpaid","incomplete","paused"]);
const json=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});

/**
 * This is deliberately NOT an RPC that deletes auth.users from the browser.
 * The owner is verified with the caller's JWT; the service key never leaves Node.
 * Authorization, account ownership, paid plans and confirmation are all verified here.
 */
export async function DELETE(request:NextRequest,context:{params:Promise<{id:string}>}){
 const origin=request.headers.get("origin");
 const fetchSite=request.headers.get("sec-fetch-site");
 if(origin!==request.nextUrl.origin||(fetchSite&&fetchSite!=="same-origin"))
  return json("forbidden",403);
 const length=Number(request.headers.get("content-length")||0);
 if(!Number.isFinite(length)||length>2048)return json("invalid_request",400);
 const bearer=request.headers.get("authorization")||"";
 if(!/^Bearer [a-zA-Z0-9._-]{30,}$/.test(bearer))return json("unauthorized",401);
 const token=bearer.slice(7);
 const id=(await context.params).id;
 if(!uuid.test(id))return json("invalid_target",400);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anonKey||!secret)return json("admin_not_configured",503);

 let requestBody:unknown;
 try{
  const raw=await request.text();
  if(raw.length>2048)return json("invalid_request",400);
  requestBody=JSON.parse(raw);
 }catch{return json("invalid_request",400);}
 if(!requestBody||typeof requestBody!=="object"||Array.isArray(requestBody))
  return json("invalid_request",400);
 const body=requestBody as Record<string,unknown>;
 if(body.understood!==true||typeof body.confirmation!=="string"||body.confirmation.length>320)
  return json("confirmation_required",400);

 // Authenticate using the caller's bearer token; no service credentials here.
 const caller=createClient(url,anonKey,{
  auth:{autoRefreshToken:false,persistSession:false},
  global:{headers:{Authorization:`Bearer ${token}`}}
 });
 const {data:{user},error:authError}=await caller.auth.getUser(token);
 if(authError||!user)return json("unauthorized",401);
 if(user.id===id)return json("protected_account",403);
 const {data:isOwner,error:ownerError}=await caller.rpc("stage_owner_admin_status");
 if(ownerError||isOwner!==true)return json("forbidden",403);

 // The server-only client can manage Auth and write the private audit record.
 const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 const [targetResult,ownerResult,profileResult]=await Promise.all([
  admin.auth.admin.getUserById(id),
  admin.from("stage_owner_admins").select("profile_id").eq("profile_id",id).maybeSingle(),
  admin.from("profiles").select("plan_code,subscription_status").eq("id",id).maybeSingle()
 ]);
 if(targetResult.error||!targetResult.data.user)return json("not_found",404);
 if(ownerResult.error||profileResult.error)return json("account_check_unavailable",503);
 if(ownerResult.data)return json("protected_account",403);
 const target=targetResult.data.user;
 const expected="EXCLUIR "+(target.email||id);
 if(body.confirmation!==expected)return json("confirmation_mismatch",400);
 const profile=profileResult.data;
 if(profile&&(blockedSubscriptions.has(profile.subscription_status)||
    ["artist_plus","studio"].includes(profile.plan_code)))
  return json("billing_review_required",409);

 // Bounded administrative rate limit. Unavailable audits fail closed.
 const hour=new Date(Date.now()-60*60*1000).toISOString();
 const {count,error:countError}=await admin.from("stage_owner_admin_audit")
  .select("id",{head:true,count:"exact"})
  .eq("actor_id",user.id).eq("action","account_deletion_requested")
  .gte("happened_at",hour);
 if(countError||count===null)return json("audit_unavailable",503);
 if(count>=5)return json("rate_limited",429);
 const audit=async(action:"account_deletion_requested"|"account_deleted"|"account_deletion_failed")=>
  admin.from("stage_owner_admin_audit")
   .insert({actor_id:user.id,action,kind:"account",target_id:id});

 // Record the request BEFORE invoking the irreversible Supabase Auth API.
 const requested=await audit("account_deletion_requested");
 if(requested.error)return json("audit_unavailable",503);
 try{
  // Fail closed if permission changed between the checks and destructive call.
  const {data:stillOwner,error:stillOwnerError}=await caller.rpc("stage_owner_admin_status");
  if(stillOwnerError||stillOwner!==true){
   await audit("account_deletion_failed");
   return json("forbidden",403);
  }
  const {error:deleteError}=await admin.auth.admin.deleteUser(id,false);
  if(deleteError){
   // Supabase may block deletion for Storage ownership or FK dependencies;
   // do not manually delete dependent records outside the Auth transaction.
   await audit("account_deletion_failed");
   return json("account_has_dependencies",409);
  }
  const logged=await audit("account_deleted");
  if(logged.error){
   // Auth deletion already completed. Do not report failure or retry deletion.
   return NextResponse.json({status:"deleted",audit:"delayed"},{headers:{"Cache-Control":"no-store"}});
  }
  return NextResponse.json({status:"deleted"},{headers:{"Cache-Control":"no-store"}});
 }catch{
  await audit("account_deletion_failed");
  return json("deletion_unavailable",503);
 }
}
