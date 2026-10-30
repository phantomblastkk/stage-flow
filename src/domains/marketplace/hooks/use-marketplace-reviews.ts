"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";

export type MarketReview={id:string;organizer_name:string|null;rating:number;comment:string|null;created_at:string};
export type ReviewableEvent={event_id:string;event_title:string;starts_at:string;reviewed:boolean};
const date=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
function isReview(value:unknown):value is MarketReview{
 if(!value||typeof value!=="object")return false;
 const row=value as Record<string,unknown>;
 return typeof row.id==="string"&&(row.organizer_name===null||typeof row.organizer_name==="string")&&
  Number.isInteger(row.rating)&&Number(row.rating)>=1&&Number(row.rating)<=5&&
  (row.comment===null||typeof row.comment==="string")&&date(row.created_at);
}
function isReviewable(value:unknown):value is ReviewableEvent{
 if(!value||typeof value!=="object")return false;
 const row=value as Record<string,unknown>;
 return typeof row.event_id==="string"&&typeof row.event_title==="string"&&date(row.starts_at)&&typeof row.reviewed==="boolean";
}

type Snapshot<T>={owner:string|null;items:T[];loading:boolean;ready:boolean;error:string};
function useReviewRead<T>(owner:string|null,enabled:boolean,rpc:string,valid:(value:unknown)=>value is T,failure:string,scope=""){
 const cacheKey=owner?owner+":"+scope:null;
 const [snapshot,setSnapshot]=useState<Snapshot<T>>({owner:null,items:[],loading:false,ready:false,error:""});
 const mounted=useRef(false),version=useRef(0),reading=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;version.current++;reading.current=false;};},[]);
 const reload=useCallback(async(force=false):Promise<T[]|null>=>{
  if(!owner||!enabled||!mounted.current||(reading.current&&!force))return null;
  reading.current=true;const request=++version.current;
  const current=()=>mounted.current&&request===version.current;
  setSnapshot(old=>({owner:cacheKey,items:old.owner===cacheKey?old.items:[],loading:true,ready:false,error:""}));
  try{
   const {data,error}=await createClient().rpc(rpc,{p_musician_id:owner});
   if(!current())return null;
   if(error||!Array.isArray(data)||!data.every(valid))throw new Error("reviews_unavailable");
   setSnapshot({owner:cacheKey,items:data,loading:false,ready:true,error:""});return data;
  }catch{
   if(current())setSnapshot(old=>({...old,owner:cacheKey,loading:false,ready:false,error:failure}));
   return null;
  }finally{if(current())reading.current=false;}
 },[owner,enabled,rpc,valid,failure,cacheKey]);
 useEffect(()=>{
  if(!owner||!enabled)setSnapshot({owner:null,items:[],loading:false,ready:false,error:""});
  void reload();
  return()=>{version.current++;reading.current=false;};
 },[reload,owner,enabled]);
 const matches=Boolean(owner&&enabled&&snapshot.owner===cacheKey);
 return {items:matches?snapshot.items:[],ready:matches&&snapshot.ready,
  loading:Boolean(owner&&enabled&&(!matches||snapshot.loading)),error:matches?snapshot.error:"",reload};
}

export function useMarketplaceReviews(owner:string|null,viewerId:string|null){
 const reviews=useReviewRead(owner,true,"stage_marketplace_reviews_for_musician",isReview,"Não foi possível carregar as avaliações. Tente novamente.");
 const eligibility=useReviewRead(owner,Boolean(viewerId),"stage_marketplace_my_reviewable",isReviewable,"Não foi possível verificar quais apresentações você pode avaliar. Tente novamente.",viewerId||"");
 return {reviews,eligibility};
}
