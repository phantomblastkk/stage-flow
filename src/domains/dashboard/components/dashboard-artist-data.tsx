"use client";

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {createClient} from "@/lib/supabase/client";
import {useAccount} from "../../account/account-context";
import type {ArtistGuideData} from "../model/first-session-guide";

type Kind="singer"|"musician";
type ArtistData=ArtistGuideData&{instagram_url?:string|null;youtube_url?:string|null;spotify_url?:string|null};
type Snapshot={data:ArtistData|null;loading:boolean;error:string};
type Value={singer:Snapshot;musician:Snapshot;refresh:(kind:Kind)=>Promise<ArtistData|null>};
const Context=createContext<Value|null>(null);
const empty:Snapshot={data:null,loading:true,error:""};

/** Scoped to this dashboard and Auth identity; no module/global/private persistent cache. */
export function DashboardArtistDataProvider({children}:{children:ReactNode}){
 const {snapshot:account}=useAccount();
 const singer=Boolean(account.profile?.is_singer),musician=Boolean(account.profile?.is_musician);
 const owner=(account.user?.id||"")+":"+account.epoch+":"+singer+":"+musician;
 return <ArtistDataScope key={owner} singer={singer} musician={musician}>{children}</ArtistDataScope>;
}
function ArtistDataScope({children,singer,musician}:{children:ReactNode;singer:boolean;musician:boolean}){
 const [snapshots,setSnapshots]=useState({singer:empty,musician:empty});
 const mounted=useRef(true);
 const pending=useRef<Partial<Record<Kind,Promise<ArtistData|null>>>>({});
 const controllers=useRef<Partial<Record<Kind,AbortController>>>({});
 const refresh=useCallback((kind:Kind):Promise<ArtistData|null>=>{
  if(!(kind==="singer"?singer:musician))return Promise.resolve(null);
  if(pending.current[kind])return pending.current[kind]!;
  const controller=new AbortController();controllers.current[kind]=controller;
  setSnapshots(old=>({...old,[kind]:{...old[kind],loading:true,error:""}}));
  const request=(async()=>{
   try{
    const rpc=kind==="singer"?"stage_my_artist_page":"stage_my_musician_portfolio";
    const {data,error}=await createClient().rpc(rpc).abortSignal(controller.signal);
    if(controller.signal.aborted||!mounted.current)return null;
    if(error||!data||typeof data!=="object"||Array.isArray(data))throw new Error("profile_unavailable");
    const result=data as ArtistData;
    setSnapshots(old=>({...old,[kind]:{data:result,loading:false,error:""}}));return result;
   }catch{
    if(!controller.signal.aborted&&mounted.current)setSnapshots(old=>({...old,[kind]:{...old[kind],loading:false,error:"Não foi possível conferir seu perfil agora."}}));
    return null;
   }
  })().finally(()=>{
   if(pending.current[kind]===request){delete pending.current[kind];delete controllers.current[kind];}
  });
  pending.current[kind]=request;return request;
 },[singer,musician]);
 useEffect(()=>{
  mounted.current=true;
  if(singer)void refresh("singer");
  if(musician)void refresh("musician");
  return()=>{mounted.current=false;Object.values(controllers.current).forEach(controller=>controller.abort());pending.current={};controllers.current={};};
 },[refresh,singer,musician]);
 return <Context.Provider value={{...snapshots,refresh}}>{children}</Context.Provider>;
}
export function useDashboardArtistData(){
 const value=useContext(Context);
 if(!value)throw new Error("DashboardArtistDataProvider is required");
 return value;
}
