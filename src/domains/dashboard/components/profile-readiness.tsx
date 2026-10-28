"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useAccount} from "../../account/account-context";
import {createClient} from "@/lib/supabase/client";
export default function ProfileReadiness(){
 const {snapshot:{profile}}=useAccount();
 const [score,setScore]=useState<number|null>(null);
 useEffect(()=>{
  if(!profile?.is_singer&&!profile?.is_musician)return;
  const request=new AbortController();setScore(null);
  const rpc=profile.is_singer?"stage_my_artist_page":"stage_my_musician_portfolio";
  void Promise.resolve(createClient().rpc(rpc).abortSignal(request.signal)).then(({data,error})=>{
   if(request.signal.aborted||error||!data)return;
   const fields=[Boolean(data.name?.trim()),Boolean(data.bio?.trim()),Boolean(data.city?.trim()),Boolean(data.avatar_path||data.avatar_url),Boolean(data.instagram_url||data.youtube_url||data.spotify_url),Boolean(data.is_public||data.is_published)];
   setScore(Math.round(fields.filter(Boolean).length/fields.length*100));
  }).catch(()=>{});
  return()=>request.abort();
 },[profile?.id,profile?.is_singer,profile?.is_musician]);
 if(!profile?.is_singer&&!profile?.is_musician)return <Link href="/perfis">Gerenciar perfis</Link>;
 return <Link href="/perfil-artistico" title="Nome, biografia, cidade, foto, rede social e publicação"><strong>{score===null?"—":score+"%"}</strong> do perfil completo <span>Revisar perfil →</span></Link>;
}
