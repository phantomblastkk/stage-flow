"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Plus, LoaderCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type City = { id: number; name: string; state_code: string };

export default function LocaisPage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
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
      const { data, error } = await supabase.from("cities").select("id,name,state_code").eq("active", true).order("name");
      if (!active) return;
      if (error) {
        setIsError(true);
        setMessage("Não foi possível carregar as cidades. Confira se executou as migrações do catálogo no Supabase.");
      } else {
        setCities((data ?? []) as City[]);
        if (data?.length) setCityId(String(data[0].id));
      }
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
    const { data: existing, error: lookupError } = await supabase
      .from("venues")
      .select("id,name")
      .eq("active", true)
      .eq("city_id", Number(cityId))
      .ilike("name", name.trim())
      .limit(1);
    if (lookupError) {
      setIsError(true);
      setMessage("Não foi possível verificar se esse local já existe. Tente novamente.");
      setSaving(false);
      return;
    }
    if (existing?.length) {
      setIsError(true);
      setMessage("Esse local já está cadastrado nessa cidade. Pesquise o nome na agenda para usá-lo, sem criar uma cópia.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("venues").insert({
      name: name.trim(),
      address: address.trim() || null,
      city_id: cityId ? Number(cityId) : null,
      submitted_by: userId,
    });
    if (error) {
      setIsError(true);
      setMessage(error.code === "23505"
        ? "Esse local já foi cadastrado nessa cidade. Pesquise o nome na agenda para usá-lo."
        : error.message.includes("row-level security")
          ? "O banco ainda não liberou o cadastro de locais. Execute o arquivo venues_catalog_contributions.sql no Supabase."
          : "Não foi possível cadastrar o local: " + error.message);
    } else {
      setMessage("Local adicionado ao catálogo! Ele poderá aparecer nas sugestões da agenda.");
      setName(""); setAddress("");
    }
    setSaving(false);
  }

  return <main><div className="container">
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/eventos"><ArrowLeft size={15}/> Voltar à agenda</Link></nav>
    <section style={{padding:"42px 0 24px"}}>
      <div className="eyebrow"><span className="dot"/> CATÁLOGO COLABORATIVO</div>
      <h1 style={{fontSize:"clamp(34px,5vw,46px)"}}>Adicionar <span className="accent">local.</span></h1>
      <p className="lead">Cadastre uma casa de shows, bar, teatro ou espaço de eventos para facilitar o preenchimento de agendas no Stage Flow.</p>
    </section>
    <section className="feature" style={{maxWidth:720}}>
      {loading ? <p style={{color:"var(--muted)"}}><LoaderCircle size={16} style={{display:"inline",verticalAlign:"middle"}}/> Carregando cidades...</p> : <form onSubmit={addVenue}>
        <div className="field"><label htmlFor="venue-name">Nome do local *</label><input id="venue-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: nome da casa de shows" required maxLength={120}/></div>
        <div className="field"><label htmlFor="venue-city">Cidade *</label><select id="venue-city" value={cityId} onChange={e=>setCityId(e.target.value)} required style={{width:"100%",padding:13,border:"1px solid var(--line)",background:"var(--panel)",borderRadius:11,color:"var(--text)"}}><option value="">Selecione uma cidade</option>{cities.map(city=><option key={city.id} value={city.id}>{city.name} - {city.state_code}</option>)}</select>{cities.length===0&&<p style={{fontSize:12,color:"var(--muted)"}}>Nenhuma cidade cadastrada. É necessário preencher o catálogo de cidades primeiro.</p>}</div>
        <div className="field"><label htmlFor="venue-address">Endereço (opcional)</label><input id="venue-address" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Rua, número e bairro" maxLength={240}/></div>
        {message&&<div className="coming" role="status" style={isError?{borderColor:"#754343",background:"#281919",color:"#ffb5b5"}:{}}>{!isError&&<CheckCircle2 size={15} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>}{message}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving||!userId||!cities.length}><Plus size={16}/>{saving?"Salvando...":"Adicionar ao catálogo"}</button>
      </form>}
    </section>
    <div className="coming" style={{maxWidth:720,marginTop:20}}>Não encontrou uma cidade? Por enquanto, o catálogo inicial contém algumas cidades brasileiras. O cadastro de cidades adicionais será uma próxima melhoria. Se quiser só registrar um show, você ainda pode informar o nome do local diretamente na agenda.</div>
  </div></main>;
}
