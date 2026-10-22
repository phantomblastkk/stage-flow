"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, LoaderCircle, MapPin, ShieldCheck, Music2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./parceiros.css";

type Venue = {id:string;name:string;slug:string|null;logo_path:string|null;city:string|null;state:string|null;description:string};
export default function PartnerVenuesPage() {
  const router=useRouter();
  const [venues,setVenues]=useState<Venue[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const supabase=createClient();
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(!user||authError){router.replace("/login");return;}
        const {data,error:rpcError}=await supabase.rpc("stage_venue_partner_access");
        if(!active)return;
        if(rpcError)throw rpcError;
        const value=data as {status:string;items?:Venue[]};
        if(value.status!=="ok")throw new Error("Não foi possível conferir suas permissões.");
        setVenues(value.items||[]);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Não foi possível carregar suas casas.");}
      finally{if(active)setLoading(false);}
    }
    void load();
    return()=>{active=false};
  },[router]);
  return <main className="partner-houses"><div className="container">
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={16}/> Meu painel</Link>
    </nav>
    <section className="partner-houses-header">
      <div className="eyebrow"><ShieldCheck size={15}/> PORTAL DAS CASAS PARCEIRAS</div>
      <h1>Minhas <span className="accent">casas.</span></h1>
      <p className="lead">Gerencie a programação, os flyers, a galeria e as sugestões das casas que confiaram a você o acesso.</p>
    </section>
    {loading?<div className="feature"><LoaderCircle size={17}/> Conferindo permissões...</div>:
      error?<div className="feature" role="alert">{error}</div>:
      venues.length===0?<div className="feature partner-houses-empty">
        <Building2 size={28}/><h2>Nenhuma casa vinculada à sua conta.</h2>
        <p>O administrador do Stage Flow precisa autorizar seu e-mail no cadastro de uma casa parceira. Sua conta continua funcionando normalmente para as outras atividades.</p>
      </div>:
      <div className="partner-houses-grid">
        {venues.map(v=><article className="partner-house-card" key={v.id}>
          <div className="partner-house-image">
            {v.logo_path?<img src={createClient().storage.from("stage-venue-media").getPublicUrl(v.logo_path).data.publicUrl} alt={"Logotipo de "+v.name}/>:
              <Music2 size={30}/>}
          </div>
          <div className="partner-house-info">
            <span className="partner-house-label"><ShieldCheck size={13}/> Acesso autorizado</span>
            <h2>{v.name}</h2>
            <p><MapPin size={15}/>{[v.city,v.state].filter(Boolean).join(" · ")||"Casa parceira"}</p>
            <Link href={"/parceiros/"+v.id+"/programacao"} className="btn btn-primary">
              <CalendarDays size={17}/> Gerenciar programação <ArrowRight size={16}/>
            </Link>
          </div>
        </article>)}
      </div>}
    <p className="fine partner-houses-footnote">O acesso é exclusivo às casas autorizadas. Cadastro de parceiros, outros estabelecimentos e permissões gerais permanecem com a administração Stage Flow.</p>
  </div></main>;
}
