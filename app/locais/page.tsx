"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Plus, LoaderCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type City = { id: number; name: string; state_code: string };
type Submission = {id:string;name:string;city:string|null;state:string|null;approval_status:"pending"|"approved"|"rejected";submitted_at:string};


export default function LocaisPage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [submissions,setSubmissions] = useState<Submission[]>([]);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [cityId, setCityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      if (active) setUserId(user.id);
      const [cityResponse, mine] = await Promise.all([
        supabase.from("cities").select("id,name,state_code").eq("active", true).order("name"),
        supabase.rpc("stage_venue_my_submissions")
      ]);
      const { data, error } = cityResponse;
      if (!active) return;
      if (error) {
        setIsError(true);
        setMessage("Não foi possível carregar as cidades. Confira se executou as migrações do catálogo no Supabase.");
      } else {
        setCities((data ?? []) as City[]);
        if (data?.length) setCityId(String(data[0].id));
      }
      if(!mine.error && Array.isArray(mine.data))setSubmissions(mine.data as Submission[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function addVenue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true); setMessage(""); setIsError(false);
    const supabase = createClient();
    const {data:result,error}=await supabase.rpc("stage_venue_submit",{
      p_name:name.trim(),p_city_id:Number(cityId),p_address:address.trim()||null
    });
    const outcome=(result as {status?:string}|null)?.status;
    if(error||outcome!=="pending"){
      setIsError(true);
      const labels:Record<string,string>={
        duplicate:"Já existe uma solicitação ou casa cadastrada com este nome nesta cidade.",
        invalid:"Confira nome, cidade e endereço informados.",
        limit_reached:"Limite de 20 sugestões em 24 horas atingido. Tente novamente amanhã.",
        login_required:"Entre na sua conta para sugerir uma casa."
      };
      setMessage(error?"Não foi possível enviar sua solicitação. Verifique sua conexão.":labels[outcome||""]||"Não foi possível enviar a sugestão.");
    }else{
      setMessage("Casa enviada para análise! Ela aparece para a administração, mas não terá página, URL, fotos ou flyers até ser aprovada.");
      setName("");setAddress("");
      const {data:mine,error:mineError}=await supabase.rpc("stage_venue_my_submissions");
      if(!mineError&&Array.isArray(mine))setSubmissions(mine as Submission[]);
    }
    setSaving(false);
  }

  return <main><div className="container">
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/eventos"><ArrowLeft size={15}/> Voltar à agenda</Link></nav>
    <section style={{padding:"42px 0 24px"}}>
      <div className="eyebrow"><span className="dot"/> SUGESTÃO DE CASAS · MODERAÇÃO</div>
      <h1 style={{fontSize:"clamp(34px,5vw,46px)"}}>Sugerir <span className="accent">casa de show.</span></h1>
      <p className="lead">Indique uma casa de shows, bar ou espaço de eventos. A solicitação vai para a administração e só entra no catálogo e recebe perfil oficial depois de aprovada.</p>
    </section>
    <section className="feature" style={{maxWidth:720}}>
      {loading ? <p style={{color:"var(--muted)"}}><LoaderCircle size={16} style={{display:"inline",verticalAlign:"middle"}}/> Carregando cidades...</p> : <form onSubmit={addVenue}>
        <div className="field"><label htmlFor="venue-name">Nome do local *</label><input id="venue-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: nome da casa de shows" required maxLength={120}/></div>
        <div className="field"><label htmlFor="venue-city">Cidade *</label><select id="venue-city" value={cityId} onChange={e=>setCityId(e.target.value)} required style={{width:"100%",padding:13,border:"1px solid var(--line)",background:"var(--panel)",borderRadius:11,color:"var(--text)"}}><option value="">Selecione uma cidade</option>{cities.map(city=><option key={city.id} value={city.id}>{city.name} - {city.state_code}</option>)}</select>{cities.length===0&&<p style={{fontSize:12,color:"var(--muted)"}}>Nenhuma cidade cadastrada. É necessário preencher o catálogo de cidades primeiro.</p>}</div>
        <div className="field"><label htmlFor="venue-address">Endereço (opcional)</label><input id="venue-address" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Rua, número e bairro" maxLength={240}/></div>
        {message&&<div className="coming" role="status" style={isError?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{!isError&&<CheckCircle2 size={15} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>}{message}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving||!userId||!cities.length}><Plus size={16}/>{saving?"Enviando...":"Enviar para aprovação"}</button>
      </form>}
    </section>
    <section className="feature" style={{maxWidth:720,marginTop:20}}>
      <h2 style={{fontSize:20,marginBottom:12}}>Minhas solicitações</h2>
      {submissions.length===0?<p className="fine">Você ainda não enviou nenhuma sugestão.</p>:
       <div style={{display:"grid",gap:10}}>
        {submissions.map(item=><div key={item.id} style={{display:"flex",gap:12,justifyContent:"space-between",flexWrap:"wrap",padding:"12px",border:"1px solid var(--line)",borderRadius:12}}>
         <div><strong>{item.name}</strong><p className="fine" style={{margin:"6px 0 0"}}>{[item.city,item.state].filter(Boolean).join(" · ")}</p></div>
         <span style={{fontSize:12,fontWeight:800,color:"var(--text)"}}>{item.approval_status==="pending"?"Aguardando análise":item.approval_status==="approved"?"Aprovada para o catálogo":"Não aprovada"}</span>
        </div>)}
       </div>}
      <p className="fine" style={{marginTop:14}}>Aprovação no catálogo não cria automaticamente página pública. URL, fotos e flyers são configurados pela administração após a análise.</p>
    </section>
    <div className="coming" style={{maxWidth:720,marginTop:20}}>Não encontrou uma cidade? Por enquanto, o catálogo inicial contém algumas cidades brasileiras. O cadastro de cidades adicionais será uma próxima melhoria. Se quiser só registrar um show, você ainda pode informar o nome do local diretamente na agenda.</div>
  </div></main>;
}
