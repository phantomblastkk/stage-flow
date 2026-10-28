"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {Users,Plus,CalendarDays,ArrowRight} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {useAccount} from "@/src/domains/account/account-context";
import {musicalTypes,kindLabels,type PerformanceProfile} from "@/src/domains/artistic-profiles/types";
import {Button,Card,LoadingState} from "@/src/components/ui";
import "./perfis.css";
const blank={kind:"individual" as PerformanceProfile["kind"],musical_type:"Cantor",name:"",bio:"",city:"",members:"",is_public:false,producerConsent:false};
export default function Profiles(){
 const {snapshot:account,refresh:refreshAccount}=useAccount();
 const [items,setItems]=useState<PerformanceProfile[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [form,setForm]=useState(blank),[editing,setEditing]=useState<string|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 function updateForm<K extends keyof typeof blank>(key:K,value:(typeof blank)[K]){
  setForm(previous=>({...previous,[key]:value}));
 }
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!account.user)return;setLoading(true);setError("");
  let query=createClient().from("stage_performance_profiles").select("*").eq("account_id",account.user.id).order("created_at").limit(30);
  if(signal)query=query.abortSignal(signal);
  try{const {data,error:failure}=await query;if(signal?.aborted)return;if(failure)throw failure;setItems(data??[]);const target=new URLSearchParams(window.location.search).get("perfil");const chosen=(data as PerformanceProfile[]|null)?.find(item=>item.id===target);if(chosen)edit(chosen);else if(new URLSearchParams(window.location.search).get("tipo")==="venue"&&account.profile?.is_producer){setForm({...blank,kind:"venue"});setOpen(true);}}catch{if(!signal?.aborted)setError("Seus perfis adicionais ainda não estão disponíveis. Tente novamente após a atualização da plataforma. O perfil atual continua acessível.");}finally{if(!signal?.aborted)setLoading(false);}
 },[account.user?.id,account.profile?.is_producer]);
 useEffect(()=>{const request=new AbortController();void load(request.signal);return()=>request.abort();},[load]);
 function edit(item:PerformanceProfile){setEditing(item.id);setForm({...item,musical_type:item.musical_type||"Cantor",members:item.members.join("\n"),producerConsent:true});setOpen(true);setNotice("");}
 async function save(e:FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setNotice("");
  try{const {data,error:failure}=await createClient().rpc("stage_save_performance_profile",{p_id:editing,p_kind:form.kind,p_type:form.kind==="individual"||form.kind==="group"?form.musical_type:null,p_name:form.name.trim(),p_bio:form.bio,p_city:form.city,p_members:form.kind==="group"?form.members.split("\n").map(x=>x.trim()).filter(Boolean):[],p_public:(form.kind==="individual"||form.kind==="group")&&form.is_public});
   if(failure||data?.status!=="saved")throw new Error(data?.status==="producer_required"?"Habilite a função Produtor na sua conta para criar uma casa.":data?.status==="limit_reached"?"Você atingiu o limite de 30 perfis.":"Não foi possível salvar este perfil. Confira os campos e tente novamente.");
   setOpen(false);setEditing(null);setForm(blank);const url=new URL(window.location.href);url.searchParams.delete("perfil");url.searchParams.delete("tipo");window.history.replaceState(null,"",url.pathname+url.search);setNotice("Perfil salvo.");if(form.kind==="producer")await refreshAccount();await load();
  }catch(e){setNotice(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setBusy(false);}
 }
 return <main className="sf-profiles"><header><div><span className="eyebrow">UMA CONTA, VÁRIOS PALCOS</span><h1>Seus perfis</h1><p>{account.profile?.display_name} administra seus artistas, grupos e casas com o mesmo login.</p></div><Button disabled={Boolean(error)||loading} onClick={()=>{setEditing(null);setForm(blank);setOpen(true);}}><Plus size={17}/>Criar perfil</Button></header>
  <Card><h2>Meu Perfil Artístico</h2><p>Seu cadastro atual e seus endereços públicos continuam disponíveis.</p><Link href="/perfil-artistico">Editar apresentação, portfólio e publicação <ArrowRight size={16}/></Link></Card>
  {notice&&<p role="status">{notice}</p>}
  {error&&<div role="alert"><p>{error}</p><Button onClick={()=>void load()}>Tentar novamente</Button></div>}
  {loading?<LoadingState label="Carregando seus perfis…"/>:<div className="sf-profiles-grid">{items.map(item=><Card key={item.id}><span className="eyebrow">{kindLabels[item.kind]}</span><h2>{item.name}</h2><p>{item.musical_type||item.city}</p>{item.kind==="group"&&<><p><Users size={16}/> {item.members.join(", ")}</p><p>Líder: {account.profile?.display_name}</p><small>Um convite e um cachê para o grupo inteiro.</small></>}{item.kind==="venue"&&<Link href={"/eventos?novo=1&casa="+item.id}><CalendarDays size={16}/>Administrar programação</Link>}<p className="sf-profiles-state">{item.is_public?"Visível para descoberta autorizada":"Privado"}</p><Button variant="secondary" onClick={()=>edit(item)}>Editar perfil</Button>{(item.kind==="individual"||item.kind==="group")&&<Link href={"/perfil-artistico?perfil="+item.id}>Abrir Perfil Artístico <ArrowRight size={15}/></Link>}</Card>)}</div>}
  {open&&<Card><form onSubmit={save} className="sf-profiles-form" aria-label="Editar perfil adicional"><h2>{editing?"Editar perfil":"Novo perfil"}</h2><label htmlFor="managed-profile-kind">Tipo de perfil</label><select id="managed-profile-kind" value={form.kind} disabled={Boolean(editing)} onChange={e=>{const kind=e.currentTarget.value as PerformanceProfile["kind"];setForm(previous=>({...previous,kind,musical_type:kind==="group"?"Grupo de Pagode":"Cantor"}));}}>{Object.entries(kindLabels).filter(([key])=>account.profile?.is_producer||key!=="venue").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
   {(form.kind==="group"||form.kind==="individual")&&<><label htmlFor="managed-profile-formation">Formação</label><select id="managed-profile-formation" value={form.musical_type} onChange={e=>updateForm("musical_type",e.currentTarget.value)}>{musicalTypes.map(type=><option key={type}>{type}</option>)}</select></>}
   {form.kind==="producer"&&!account.profile?.is_producer&&<label className="sf-profiles-checkbox"><input type="checkbox" required checked={form.producerConsent} onChange={e=>updateForm("producerConsent",e.currentTarget.checked)}/>Quero usar esta conta também como produtor, para organizar meus eventos e criar minhas casas.</label>}
   <label>Nome<input value={form.name} minLength={2} maxLength={100} required onChange={e=>updateForm("name",e.currentTarget.value)}/></label><label>Cidade<input value={form.city} maxLength={120} onChange={e=>updateForm("city",e.currentTarget.value)}/></label><label>Apresentação<textarea value={form.bio} maxLength={2000} rows={4} onChange={e=>updateForm("bio",e.currentTarget.value)}/></label>
   {form.kind==="group"&&<label>Integrantes — um nome por linha<textarea required rows={5} value={form.members} onChange={e=>updateForm("members",e.currentTarget.value)}/><small>Até 30 integrantes. Você representa e contrata o grupo; os nomes não concedem acesso à conta nem bloqueiam agendas individuais.</small></label>}
   {(form.kind==="individual"||form.kind==="group")&&<label className="sf-profiles-checkbox"><input type="checkbox" checked={form.is_public} onChange={e=>updateForm("is_public",e.currentTarget.checked)}/>Permitir descoberta deste perfil na prévia autorizada</label>}
   <div className="sf-workspace-quick-actions"><Button type="submit" disabled={busy}>{busy?"Salvando…":"Salvar perfil"}</Button><Button variant="ghost" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</Button></div>
  </form></Card>}
  <p>Dados financeiros e convites continuam vinculados à conta responsável. Perfis não recebem acesso administrativo nem status de casa oficial.</p>
 </main>;
}
