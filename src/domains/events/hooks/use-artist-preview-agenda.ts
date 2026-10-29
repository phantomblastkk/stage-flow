"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import type {ArtistPreviewShow} from "../types";

export const PREVIEW_SHOW_LIMIT=40;
type Flyer=Pick<ArtistPreviewShow,"flyer_path"|"flyer_settings">;
type Snapshot={ownerId:string|null;shows:ArtistPreviewShow[];available:boolean};

export function useArtistPreviewAgenda(ownerId:string|null){
  const [snapshot,setSnapshot]=useState<Snapshot>({ownerId:null,shows:[],available:false});
  const [flyers,setFlyers]=useState<Record<string,Flyer>>({});
  const [loading,setLoading]=useState(false),[flyerLoading,setFlyerLoading]=useState(false);
  const [error,setError]=useState(""),[flyerError,setFlyerError]=useState("");
  const mounted=useRef(false),owner=useRef(ownerId);
  const agendaVersion=useRef(0),flyerVersion=useRef(0);
  const reading=useRef(false),readingFlyers=useRef(false);
  const rowsRef=useRef<ArtistPreviewShow[]>([]);

  const readFlyers=useCallback(async(rows:ArtistPreviewShow[])=>{
    if(!ownerId||!mounted.current||readingFlyers.current)return false;
    const version=++flyerVersion.current;
    const current=()=>mounted.current&&owner.current===ownerId&&version===flyerVersion.current;
    if(!rows.length){setFlyers({});setFlyerError("");setFlyerLoading(false);return true;}
    readingFlyers.current=true;setFlyerLoading(true);setFlyerError("");
    try{
      const {data,error:requestError}=await createClient().from("events")
        .select("id,flyer_path,flyer_settings")
        .eq("producer_id",ownerId).eq("show_publicly",true).eq("status","published")
        .in("id",rows.map(row=>row.id)).limit(PREVIEW_SHOW_LIMIT);
      if(!current())return false;
      if(requestError||!Array.isArray(data)||!data.every(row=>row&&typeof row.id==="string"&&
        (row.flyer_path===null||typeof row.flyer_path==="string")))throw new Error("flyer_read_failed");
      const ids=new Set(rows.map(row=>row.id));
      const next:Record<string,Flyer>={};
      for(const row of data)if(ids.has(row.id))next[row.id]={flyer_path:row.flyer_path,flyer_settings:row.flyer_settings};
      setFlyers(next);return true;
    }catch{
      if(current())setFlyerError("Não foi possível atualizar os cartazes. Os shows continuam disponíveis. Tente novamente.");
      return false;
    }finally{
      if(current()){readingFlyers.current=false;setFlyerLoading(false);}
    }
  },[ownerId]);

  const reloadAgenda=useCallback(async()=>{
    if(!ownerId||!mounted.current||reading.current)return false;
    const version=++agendaVersion.current;
    const current=()=>mounted.current&&owner.current===ownerId&&version===agendaVersion.current;
    reading.current=true;setLoading(true);setError("");
    setSnapshot(previous=>({...previous,available:false}));
    // A newer agenda invalidates any metadata response for the previous set of IDs.
    flyerVersion.current++;readingFlyers.current=false;setFlyerLoading(false);setFlyerError("");
    try{
      const {data,error:requestError}=await createClient().from("events")
        .select("id,title,venue,city,starts_at")
        .eq("producer_id",ownerId).eq("show_publicly",true).eq("status","published")
        .gte("starts_at",new Date().toISOString())
        .order("starts_at",{ascending:true}).order("id",{ascending:true}).limit(PREVIEW_SHOW_LIMIT);
      if(!current())return false;
      if(requestError||!Array.isArray(data)||!data.every(row=>row&&typeof row.id==="string"&&
        typeof row.title==="string"&&typeof row.starts_at==="string"&&Number.isFinite(Date.parse(row.starts_at))))
        throw new Error("agenda_read_failed");
      const rows=data.slice(0,PREVIEW_SHOW_LIMIT) as ArtistPreviewShow[];
      rowsRef.current=rows;setSnapshot({ownerId,shows:rows,available:true});
      void readFlyers(rows);
      return true;
    }catch{
      if(current())setError("Não foi possível atualizar a agenda da prévia. Os últimos shows carregados foram mantidos. Tente novamente.");
      return false;
    }finally{
      if(current()){reading.current=false;setLoading(false);}
    }
  },[ownerId,readFlyers]);

  useEffect(()=>{
    mounted.current=true;owner.current=ownerId;rowsRef.current=[];
    setSnapshot({ownerId,shows:[],available:false});setFlyers({});setError("");setFlyerError("");
    if(ownerId)void reloadAgenda();
    return()=>{mounted.current=false;agendaVersion.current++;flyerVersion.current++;reading.current=false;readingFlyers.current=false;};
  },[ownerId,reloadAgenda]);

  const matching=snapshot.ownerId===ownerId;
  const shows=useMemo(()=>matching?snapshot.shows.map(row=>({...row,...flyers[row.id]})):[],[matching,snapshot.shows,flyers]);
  return {shows,available:matching&&snapshot.available,loading:!matching||loading,
    flyerLoading:matching&&flyerLoading,error:matching?error:"",flyerError:matching?flyerError:"",
    reloadAgenda,reloadFlyers:()=>reading.current?Promise.resolve(false):readFlyers(rowsRef.current)};
}
