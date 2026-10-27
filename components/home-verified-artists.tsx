"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,BadgeCheck,Mic2,Music2} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import StageVerifiedBadge from "@/components/stage-verified-badge";

type VerifiedArtist={name:string;username:string;headline:string|null;avatar_path:string|null};
function ArtistPortrait({artist}:{artist:VerifiedArtist}){
 const [broken,setBroken]=useState(false);
 const path=artist.avatar_path;
 const safe=path&&/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path);
 const url=safe&&!broken?createClient().storage.from("stage-artist-public").getPublicUrl(path).data.publicUrl:null;
 return <span className="home-verified-portrait">
  {url?<img src={url} alt={"Foto de "+artist.name} loading="lazy" onError={()=>setBroken(true)}/>:
   <Mic2 size={33} aria-hidden="true"/>}
 </span>;
}

export default function HomeVerifiedArtists(){
 const [artists,setArtists]=useState<VerifiedArtist[]>([]);
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   const {data,error}=await createClient().rpc("stage_public_verified_singers",{p_limit:8});
   if(!active)return;
   if(!error&&Array.isArray(data)){
    setArtists((data as VerifiedArtist[]).filter(x=>
     Boolean(x&&typeof x.name==="string"&&typeof x.username==="string"&&
      /^[a-z0-9-]{3,30}$/.test(x.username))
    ));
   }
   setLoaded(true);
  })();
  return()=>{active=false;};
 },[]);
 if(!loaded||!artists.length)return null;
 return <section className="home-verified-artists" aria-labelledby="home-verified-title">
  <div className="home-partners-heading">
   <div>
    <span className="home-kicker"><BadgeCheck size={15}/> VOZES QUE FAZEM PARTE DO PALCO</span>
    <h2 id="home-verified-title">Cantores <span>verificados.</span></h2>
    <p>Conheça artistas com selo oficial de verificação do StageFlow e explore suas páginas públicas.</p>
   </div>
  </div>
  <div className="home-verified-grid">
   {artists.map(artist=><Link className="home-verified-card"
    key={artist.username} href={"/"+encodeURIComponent(artist.username)}
    aria-label={"Conhecer o perfil verificado de "+artist.name}>
    <ArtistPortrait artist={artist}/>
    <span className="home-verified-info">
     <strong>{artist.name}</strong>
     <small>@{artist.username}</small>
     {artist.headline&&<span className="home-verified-tagline">{artist.headline}</span>}
     <StageVerifiedBadge compact/>
    </span>
    <ArrowUpRight size={18} className="home-verified-arrow" aria-hidden="true"/>
   </Link>)}
  </div>
  <div className="home-verified-footnote"><Music2 size={15}/>
   Apenas perfis de cantor publicados e efetivamente verificados aparecem nesta seleção.
  </div>
 </section>;
}
