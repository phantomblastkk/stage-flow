"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarDays, ImagePlus, LoaderCircle, MessageCircle, Plus,
  Save, Trash2, UploadCloud, Images, Music2, ShieldCheck, ExternalLink, Clock3, CheckCircle2, Copy
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import VenueMonthCalendar, {
  venueDayOfMonth, venueDayKey, venueMonthKey, venueMonthStart
} from "@/components/venue-month-calendar";
import "@/app/admin/casas/[id]/programacao/programacao.css";

type AdminShow = {
  id: string; title: string; description: string; starts_at: string; ends_at: string | null;
  status: "draft" | "published" | "cancelled"; flyer_path: string | null;
};
type GalleryPhoto = { id: string; media_path: string; caption: string; sort_order: number };
type SuggestionStatus = "pending" | "reviewing" | "resolved";
type Suggestion = {
  id: string; artist_name: string; visitor_name: string; message: string; created_at: string;
  review_status: SuggestionStatus; review_updated_at: string | null;
};
const suggestionLabels: Record<SuggestionStatus, string> = {
  pending: "Pendente", reviewing: "Em análise", resolved: "Resolvida"
};
type FormShow = {
  id: string | null; venue_id: string; title: string; description: string;
  start: string; end: string; status: "draft" | "published" | "cancelled";
};
type Tab = "agenda" | "galeria" | "sugestoes";

function inputTime(iso: string | null): string {
  if (!iso) return "";
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  });
  return formatter.format(new Date(iso)).replace(" ", "T");
}
function toIso(local: string): string | null {
  if (!local) return null;
  const parsed = new Date(local+":00-03:00");
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}
function blank(venueId: string, date: string): FormShow {
  return { id:null, venue_id:venueId, title:"", description:"", start:date+"T18:00", end:"", status:"draft" };
}
function picture(path: string) {
  return createClient().storage.from("stage-venue-media").getPublicUrl(path).data.publicUrl;
}
function friendly(status: string) {
  const map: Record<string,string> = {
    invalid:"Revise os campos antes de salvar.",
    invalid_media:"A imagem não foi encontrada ou não pertence a esta casa.",
    forbidden:"Sua conta não tem autorização para esta ação.",
    not_found:"O registro não foi encontrado.",
    limit_reached:"O limite de 36 fotos foi atingido.",
    duplicate:"Esta imagem já foi cadastrada.",
    invalid_venue:"O show pertence a outra casa."
  };
  return map[status] || "Não foi possível concluir: "+status;
}
async function uploadVenueFile(venueId: string, kind: "gallery" | "flyer", file: File) {
  const extension: Record<string,string> = {
    "image/jpeg":"jpg","image/png":"png","image/webp":"webp"
  };
  if (!extension[file.type] || file.size > 5*1024*1024 || file.size===0) {
    throw new Error("Envie JPG, PNG ou WebP de até 5 MB.");
  }
  const path = venueId+"/"+kind+"/"+crypto.randomUUID()+"."+extension[file.type];
  const { error } = await createClient().storage.from("stage-venue-media")
    .upload(path,file,{contentType:file.type,upsert:false});
  if (error) throw error;
  return path;
}

export default function VenueProgrammingWorkspace({mode}: {mode: "admin" | "partner"}) {
  const params = useParams<{id:string}>();
  const id = params.id;
  const router = useRouter();
  const [name,setName] = useState("");
  const [publicSlug,setPublicSlug] = useState<string|null>(null);
  const [ready,setReady] = useState(false);
  const [authorized,setAuthorized] = useState(false);
  const [tab,setTab] = useState<Tab>("agenda");
  const [shows,setShows] = useState<AdminShow[]>([]);
  const [photos,setPhotos] = useState<GalleryPhoto[]>([]);
  const [suggestions,setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionFilter,setSuggestionFilter] = useState<"all"|SuggestionStatus>("pending");
  const [suggestionBusy,setSuggestionBusy] = useState<string|null>(null);
  const [month,setMonth] = useState(venueMonthStart);
  const [selectedDay,setSelectedDay] = useState<number|null>(null);
  const [showForm,setShowForm] = useState<FormShow>(()=>blank(id,venueDayKey(new Date().toISOString())));
  const [pendingFlyer,setPendingFlyer] = useState<File|null>(null);
  const [caption,setCaption] = useState("");
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");

  const refresh = useCallback(async () => {
    const { data, error: resultError } = await createClient()
      .rpc("stage_venue_calendar_admin_list",{p_venue_id:id});
    if (resultError) throw resultError;
    const payload = data as {status:string;events?:AdminShow[];gallery?:GalleryPhoto[];suggestions?:Suggestion[]};
    if (payload.status!=="ok") throw new Error(friendly(payload.status));
    setShows(payload.events || []);
    setPhotos(payload.gallery || []);
    setSuggestions(payload.suggestions || []);
  },[id]);

  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        if (!/^[0-9a-f-]{36}$/i.test(id)) {setError("Identificador de casa inválido.");return;}
        const db=createClient();
        const {data:{user}}=await db.auth.getUser();
        if(!user){router.replace("/login");return;}
        const {data,error:authError}=await db.rpc(mode==="admin"
          ? "stage_venue_admin_list" : "stage_venue_partner_access");
        if(authError) throw authError;
        const payload=data as {status:string;items?:Array<{id:string;name:string;slug:string|null;is_official:boolean;active:boolean;approval_status?:"pending"|"approved"|"rejected"}>};
        if(payload.status!=="ok") throw new Error(friendly(payload.status));
        const house=payload.items?.find(x=>x.id===id);
        if(!house)throw new Error("Casa não encontrada neste catálogo.");
        if(!house.is_official||!house.active||
          (mode==="admin"&&house.approval_status!=="approved")){
          throw new Error("Esta casa ainda não possui perfil oficial ativo e aprovado. Volte à administração para revisar e aprovar o cadastro antes de criar shows ou flyers.");
        }
        if(!active)return;
        setName(house.name);
        setPublicSlug(mode==="partner" ? house.slug : (house.is_official&&house.active?house.slug:null));
        setAuthorized(true);
        await refresh();
      }catch(e){if(active)setError(e instanceof Error?e.message:"Erro ao carregar a página.");}
      finally{if(active)setReady(true);}
    }
    void load();
    return ()=>{active=false};
  },[id,router,refresh,mode]);

  const monthShows=useMemo(()=>shows.filter(x=>venueDayKey(x.starts_at).slice(0,7)===venueMonthKey(month)),
    [shows,month]);
  const visibleShows=useMemo(()=>monthShows.filter(x=>
    selectedDay===null || venueDayOfMonth(x.starts_at)===selectedDay
  ).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),[monthShows,selectedDay]);
  const nextShows=useMemo(()=>{
    const now=Date.now();
    const limit=now+14*24*60*60*1000;
    return shows.filter(x=>x.status!=="cancelled" &&
      new Date(x.starts_at).getTime()>=now &&
      new Date(x.starts_at).getTime()<limit
    ).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
  },[shows]);
  const upcomingWithoutFlyer=nextShows.filter(x=>!x.flyer_path).length;
  const suggestionCounts=useMemo(()=>({
    pending:suggestions.filter(x=>x.review_status==="pending").length,
    reviewing:suggestions.filter(x=>x.review_status==="reviewing").length,
    resolved:suggestions.filter(x=>x.review_status==="resolved").length,
  }),[suggestions]);
  const filteredSuggestions=useMemo(()=>
    suggestionFilter==="all"?suggestions:suggestions.filter(x=>x.review_status===suggestionFilter),
    [suggestions,suggestionFilter]
  );

  function editShow(item: AdminShow){
    if(busy)return;
    setPendingFlyer(null);
    setTab("agenda");
    setShowForm({id:item.id,venue_id:id,title:item.title,description:item.description,
      start:inputTime(item.starts_at),end:inputTime(item.ends_at),status:item.status});
    setMonth(new Date(Date.UTC(Number(venueDayKey(item.starts_at).slice(0,4)),
      Number(venueDayKey(item.starts_at).slice(5,7))-1,1)));
    setSelectedDay(Number(venueDayKey(item.starts_at).slice(-2)));
    setError("");setSuccess("");
  }
  function selectedDate() {
    const today=venueDayKey(new Date().toISOString());
    if(selectedDay!==null) return venueMonthKey(month)+"-"+String(selectedDay).padStart(2,"0");
    return venueMonthKey(month)===today.slice(0,7)?today:venueMonthKey(month)+"-01";
  }
  function newShow() {if(busy)return;setShowForm(blank(id,selectedDate()));setPendingFlyer(null);setError("");setSuccess("");}
  function chooseDay(day:number|null) {
    if(busy)return;
    setSelectedDay(day);
    if(day!==null) {
      const date=venueMonthKey(month)+"-"+String(day).padStart(2,"0");
      setShowForm(blank(id,date));
      setPendingFlyer(null);
      setError("");setSuccess("");
    }
  }
  function fill<K extends keyof FormShow>(key:K,value:FormShow[K]) {
    setShowForm(prev=>({...prev,[key]:value}));
  }
  async function attachFlyer(eventId:string,file:File){
    const path=await uploadVenueFile(id,"flyer",file);
    const {data,error:rpcError}=await createClient().rpc("stage_venue_calendar_admin_flyer",{
      p_id:eventId,p_path:path
    });
    if(rpcError)throw rpcError;
    if(data!=="ok")throw new Error(friendly(String(data)));
  }
  function chooseFlyerForNewShow(file?:File) {
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type) ||
      file.size===0 || file.size>5*1024*1024){
      setPendingFlyer(null);
      setError("Envie JPG, PNG ou WebP de até 5 MB.");
      return;
    }
    setPendingFlyer(file);
    setError("");
  }
  async function saveShow(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy)return;
    setBusy("save");setError("");setSuccess("");
    let savedId:string|null=null;
    // A new show with a flyer must not appear publicly before its image is attached.
    // A saved draft retry has the same safety requirement as the first creation.
    // A live show's existing flyer remains public while a replacement is uploaded.
    const wasPublished=shows.some(x=>x.id===showForm.id && x.status==="published");
    const publishAfterFlyer=showForm.status==="published" && !!pendingFlyer && !wasPublished;
    const hadPendingFlyer=!!pendingFlyer;
    let published=!publishAfterFlyer;
    try{
      const starts=toIso(showForm.start);
      if(!starts)throw new Error("Informe uma data e um horário válidos.");
      const details={id:showForm.id,venue_id:id,title:showForm.title,
        description:showForm.description,starts_at:starts,ends_at:toIso(showForm.end)};
      const {data,error:saveError}=await createClient().rpc("stage_venue_calendar_admin_save",{
        p_event:{...details,status:publishAfterFlyer?"draft":showForm.status}
      });
      if(saveError)throw saveError;
      const result=data as {status:string;id?:string};
      if(result.status!=="ok"||!result.id)throw new Error(friendly(result.status));
      savedId=result.id;
      setShowForm(prev=>({...prev,id:result.id||prev.id,
        status:publishAfterFlyer?"draft":prev.status}));
      if(pendingFlyer){
        await attachFlyer(result.id,pendingFlyer);
        setPendingFlyer(null);
      }
      if(publishAfterFlyer){
        const {data:publishedResult,error:publishError}=await createClient()
          .rpc("stage_venue_calendar_admin_save",{
            p_event:{...details,id:result.id,status:"published"}
          });
        if(publishError)throw publishError;
        if((publishedResult as {status:string}).status!=="ok")
          throw new Error(friendly((publishedResult as {status:string}).status));
        published=true;
        setShowForm(prev=>({...prev,status:"published"}));
      }
      await refresh();
      setSuccess("Show salvo no calendário da casa."+
        (hadPendingFlyer?" Flyer incluído com sucesso.":"")+
        (showForm.status==="published"?" Publicação disponível na agenda da casa.":" Mantido como rascunho ou cancelado."));
    }catch(e){
      if(savedId){
        try{await refresh();}catch{}
        if(!published){
          setError("O show foi salvo como rascunho, sem publicação pública. "+
            "O flyer ou a publicação não pôde ser concluído: "+
            (e instanceof Error?e.message:"tente novamente.")+
            " O arquivo selecionado continua disponível neste formulário. "+
            "Escolha Publicado novamente e clique em Salvar show para tentar outra vez.");
        }else{
          setError("O show foi salvo, mas houve um problema para concluir o flyer ou atualizar a lista: "+
            (e instanceof Error?e.message:"tente novamente.")+
            " Você pode tentar salvar outra vez, sem criar outro show.");
        }
      }else{
        setError(e instanceof Error?e.message:"Erro ao salvar o show.");
      }
    }
    finally{setBusy("");}
  }
  async function uploadFlyer(file?:File){
    if(!file||!showForm.id||busy)return;
    setBusy("flyer");setError("");setSuccess("");
    try{
      await attachFlyer(showForm.id,file);
      setPendingFlyer(null);
      await refresh();setSuccess("Flyer atualizado e associado à data do show.");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar o flyer.");}
    finally{setBusy("");}
  }
  async function removeFlyer(){
    if(!showForm.id)return;
    setBusy("flyer");setError("");setSuccess("");
    try{
      const {data,error:rpcError}=await createClient().rpc("stage_venue_calendar_admin_flyer",{
        p_id:showForm.id,p_path:null
      });
      if(rpcError)throw rpcError;
      if(data!=="ok")throw new Error(friendly(String(data)));
      await refresh();setSuccess("Flyer removido do catálogo.");
    }catch(e){setError(e instanceof Error?e.message:"Erro ao retirar flyer.");}
    finally{setBusy("");}
  }
  async function deleteShow(){
    if(!showForm.id||!window.confirm("Excluir este show do calendário da casa?"))return;
    setBusy("delete");setError("");setSuccess("");
    try{
      const {data,error:rpcError}=await createClient().rpc("stage_venue_calendar_admin_delete",{
        p_id:showForm.id
      });
      if(rpcError)throw rpcError;
      if(data!=="ok")throw new Error(friendly(String(data)));
      newShow();await refresh();setSuccess("Show excluído do calendário.");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível excluir.");}
    finally{setBusy("");}
  }
  async function addPhoto(file?:File){
    if(!file)return;
    setBusy("gallery");setError("");setSuccess("");
    try{
      if(photos.length>=36)throw new Error("A galeria comporta até 36 fotos.");
      const path=await uploadVenueFile(id,"gallery",file);
      const {data,error:rpcError}=await createClient().rpc("stage_venue_gallery_admin_add",{
        p_venue_id:id,p_path:path,p_caption:caption.trim()
      });
      if(rpcError)throw rpcError;
      if(data!=="ok")throw new Error(friendly(String(data)));
      setCaption("");await refresh();setSuccess("Foto adicionada à galeria.");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível adicionar a foto.");}
    finally{setBusy("");}
  }
  async function removePhoto(photo:GalleryPhoto){
    if(!window.confirm("Remover esta foto da galeria pública?"))return;
    setBusy(photo.id);setError("");setSuccess("");
    try{
      const {data,error:rpcError}=await createClient().rpc("stage_venue_gallery_admin_remove",{
        p_id:photo.id
      });
      if(rpcError)throw rpcError;
      if(data!=="ok")throw new Error(friendly(String(data)));
      await refresh();setSuccess("Foto retirada da galeria.");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível remover.");}
    finally{setBusy("");}
  }
  async function changeSuggestionStatus(item:Suggestion,status:SuggestionStatus) {
    if(suggestionBusy || item.review_status===status)return;
    setSuggestionBusy(item.id);setError("");setSuccess("");
    try{
      const {data,error:rpcError}=await createClient().rpc("stage_venue_suggestion_set_status",{
        p_id:item.id,p_status:status
      });
      if(rpcError)throw rpcError;
      if(data!=="ok")throw new Error(friendly(String(data)));
      await refresh();
      setSuccess("Sugestão de "+item.artist_name+" marcada como "+suggestionLabels[status].toLowerCase()+".");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível atualizar a sugestão.");}
    finally{setSuggestionBusy(null);}
  }
  const publishedCount=shows.filter(x=>x.status==="published").length;
  const publishedFlyers=shows.filter(x=>x.status==="published"&&!!x.flyer_path).length;
  const selectedPublishedShow=shows.find(x=>
    x.id===showForm.id&&x.status==="published")||null;
  async function copyPublishedShowLink(){
    if(!publicSlug||!selectedPublishedShow)return;
    const url=new URL("/casa/"+publicSlug,window.location.origin);
    url.searchParams.set("mes",venueDayKey(selectedPublishedShow.starts_at).slice(0,7));
    url.searchParams.set("show",selectedPublishedShow.id);
    try{
      if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url.toString());
      setError("");setSuccess("Link público da apresentação copiado.");
    }catch{
      setError("Não foi possível copiar. Abra a apresentação e use Compartilhar do navegador.");
    }
  }
  const currentFlyer=shows.find(x=>x.id===showForm.id)?.flyer_path;
  return <main className="venue-program-page"><div className="container">
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href={mode==="partner"?"/parceiros":"/admin/casas"}>
        <ArrowLeft size={16}/>{mode==="partner"?"Minhas casas":"Todas as casas"}
      </Link>
    </nav>
    <section className="venue-program-hero">
      <div className="eyebrow"><ShieldCheck size={14}/> {mode==="partner"?"PAINEL DA CASA PARCEIRA":"ADMINISTRAÇÃO DA CASA"}</div>
      <h1>{name||"Programação da casa"}</h1>
      <p className="lead">Calendário próprio, catálogo de flyers e fotos do estabelecimento. Nada é importado da agenda dos músicos.</p>
      {authorized&&publicSlug&&<Link className="btn btn-quiet venue-program-public-link"
        href={"/casa/"+publicSlug} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={15}/> Abrir página pública da casa
      </Link>}
    </section>
    {!ready?<div className="feature"><LoaderCircle size={17}/> Carregando programação...</div>:
      !authorized?<div className="feature"><p role="alert">{error}</p></div>:<>
        <div className="venue-program-tabs" role="group" aria-label="Seções da casa">
          <button type="button" className={tab==="agenda"?"active":""} onClick={()=>setTab("agenda")}>
            <CalendarDays size={17}/> Calendário <span>{shows.length}</span></button>
          <button type="button" className={tab==="galeria"?"active":""} onClick={()=>setTab("galeria")}>
            <Images size={17}/> Fotos <span>{photos.length}</span></button>
          <button type="button" className={tab==="sugestoes"?"active":""} onClick={()=>setTab("sugestoes")}>
            <MessageCircle size={17}/> Sugestões <span>{suggestionCounts.pending+suggestionCounts.reviewing}</span></button>
        </div>
        {error&&<div className="venue-program-alert" role="alert">{error}</div>}
        {success&&<div className="venue-program-success" role="status">{success}</div>}
        <section className="venue-program-launch-guide" aria-label="Preparar página pública da casa">
          <header>
            <div>
              <span className="eyebrow"><CheckCircle2 size={14}/> CASA APROVADA</span>
              <h2>Prepare a página da casa</h2>
              <p>O perfil oficial já está disponível. Complete os conteúdos e confira como a programação aparece para o público.</p>
            </div>
            {publicSlug&&<Link className="btn btn-quiet" href={"/casa/"+publicSlug}
              target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15}/> Visualizar página
            </Link>}
          </header>
          <div className="venue-program-launch-steps">
            <div>
              <span className="venue-program-step-number">1</span>
              <strong>Identidade visual</strong>
              <p>Logotipo, capa, descrição e contatos da casa.</p>
              {mode==="admin"?
                <Link href="/admin/casas">Editar cadastro da casa</Link>:
                <small>Solicite alterações ao administrador StageFlow.</small>}
            </div>
            <div>
              <span className="venue-program-step-number">2</span>
              <strong>{publishedCount} {publishedCount===1?"show publicado":"shows publicados"}</strong>
              <p>Rascunhos não aparecem no calendário público.</p>
              <button type="button" onClick={()=>{setTab("agenda");newShow();}}>
                <Plus size={13}/> Cadastrar show
              </button>
            </div>
            <div>
              <span className="venue-program-step-number">3</span>
              <strong>{publishedFlyers} {publishedFlyers===1?"flyer público":"flyers públicos"}</strong>
              <p>O flyer aparece com o show publicado e no catálogo do mês.</p>
              <button type="button" onClick={()=>setTab("agenda")}>
                <ImagePlus size={13}/> Gerenciar flyers
              </button>
            </div>
            <div>
              <span className="venue-program-step-number">4</span>
              <strong>{photos.length} {photos.length===1?"foto cadastrada":"fotos cadastradas"}</strong>
              <p>Mostre os ambientes da casa na galeria pública.</p>
              <button type="button" onClick={()=>setTab("galeria")}>
                <Images size={13}/> Adicionar fotos
              </button>
            </div>
          </div>
        </section>
        {tab==="agenda"&&<div className="venue-program-overview">
          <span><strong>{shows.filter(x=>x.status==="published").length}</strong> shows publicados</span>
          <span><strong>{shows.filter(x=>x.status==="draft").length}</strong> rascunhos</span>
          <span><strong>{shows.filter(x=>!!x.flyer_path).length}</strong> flyers catalogados</span>
        </div>}
        {tab==="agenda"&&<section className="venue-program-next" aria-label="Próximas apresentações">
          <div className="venue-program-heading">
            <div>
              <span className="venue-program-next-kicker">VISÃO RÁPIDA · PRÓXIMOS 14 DIAS</span>
              <h2>Próximos shows <small>({nextShows.length})</small></h2>
            </div>
            {upcomingWithoutFlyer>0&&<span className="venue-program-next-missing">
              <ImagePlus size={15}/> {upcomingWithoutFlyer} sem flyer
            </span>}
          </div>
          {nextShows.length ? <div className="venue-program-next-grid">
            {nextShows.slice(0,6).map(show=><button type="button"
              className="venue-program-next-card" key={show.id} disabled={!!busy} onClick={()=>editShow(show)}
              aria-label={"Editar "+show.title}>
              <span className="venue-program-next-date">
                {new Date(show.starts_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",timeZone:"America/Sao_Paulo"})}
              </span>
              <span className="venue-program-next-details">
                <strong>{show.title}</strong>
                <small>{new Date(show.starts_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"})} · {show.status==="published"?"Publicado":"Rascunho"}</small>
                {!show.flyer_path&&<small className="venue-program-next-pending">Flyer pendente</small>}
              </span>
              <ExternalLink size={15} aria-hidden="true"/>
            </button>)}
          </div> : <p className="fine">Nenhum show futuro nos próximos 14 dias. Clique no calendário para cadastrar.</p>}
        </section>}
        {tab==="agenda"&&<div className="venue-program-layout">
          <section className="venue-program-panel">
            <div className="venue-program-heading"><h2>Agenda da casa</h2>
              <button className="btn btn-quiet" type="button" disabled={!!busy} onClick={newShow}><Plus size={15}/> Novo show</button>
            </div>
            <VenueMonthCalendar month={month} events={shows} selectedDay={selectedDay}
              onDayChange={chooseDay} onMonthChange={next=>{if(busy)return;setMonth(next);setSelectedDay(null);setPendingFlyer(null);setShowForm(blank(id,venueMonthKey(next)+"-01"));}}/>
            <div className="venue-program-list">
              <h3>{selectedDay?"Shows do dia "+selectedDay:"Shows do mês"} <small>({visibleShows.length})</small></h3>
              {visibleShows.map(show=><button type="button" key={show.id}
                className={"venue-program-show"+(showForm.id===show.id?" selected":"")}
                onClick={()=>editShow(show)} disabled={!!busy}>
                {show.flyer_path?<img src={picture(show.flyer_path)} alt="Flyer do evento"/>:
                  <span className="venue-program-show-fallback"><Music2 size={22}/></span>}
                <span><strong>{show.title}</strong>
                  <small>{new Date(show.starts_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"})}</small>
                  <small className={"venue-program-badge "+show.status}>{show.status==="published"?"Publicado":show.status==="draft"?"Rascunho":"Cancelado"}</small></span>
              </button>)}
              {!visibleShows.length&&<p className="fine">Nenhum show neste período. Use “Novo show” para cadastrar.</p>}
            </div>
          </section>
          <section className="venue-program-panel">
            <div className="venue-program-heading"><h2>{showForm.id?"Editar apresentação":"Cadastrar apresentação"}</h2></div>
            {selectedPublishedShow&&publicSlug&&<div className="venue-program-published-share" role="group" aria-label="Compartilhar apresentação publicada">
              <span><CheckCircle2 size={15}/> Esta apresentação está pública.</span>
              <div>
                <Link className="btn btn-quiet" href={"/casa/"+publicSlug+
                  "?mes="+venueDayKey(selectedPublishedShow.starts_at).slice(0,7)+
                  "&show="+encodeURIComponent(selectedPublishedShow.id)}
                  target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15}/> Ver show publicado
                </Link>
                <button type="button" className="btn btn-quiet" onClick={()=>void copyPublishedShowLink()}>
                  <Copy size={15}/> Copiar link
                </button>
              </div>
            </div>}
            <form onSubmit={saveShow}>
              <div className="field"><label htmlFor="vp-title">Nome do show *</label>
                <input id="vp-title" required maxLength={120} value={showForm.title}
                  onChange={e=>fill("title",e.target.value)} placeholder="Ex.: Pagode no Deck 2"/></div>
              <div className="venue-program-time-fields">
                <div className="field">
                  <label>Dia escolhido no calendário</label>
                  <p className="fine" style={{margin:"8px 0 0",fontWeight:700}}>{showForm.start.slice(0,10).split("-").reverse().join("/")}</p>
                  <p className="fine">Para mudar a data, clique em outro dia no calendário.</p>
                </div>
                <div className="field"><label htmlFor="vp-start">Abertura da casa *</label>
                  <input id="vp-start" type="time" required value={showForm.start.slice(11,16)}
                    onChange={e=>fill("start",showForm.start.slice(0,10)+"T"+e.target.value)}/>
                  <span className="fine">Sugerido: 18h. Ajuste conforme o flyer. O horário é usado para ordenar os shows.</span>
                </div>
              </div>
              <div className="field"><label htmlFor="vp-description">Descrição da apresentação</label>
                <textarea id="vp-description" rows={2} maxLength={1200}
                  value={showForm.description} onChange={e=>fill("description",e.target.value)}
                  placeholder="Informações para quem vai ao show..."/></div>
              <div className="field"><label htmlFor="vp-status">Visibilidade</label>
                <select id="vp-status" value={showForm.status}
                  onChange={e=>fill("status",e.target.value as FormShow["status"])}>
                  <option value="draft">Rascunho — não aparece no site</option>
                  <option value="published">Publicado — aparece no calendário</option>
                  <option value="cancelled">Cancelado — oculto do site</option>
                </select></div>
              <div className="venue-program-new-flyer">
                <label htmlFor="vp-new-flyer"><ImagePlus size={17}/> {showForm.id?"Selecionar flyer ao salvar (opcional)":"Flyer (opcional)"}</label>
                <input id="vp-new-flyer" type="file" accept="image/jpeg,image/png,image/webp"
                  disabled={!!busy} onChange={e=>{chooseFlyerForNewShow(e.target.files?.[0]);e.target.value="";}}/>
                {pendingFlyer&&<div className="venue-program-pending-flyer">
                  <span>Selecionado: <strong>{pendingFlyer.name}</strong></span>
                  <button type="button" disabled={!!busy} onClick={()=>setPendingFlyer(null)}>Retirar</button>
                </div>}
                <p className="fine">Um show novo ou rascunho marcado como publicado só será liberado após vincular o flyer selecionado. Se o envio falhar, você pode repetir a operação aqui, sem criar outro show.</p>
              </div>}
              <div className="venue-program-buttons">
                <button className="btn btn-primary" type="submit" disabled={!!busy}>
                  <Save size={16}/>{busy==="save"?"Salvando...":"Salvar show"}</button>
                {showForm.id&&<button type="button" className="btn btn-quiet" onClick={()=>void deleteShow()}
                  disabled={!!busy}><Trash2 size={15}/> Excluir</button>}
              </div>
            </form>
            <div className="venue-program-flyer">
              <h3><ImagePlus size={18}/> Flyer desta apresentação</h3>
              <p className="fine">O flyer fica vinculado ao show e aparece no calendário e no catálogo do mês.</p>
              {currentFlyer&&<img src={picture(currentFlyer)} alt={"Flyer de "+showForm.title}/>}
              <div className="venue-program-buttons">
                <label className={"btn btn-quiet"+(!showForm.id||!!busy?" is-disabled":"")}>
                  <UploadCloud size={15}/> {busy==="flyer"?"Enviando...":"Adicionar / trocar flyer"}
                  <input hidden type="file" accept="image/jpeg,image/png,image/webp"
                    disabled={!showForm.id||!!busy} onChange={e=>{
                      const file=e.target.files?.[0];void uploadFlyer(file);
                      e.target.value="";
                    }}/>
                </label>
                {currentFlyer&&<button type="button" className="btn btn-quiet"
                  disabled={!!busy} onClick={()=>void removeFlyer()}>Retirar flyer</button>}
              </div>
              {!showForm.id&&<p className="fine">Você pode escolher o flyer no formulário acima e salvar tudo de uma vez.</p>}
            </div>
          </section>
        </div>}
        {tab==="galeria"&&<section className="venue-program-panel venue-program-gallery-panel">
          <div className="venue-program-heading"><h2>Galeria da casa</h2><span className="fine">{photos.length}/36 fotos</span></div>
          <p className="fine">Fotos do ambiente, palco, estrutura e momentos especiais. Independente das fotos dos músicos.</p>
          <div className="venue-program-upload">
            <div className="field"><label htmlFor="vp-caption">Legenda (opcional)</label>
              <input id="vp-caption" value={caption} maxLength={180} onChange={e=>setCaption(e.target.value)}
                placeholder="Ex.: Nosso espaço durante o samba de domingo"/></div>
            <label className={"btn btn-primary"+(!!busy||photos.length>=36?" is-disabled":"")}>
              <UploadCloud size={16}/>{busy==="gallery"?"Enviando...":"Adicionar foto"}
              <input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={!!busy||photos.length>=36}
                onChange={e=>{void addPhoto(e.target.files?.[0]);e.target.value="";}}/>
            </label>
          </div>
          {photos.length?<div className="venue-program-gallery-grid">{photos.map(photo=>
            <article key={photo.id} className="venue-program-gallery-item">
              <img src={picture(photo.media_path)} alt={photo.caption||"Foto da casa"}/>
              <div><span>{photo.caption||"Foto da casa"}</span><button type="button"
                title="Remover foto" aria-label="Remover foto"
                onClick={()=>void removePhoto(photo)} disabled={!!busy}><Trash2 size={16}/></button></div>
            </article>)}</div>:<p className="venue-program-empty">A galeria está vazia. Adicione a primeira foto da casa.</p>}
        </section>}
        {tab==="sugestoes"&&<section className="venue-program-panel venue-program-gallery-panel">
          <div className="venue-program-heading">
            <h2>Sugestões de atrações</h2><span className="fine">100 mensagens mais recentes</span>
          </div>
          <p className="fine">Acompanhe as sugestões enviadas pelo público sem excluir mensagens. A triagem fica visível apenas aos responsáveis autorizados desta casa.</p>
          <div className="venue-program-suggestion-stats" aria-label="Resumo da triagem">
            <span><Clock3 size={15}/><strong>{suggestionCounts.pending}</strong> pendentes</span>
            <span><MessageCircle size={15}/><strong>{suggestionCounts.reviewing}</strong> em análise</span>
            <span><CheckCircle2 size={15}/><strong>{suggestionCounts.resolved}</strong> resolvidas</span>
          </div>
          <div className="venue-program-suggestion-filters" role="group" aria-label="Filtrar sugestões">
            {([
              ["pending","Pendentes"],["reviewing","Em análise"],["resolved","Resolvidas"],["all","Todas"]
            ] as const).map(([value,label])=><button key={value} type="button"
              aria-pressed={suggestionFilter===value}
              onClick={()=>setSuggestionFilter(value)}>{label}</button>)}
          </div>
          <div className="venue-program-suggestions">
            {filteredSuggestions.map(s=><article key={s.id} className="venue-program-suggestion">
              <div className="venue-program-suggestion-top">
                <div><strong>{s.artist_name}</strong><small>{new Date(s.created_at).toLocaleString("pt-BR",{dateStyle:"medium",timeStyle:"short"})}</small></div>
                <span className={"venue-program-suggestion-status "+s.review_status}>
                  {suggestionLabels[s.review_status]||"Pendente"}
                </span>
              </div>
              {s.message&&<p>{s.message}</p>}
              {s.visitor_name&&<small>Sugerido por {s.visitor_name}</small>}
              {s.review_updated_at&&<small className="venue-program-suggestion-updated">
                Atualizado em {new Date(s.review_updated_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}
              </small>}
              <div className="venue-program-suggestion-actions">
                {s.review_status!=="reviewing"&&<button type="button" disabled={!!suggestionBusy}
                  onClick={()=>void changeSuggestionStatus(s,"reviewing")}>Em análise</button>}
                {s.review_status!=="resolved"&&<button type="button" disabled={!!suggestionBusy}
                  onClick={()=>void changeSuggestionStatus(s,"resolved")}>Marcar resolvida</button>}
                {s.review_status!=="pending"&&<button type="button" disabled={!!suggestionBusy}
                  onClick={()=>void changeSuggestionStatus(s,"pending")}>Voltar a pendente</button>}
              </div>
            </article>)}
            {!filteredSuggestions.length&&<p className="venue-program-empty">
              {suggestionFilter==="all"?"Nenhuma sugestão recebida por enquanto.":"Nenhuma sugestão nesta categoria."}
            </p>}
          </div>
        </section>}
      </>}
  </div></main>;
}
