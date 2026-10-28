"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {useAccount} from "@/src/domains/account/account-context";
import {Button,Card,LoadingState} from "@/src/components/ui";
import FeeNegotiation from "@/components/fee-negotiation";
import type {PerformanceProfile} from "@/src/domains/artistic-profiles/types";
import "@/app/perfis/perfis.css";
type Event={id:string;title:string;venue:string|null;starts_at:string};
export default function Hire(){
 const {snapshot:{user}}=useAccount();
 const [events,setEvents]=useState<Event[]>([]),[eventId,setEventId]=useState(""),[query,setQuery]=useState("");
 const [items,setItems]=useState<PerformanceProfile[]>([]),[selected,setSelected]=useState<PerformanceProfile|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[availability,setAvailability]=useState("");
 const [fee,setFee]=useState(""),[message,setMessage]=useState(""),[invitation,setInvitation]=useState("");
 useEffect(()=>{
  if(!user)return;const request=new AbortController();
  void Promise.resolve(createClient().from("events").select("id,title,venue,starts_at").eq("producer_id",user.id).in("status",["draft","published"]).gte("starts_at",new Date().toISOString()).order("starts_at").limit(100).abortSignal(request.signal)).then(({data,error})=>{
   if(request.signal.aborted)return;setLoading(false);
   if(error){setNotice("Não foi possível carregar os eventos.");return;}
   setEvents(data??[]);const target=new URLSearchParams(window.location.search).get("evento");if(data?.some(event=>event.id===target))setEventId(target!);
  }).catch(()=>{if(!request.signal.aborted){setLoading(false);setNotice("Não foi possível carregar os eventos.");}});
  return()=>request.abort();
 },[user?.id]);
 useEffect(()=>{setSelected(null);setAvailability("");setInvitation("");},[eventId]);
 async function search(e:FormEvent){e.preventDefault();setBusy(true);setNotice("");setItems([]);setSelected(null);setAvailability("");try{
  const {data,error}=await createClient().rpc("stage_discover_performance_profiles",{p_query:query.trim()});
  if(error||data?.status!=="ok")throw new Error(data?.status==="not_released"?"A descoberta continua restrita à prévia autorizada do Marketplace.":"Não foi possível buscar perfis agora.");
  setItems(data.items??[]);if(!data.items?.length)setNotice("Nenhum artista ou grupo encontrado. Explore também os músicos do catálogo existente.");
 }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 async function check(item:PerformanceProfile){setSelected(item);setAvailability("");setBusy(true);setNotice("");try{const {data,error}=await createClient().rpc("stage_performance_availability",{p_event_id:eventId,p_profile_id:item.id});if(error||!["busy","ask","free"].includes(data))throw new Error();setAvailability(data);}catch{setNotice("Não foi possível consultar a disponibilidade. Tente novamente.");}finally{setBusy(false);}}
 async function invite(e:FormEvent){e.preventDefault();if(!selected||busy||availability!=="free")return;setBusy(true);setNotice("");try{
  const {data,error}=await createClient().rpc("stage_invite_performance_profile",{p_event_id:eventId,p_profile_id:selected.id,p_fee:Number(fee.replace(",",".")),p_message:message});
  const reasons:Record<string,string>={schedule_conflict:"A agenda mudou e esse horário está ocupado.",existing_invite:"Já há um convite para esta conta neste evento. Acompanhe-o em Convites.",availability_required:"O artista precisa confirmar a disponibilidade para esse dia.",not_released:"A contratação ainda depende de acesso à prévia autorizada."};
  if(error||data?.status!=="sent")throw new Error(reasons[data?.status]||"Não foi possível enviar o convite.");
  setInvitation(data.invitation_id);setNotice("Convite enviado. Negocie o cachê e aguarde o aceite. O show confirmado aparecerá na agenda e no Financeiro.");
 }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 return <main className="sf-profiles"><header><div><span className="eyebrow">DO EVENTO AO SHOW CONFIRMADO</span><h1>Contratar artista ou grupo</h1><p>Escolha o evento e a casa, confira a agenda e envie um convite.</p></div></header>
 <Card><h2>1. Evento e casa</h2>{loading?<LoadingState label="Carregando eventos…"/>:<label className="sf-profiles-form">Evento<select className="sf-ui-input" value={eventId} disabled={busy} onChange={e=>setEventId(e.target.value)}><option value="">Escolha um evento</option>{events.map(event=><option key={event.id} value={event.id}>{event.title} · {event.venue||"Local a definir"}</option>)}</select></label>}<Link href="/eventos?novo=1&continuar=contratar">Criar evento e escolher casa</Link></Card>
 {eventId&&<Card><h2>2. Buscar artista ou grupo</h2><form className="sf-profiles-form" onSubmit={search}><label>Nome ou cidade<input maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Grupo de pagode, artista ou cidade"/></label><Button type="submit" disabled={busy}>Buscar perfis</Button></form><Link href={"/marketplace/preview?evento="+eventId}>Explorar o catálogo de músicos existente</Link><div className="sf-profiles-grid">{items.map(item=><article key={item.id}><h3>{item.name}</h3><p>{item.musical_type} · {item.city}</p><p>{item.bio}</p>{item.kind==="group"&&<p>Integrantes: {item.members.join(", ")}</p>}<Button disabled={busy} onClick={()=>void check(item)}>Ver disponibilidade</Button></article>)}</div></Card>}
 {notice&&<p role="status">{notice}</p>}
 {selected&&<Card><h2>3. {selected.name}</h2><p>{availability==="free"?"Sem conflito registrado na agenda da conta responsável.":availability==="busy"?"Horário ocupado.":availability==="ask"?"Há bloqueios registrados neste dia. Combine outra data.":"Consultando disponibilidade…"}</p>{selected.kind==="group"&&<p>Contratação do grupo inteiro, representado pelo líder. Confirme com ele a presença de todos os integrantes.</p>}
 {availability==="free"&&!invitation&&<form className="sf-profiles-form" onSubmit={invite}><label>Cachê total proposto (R$)<input type="number" min="0.01" max="999999.99" step="0.01" required value={fee} onChange={e=>setFee(e.target.value)}/></label><label>Mensagem<textarea rows={3} maxLength={350} value={message} onChange={e=>setMessage(e.target.value)}/></label><Button type="submit" disabled={busy}>{busy?"Enviando…":"Enviar convite"}</Button></form>}
 {invitation&&<><FeeNegotiation invitationId={invitation} perspective="organizer"/><Link href="/convites">Acompanhar convite e negociação</Link></>}
 </Card>}
 </main>;
}
