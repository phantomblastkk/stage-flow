"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {useAccount} from "@/src/domains/account/account-context";
import {createClient} from "@/lib/supabase/client";
import {LoadingState} from "@/src/components/ui";
import {Share2,Search,CalendarDays,MessagesSquare,Users} from "lucide-react";
const ArtistEditor=dynamic(()=>import("@/components/artist-profile-editor"),{loading:()=> <LoadingState label="Abrindo seu perfil…"/>});
const ManagedProfiles=dynamic(()=>import("@/app/perfis/page"));
const InstrumentalistEditor=dynamic(()=>import("@/components/instrumentalist-profile-editor"),{loading:()=> <LoadingState label="Abrindo seu perfil…"/>});
export default function ArtisticProfile(){
 const {snapshot:{profile}}=useAccount();
 const [managed,setManaged]=useState<string|null>(null);
 const [tab,setTab]=useState("dados"),[notice,setNotice]=useState("");
 const [publicPath,setPublicPath]=useState<string|null>(null);
 useEffect(()=>{
  const sync=()=>{const params=new URLSearchParams(window.location.search);setTab(params.get("aba")||"dados");setManaged(params.get("perfil"));};
  sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);
 },[]);
 const instrumental=profile?.is_musician&&(!profile.is_singer||tab==="instrumentista");
 useEffect(()=>{
  const request=new AbortController();setPublicPath(null);
  if(profile?.is_singer){setPublicPath(profile.username?"/"+encodeURIComponent(profile.username):null);return;}
  void Promise.resolve(createClient().rpc("stage_my_musician_portfolio").abortSignal(request.signal)).then(({data,error})=>{
   if(!request.signal.aborted&&!error&&data?.slug)setPublicPath("/musico/"+encodeURIComponent(data.slug));
  }).catch(()=>{});
  return()=>request.abort();
 },[instrumental,profile?.username,profile?.is_singer]);
 function select(value:string){
  setTab(value);const url=new URL(window.location.href);url.searchParams.set("aba",value);window.history.pushState(null,"",url.pathname+url.search);
 }
 async function share(){
  if(!publicPath)return;
  const url=window.location.origin+publicPath;
  try{if(navigator.share)await navigator.share({title:profile?.display_name||"Perfil Artístico",url});else{await navigator.clipboard.writeText(url);setNotice("Link copiado.");}}catch(error){if((error as Error).name!=="AbortError")setNotice("Não foi possível compartilhar. Abra seu perfil público e copie o endereço.");}
 }
 return <div className="sf-profile-hub">
  <header className="sf-profile-hub-header"><div><span className="eyebrow">SEU TRABALHO EM UM SÓ LUGAR</span><h1>Perfil Artístico</h1><p>Uma página pública para cantar, tocar, divulgar shows e receber propostas.</p></div><Link href="/perfis" className="sf-ui-button sf-ui-button-secondary"><Users size={17}/>Perfis e grupos</Link></header>
  {!managed&&<nav className="sf-workspace-quick-actions" aria-label="Gerenciar Perfil Artístico">
   {profile?.is_singer&&profile.is_musician&&<><button type="button" className="sf-ui-button sf-ui-button-secondary" aria-pressed={!instrumental} onClick={()=>select("dados")}>Dados do perfil único</button><button type="button" className="sf-ui-button sf-ui-button-secondary" aria-pressed={Boolean(instrumental)} onClick={()=>select("instrumentista")}>Instrumentos e Marketplace</button></>}
   {profile?.is_musician&&<Link href="/meu-desempenho">Desempenho</Link>}
   <Link href="/eventos"><CalendarDays size={16}/>Agenda</Link>
   <Link href={profile?.is_singer?"/meu-perfil-artistico/solicitacoes":"/conversas"}><MessagesSquare size={16}/>Contratação</Link>
   <button type="button" className="sf-ui-button sf-ui-button-secondary" disabled={!publicPath} onClick={()=>void share()}><Share2 size={16}/>Compartilhar</button>
   {publicPath&&<Link href={publicPath} target="_blank" rel="noopener noreferrer">Ver perfil público</Link>}
  </nav>}
  {notice&&<p role="status">{notice}</p>}
  <details className="sf-profile-seo"><summary><Search size={16}/>Como seu perfil aparece nas buscas</summary><p>O nome, a biografia, a cidade e a foto salvos abaixo compõem o título, a descrição e a prévia de compartilhamento. A publicação controla a disponibilidade do perfil público.</p></details>
  {managed?<ManagedProfiles/>:profile?.is_singer||profile?.is_musician?(instrumental?<InstrumentalistEditor unifiedSinger={Boolean(profile?.is_singer)} username={profile?.username||null}/>:<ArtistEditor/>):<p>Gerencie seus perfis de produtor e suas casas em <Link href="/perfis">Perfis e grupos</Link>.</p>}
 </div>;
}
