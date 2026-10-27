"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, Copy, Instagram, LoaderCircle,
  MapPin, Mic2, Music2, PlayCircle, Share2, Youtube, LockKeyhole, Crown, MessageCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StageVerifiedBadge from "@/components/stage-verified-badge";
import {useStageVerified} from "@/lib/use-stage-verified";
import {distinctPublicBiography} from "@/lib/profile-presentation";
import {publicInstagramProfile} from "@/lib/artist-social";
import {whatsappBookingUrl,type PublicBookingContact} from "@/lib/booking-contact";
import ProShowCards from "@/app/meu-perfil-artistico/site-profissional/pro-show-cards";
import ArtistBookingForm from "@/components/artist-booking-form";
import {
  PremiumGalleryShowcase, type PremiumMediaItem
} from "@/app/meu-perfil-artistico/site-profissional/premium-media-gallery";
import "@/app/meu-perfil-artistico/site-profissional/premium-preview.css";
import "@/app/pro/[username]/pro-public.css";
import "./public-singer-site.css";

type SectionId="about"|"photos"|"videos"|"agenda"|"contact";
type Theme="midnight"|"concert"|"ivory";
type Accent="violet"|"lime"|"cyan"|"gold"|"coral";

type ProArtist={
  name:string;username:string;bio:string;city:string;headline:string;
  instagram_url:string|null;youtube_url:string|null;spotify_url:string|null;
  avatar_path:string|null;cover_path:string|null;bookings_enabled:boolean;
};
type ProDesign={
  theme:Theme;accent:Accent;
  section_order:SectionId[];visible_sections:SectionId[];
};
type PublicShow={
  id:string;title:string;venue:string|null;city:string|null;starts_at:string;
  flyer_path?:string|null;flyer_settings?:unknown;
};
type FreeArtist=Omit<ProArtist,"bookings_enabled"> & {accent?:Accent|null};
type FreePublicShow={title:string;venue:string|null;city:string|null;starts_at:string};
type PublicPro={
  artist:ProArtist;
  design:ProDesign;
  media:PremiumMediaItem[];
  events:PublicShow[];
};

const sectionLabels:Record<SectionId,string>={
  about:"Sobre",photos:"Fotos",videos:"Vídeos",agenda:"Agenda",contact:"Contato"
};
const sectionIds:SectionId[]=["about","photos","videos","agenda","contact"];
const sectionAnchors:Record<SectionId,string>={
  about:"#premium-sobre",photos:"#premium-fotos",
  videos:"#premium-videos",agenda:"#premium-agenda",contact:"#premium-contato"
};
function upgradeSections(raw:unknown):SectionId[]{
  if(!Array.isArray(raw))return [...sectionIds];
  return [...new Set(raw.flatMap((id:string)=>
    id==="portfolio"?["photos","videos"]:[id]
  ).filter((id:string)=>sectionIds.includes(id as SectionId)))] as SectionId[];
}
const palette:Accent[]=["violet","lime","cyan","gold","coral"];
const themes:Theme[]=["midnight","concert","ivory"];
const dayCode=(d:Date)=>[
  d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),
  String(d.getDate()).padStart(2,"0")
].join("-");
const showCode=(s:string)=>dayCode(new Date(s));
const monthName=(d:Date)=>new Intl.DateTimeFormat("pt-BR",{
  month:"long",year:"numeric"
}).format(d);
function monthCells(d:Date): (Date|null)[]{
  const year=d.getFullYear(),month=d.getMonth();
  const first=new Date(year,month,1).getDay();
  const days=new Date(year,month+1,0).getDate();
  return [...Array.from({length:first},()=>null),
    ...Array.from({length:days},(_,i)=>new Date(year,month,i+1))];
}
function safeDesign(source:ProDesign):ProDesign{
  // Compatibilidade de sites Pro publicados antes da divisão Fotos/Vídeos.
  const convertedOrder=upgradeSections(source?.section_order);
  const convertedVisible=upgradeSections(source?.visible_sections);
  const order=convertedOrder.length===sectionIds.length &&
    sectionIds.every(id=>convertedOrder.includes(id))
    ? convertedOrder:sectionIds;
  const visible=convertedVisible.length>0
    ?convertedVisible:sectionIds;
  return{
    theme:themes.includes(source?.theme)?source.theme:"midnight",
    accent:palette.includes(source?.accent)?source.accent:"violet",
    section_order:order,visible_sections:visible.length?visible:sectionIds
  };
}
function anchor(id:SectionId){return sectionAnchors[id];}


function LockedProFeature({type,eligible=false}:{type:"photos"|"videos";eligible?:boolean}){
  const isPhotos=type==="photos";
  return <div className="singer-premium-locked" aria-label={(isPhotos?"Galeria de fotos":"Galeria de vídeos")+" disponível no plano Pro"}>
    <div className="singer-premium-blurred" aria-hidden="true">
      <div className="singer-premium-mock-media"/>
      <div className="singer-premium-mock-media"/>
      <div className="singer-premium-mock-media"/>
    </div>
    <div className="singer-premium-lock-content">
      <LockKeyhole size={24}/>
      <strong>{isPhotos?"Galeria de fotos Pro":"Vídeos em destaque Pro"}</strong>
      <span>{eligible?"O cantor já recebeu acesso Pro e está preparando esta galeria.":"Galeria opcional da versão Pro."}</span>
      {!eligible&&<Link href="/planos" className="btn btn-primary">Conhecer planos <ArrowUpRight size={15}/></Link>}
    </div>
  </div>;
}

export default function PublicSingerSite(){
  const {username}=useParams<{username:string}>();
  const [data,setData]=useState<PublicPro|null>(null);
  const [media,setMedia]=useState<PremiumMediaItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [proUnlocked,setProUnlocked]=useState(false);
  const [proEligible,setProEligible]=useState(false);
  const [bookingContact,setBookingContact]=useState<PublicBookingContact|null|undefined>(undefined);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  const [month,setMonth]=useState(()=>new Date(
    new Date().getFullYear(),new Date().getMonth(),1
  ));
  const [selectedDay,setSelectedDay]=useState<string|null>(null);
  const verified=useStageVerified("singer",username,Boolean(data));

  useEffect(()=>{
    let active=true;
    const blobUrls:string[]=[];
    async function load(){
      if(!username){setLoading(false);return;}
      setLoading(true);setError("");
      const client=createClient();
      // A Pro snapshot is the only source allowed to unlock paid sections.
      // If no entitled, published snapshot exists, use public singer data
      // without loading draft galleries, private media or payment fields.
      const {data:publicData,error:rpcError}=await client.rpc(
        "stage_public_pro_artist_site",{p_username:username}
      );
      if(!active)return;
      if(rpcError||!publicData){
        const {data:freeData,error:freeError}=await client.rpc(
          "stage_public_artist_page",{p_username:username}
        );
        if(!active)return;
        if(freeError||!freeData){
          setData(null);setMedia([]);setProUnlocked(false);setProEligible(false);
          if(freeError)setError("Não foi possível carregar o perfil público no momento.");
          setLoading(false);
          return;
        }
        const artist=freeData as FreeArtist;
        const [eventsResult,bookingResult,proResult]=await Promise.all([
          client.rpc("stage_public_artist_events",{p_username:username}),
          client.rpc("stage_public_artist_accepts_bookings",{p_username:username}),
          client.rpc("stage_public_singer_pro_access",{p_username:username})
        ]);
        if(!active)return;
        const freeEvents=eventsResult.error?[]:
          ((eventsResult.data||[]) as FreePublicShow[]);
        setData({
          artist:{...artist,bookings_enabled:bookingResult.data===true&&!bookingResult.error},
          design:{theme:"midnight",accent:palette.includes(artist.accent as Accent)?artist.accent as Accent:"violet",
            section_order:[...sectionIds],visible_sections:[...sectionIds]},
          media:[],
          events:freeEvents.map((event,i)=>({
            ...event,id:"free-show-"+i+"-"+event.starts_at.replace(/[^0-9]/g,"")
          }))
        });
        setProUnlocked(false);
        setProEligible(!proResult.error&&proResult.data===true);
        setMedia([]);
        setLoading(false);
        return;
      }
      const result=publicData as PublicPro;
      setProUnlocked(true);
      setProEligible(true);
      setData(result);
      // A imagem original permanece no bucket privado. Um visitante recebe
      // somente fotos explicitamente selecionadas para a versão publicada.
      // A storage policy valida publicação, titularidade e acesso Pro.
      // Antes mesmo de instalar o SQL, nunca baixe nem exiba mais de
      // 3 fotos e 3 vídeos publicados. Destaque vem primeiro.
      const allMedia=Array.isArray(result.media)?result.media:[];
      const choose=(kind:"photo"|"youtube")=>allMedia
        .filter(item=>item.media_kind===kind)
        .sort((a,b)=>Number(b.featured)-Number(a.featured)
          ||a.display_order-b.display_order||a.id.localeCompare(b.id))
        .slice(0,3);
      const snapshots=[...choose("photo"),...choose("youtube")]
        .sort((a,b)=>a.display_order-b.display_order||a.id.localeCompare(b.id));
      const resolved=await Promise.all(snapshots.map(async item=>{
        if(item.media_kind!=="photo"||!item.storage_path)return item;
        try{
          const {data:blob,error:downloadError}=await client.storage
            .from("stage-premium-drafts").download(item.storage_path);
          if(downloadError||!blob)return {...item,preview_url:""};
          const url=URL.createObjectURL(blob);
          blobUrls.push(url);
          return {...item,preview_url:url};
        }catch{return {...item,preview_url:""};}
      }));
      if(!active)return;
      setMedia(resolved);
      setLoading(false);
    }
    void load();
    return()=>{
      active=false;
      blobUrls.forEach(url=>URL.revokeObjectURL(url));
    };
  },[username]);

  useEffect(()=>{
    let active=true;
    if(!username){setBookingContact(null);return;}
    setBookingContact(undefined);
    void (async()=>{
      const {data,error}=await createClient().rpc("stage_public_booking_contact",{
        p_kind:"singer",p_slug:username
      });
      if(!active)return;
      setBookingContact(!error&&data&&typeof data.mode==="string"
        ?data as PublicBookingContact:null);
    })();
    return()=>{active=false};
  },[username]);

  const design=useMemo(()=>safeDesign(data?.design || {
    theme:"midnight",accent:"violet",
    section_order:sectionIds,visible_sections:sectionIds
  }),[data]);
  const visible=design.section_order.filter(
    id=>design.visible_sections.includes(id)
  );
  const events=data?.events||[];
  const nextShow=events.filter(show=>new Date(show.starts_at).getTime()>=Date.now())
    .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime())[0];
  const showDays=useMemo(()=>new Set(events.map(e=>showCode(e.starts_at))),[events]);
  const currentShows=selectedDay?
    events.filter(e=>showCode(e.starts_at)===selectedDay):events;
  const artist=data?.artist;
  const biography=artist?distinctPublicBiography(artist.headline,artist.bio):"";
  const instagram=publicInstagramProfile(artist?.instagram_url);
  const contactMode=bookingContact?.mode;
  const contactHref=contactMode==="whatsapp"
    ?whatsappBookingUrl(bookingContact?.phone,bookingContact?.greeting||"",artist?.name||"")
    :contactMode==="instagram"?instagram?.url||null
    :(bookingContact===null||contactMode==="auto")&&!artist?.bookings_enabled?instagram?.url||null:null;
  const contactIsForm=(contactMode==="form"&&Boolean(artist?.bookings_enabled))||((bookingContact===null||contactMode==="auto")&&Boolean(artist?.bookings_enabled));
  const contactTitle=contactMode==="whatsapp"?"Contratar pelo WhatsApp":contactMode==="instagram"?"Chamar no Instagram":"Contrate o cantor";
  function imageUrl(path:string|null|undefined){
    return path?createClient().storage.from("stage-artist-public")
      .getPublicUrl(path).data.publicUrl:"";
  }

  async function share(){
    const url=window.location.href;
    if(navigator.share){
      try{
        await navigator.share({title:(artist?.name||"Artista")+" — StageFlow",url});
        return;
      }catch(e){if(e instanceof Error&&e.name==="AbortError")return;}
    }
    try{await navigator.clipboard.writeText(url);setCopied(true);}
    catch{setError("Copie o endereço diretamente no navegador.");}
  }

  if(loading)return <main className="pro-public-loading">
    <LoaderCircle size={22}/> Carregando site profissional...
  </main>;

  if(!artist||!data)return <main className="pro-public-unavailable">
    <div>
      <Mic2 size={34}/>
      <h1>Perfil artístico indisponível.</h1>
      <p>{error||"Este cantor ainda não publicou seu perfil ou este @ não existe."}</p>
      <Link href="/" className="btn btn-primary"><ArrowLeft size={16}/> Voltar ao Stage Flow</Link>
    </div>
  </main>;

  return <main className="pro-public-page">
    <div className={"premium-site premium-theme-"+design.theme+" premium-site-"+design.accent}>
      <header className="premium-site-nav">
        <Link href="/" className="premium-site-brand">
          <span className="premium-site-signal"><Music2 size={20}/></span> STAGE FLOW
        </Link>
        <nav aria-label="Navegação do site profissional">
          {visible.map(id=><a key={id} href={anchor(id)}>{sectionLabels[id]}</a>)}
        </nav>
        <button type="button" className="pro-public-share" onClick={()=>void share()}>
          {copied?<Copy size={15}/>:<Share2 size={15}/>}
          {copied?"Copiado!":"Compartilhar"}
        </button>
      </header>

      <section className="premium-site-hero">
        <div className="premium-site-photo">
          {artist.cover_path&&<img src={imageUrl(artist.cover_path)}
            className="premium-site-cover" alt=""/>}
          {artist.avatar_path&&<img src={imageUrl(artist.avatar_path)}
            className="premium-site-portrait" alt={"Foto de "+artist.name}/>}
          {!artist.cover_path&&!artist.avatar_path&&
            <span className="premium-site-initials">
              {artist.name.split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()).join("")}
            </span>}
          <span className="premium-site-photo-caption">MÚSICA, IDENTIDADE E PALCO.</span>
        </div>
        <div className="premium-site-identity">
          <div className="premium-site-small-label"><span/> ARTISTA / STAGE FLOW</div>
          <div className="premium-site-name-row">
            <h1>{artist.name}{verified&&<StageVerifiedBadge compact/>}</h1>
            {artist.headline&&<p className="premium-site-signature">{artist.headline}</p>}
          </div>
          {artist.city&&<p className="premium-site-city"><MapPin size={16}/>{artist.city}</p>}
          <p className="premium-site-intro">{biography
            ?biography.length>210?biography.slice(0,207)+"…":biography
            :"Conheça os shows, o repertório e as novidades deste artista."}</p>
          {nextShow&&design.visible_sections.includes("agenda")&&
            <a href="#premium-agenda" className="pro-public-spotlight" aria-label={"Próximo show: "+nextShow.title}>
              <span className="pro-public-spotlight-icon"><CalendarDays size={21}/></span>
              <span className="pro-public-spotlight-details">
                <small>PRÓXIMO SHOW · EM DESTAQUE</small>
                <strong>{nextShow.title}</strong>
                <span>{new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"long",hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"}).format(new Date(nextShow.starts_at))}
                  {nextShow.venue?" · "+nextShow.venue:nextShow.city?" · "+nextShow.city:""}</span>
              </span>
              <ArrowUpRight size={18}/>
            </a>}
          <div className="premium-site-socials">
            {artist.instagram_url&&<a target="_blank" rel="noopener noreferrer"
              href={artist.instagram_url} aria-label="Instagram"><Instagram size={19}/></a>}
            {artist.youtube_url&&<a target="_blank" rel="noopener noreferrer"
              href={artist.youtube_url} aria-label="YouTube"><Youtube size={19}/></a>}
            {artist.spotify_url&&<a target="_blank" rel="noopener noreferrer"
              href={artist.spotify_url} aria-label="Spotify"><Music2 size={19}/></a>}
          </div>
          <div className="premium-site-actions">
            {design.visible_sections.includes("contact")&&(contactHref||contactIsForm)&&
              <a className="premium-site-main-action"
                href={contactHref||"#premium-contato"}
                target={contactHref?"_blank":undefined}
                rel={contactHref?"noopener noreferrer":undefined}>
                {contactMode==="whatsapp"?<MessageCircle size={17}/>:contactMode==="instagram"?<Instagram size={17}/>:<Mic2 size={17}/>}
                {contactHref?contactTitle:"Contrate o cantor"} <ArrowUpRight size={16}/>
              </a>}
            {design.visible_sections.includes("agenda")&&
              <a className="premium-site-secondary-action" href="#premium-agenda">
                <CalendarDays size={17}/> Próximos shows
              </a>}
          </div>
          <div className="premium-site-identity-foot">
            <span><CheckCircle2 size={15}/> {proUnlocked?"Recursos Pro publicados":proEligible?"Pro liberado · galerias em preparação":"Perfil público gratuito"}</span>
            <span>{events.length} {events.length===1?"show público futuro":"shows públicos futuros"}</span>
          </div>

        </div>
      </section>

      <div className="premium-site-tabs" aria-label="Seções do site">
        {visible.map(id=><a href={anchor(id)} key={id}>{sectionLabels[id]}</a>)}
      </div>

      <div className="premium-site-sections">
        {design.visible_sections.includes("about")&&
          <section className="premium-site-about" id="premium-sobre"
            style={{order:design.section_order.indexOf("about")}}>
            <div>
              <span className="premium-site-section-overline">
                {String(design.section_order.indexOf("about")+1).padStart(2,"0")} / MINHA HISTÓRIA
              </span>
              <h2>Sobre <em>o artista.</em></h2>
              <p>{biography||"Este artista está preparando sua história musical. Enquanto isso, descubra as próximas apresentações e entre em contato para saber mais."}</p>
            </div>
            <div className="premium-site-summary">
              <span className="premium-site-summary-icon"><Instagram size={23}/></span>
              <div><small>INSTAGRAM DO ARTISTA</small><strong>{instagram?.handle||"Redes do artista"}</strong></div>
              <p>{instagram?"Siga o artista para ver bastidores, novidades e próximas apresentações.":"O artista ainda não informou um Instagram público."}</p>
              {instagram&&<a href={instagram.url} target="_blank" rel="noopener noreferrer">
                Abrir Instagram <ArrowUpRight size={15}/>
              </a>}
            </div>
          </section>}

        {design.visible_sections.includes("photos")&&
          <section className="premium-site-work premium-site-media-section" id="premium-fotos"
            style={{order:design.section_order.indexOf("photos")}}>
            <div className="premium-site-section-head">
              <div>
                <span className="premium-site-section-overline">
                  {String(design.section_order.indexOf("photos")+1).padStart(2,"0")} / ÁLBUM DE SHOWS
                </span>
                <h2>Galeria de <em>fotos.</em></h2>
                <p>Momentos do palco, ensaios e bastidores do artista.</p>
              </div>
              <span className="premium-site-section-icon"><Instagram size={25}/></span>
            </div>
            {proUnlocked
              ? <PremiumGalleryShowcase items={media} section="photos" showEmpty showHeading={false}/>
              : <LockedProFeature type="photos" eligible={proEligible}/>}
          </section>}

        {design.visible_sections.includes("videos")&&
          <section className="premium-site-work premium-site-media-section" id="premium-videos"
            style={{order:design.section_order.indexOf("videos")}}>
            <div className="premium-site-section-head">
              <div>
                <span className="premium-site-section-overline">
                  {String(design.section_order.indexOf("videos")+1).padStart(2,"0")} / SHOWS E APRESENTAÇÕES
                </span>
                <h2>Vídeos <em>& apresentações.</em></h2>
                <p>Assista aos principais registros do artista.</p>
              </div>
              <span className="premium-site-section-icon"><PlayCircle size={25}/></span>
            </div>
            {proUnlocked
              ? <PremiumGalleryShowcase items={media} section="videos" showEmpty showHeading={false}
                  youtubeUrl={artist.youtube_url} spotifyUrl={artist.spotify_url}/>
              : <LockedProFeature type="videos" eligible={proEligible}/>}
          </section>}

        {design.visible_sections.includes("agenda")&&
          <section className="premium-site-agenda" id="premium-agenda"
            style={{order:design.section_order.indexOf("agenda")}}>
            <div className="premium-site-section-head">
              <div>
                <span className="premium-site-section-overline">
                  {String(design.section_order.indexOf("agenda")+1).padStart(2,"0")} / SHOWS
                </span>
                <h2>Agenda <em>de shows.</em></h2>
                <p>Apresentações que o artista escolheu divulgar publicamente.</p>
              </div>
              <CalendarDays size={27}/>
            </div>
            <div className="premium-site-schedule">
              <div className="premium-site-calendar">
                <div className="premium-site-calendar-heading">
                  <h3>{monthName(month)}</h3>
                  <div>
                    <button type="button" aria-label="Mês anterior"
                      onClick={()=>{
                        setMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1));
                        setSelectedDay(null);
                      }}><ChevronLeft size={18}/></button>
                    <button type="button" aria-label="Próximo mês"
                      onClick={()=>{
                        setMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1));
                        setSelectedDay(null);
                      }}><ChevronRight size={18}/></button>
                  </div>
                </div>
                <div className="premium-site-daynames">
                  {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><span key={d}>{d}</span>)}
                </div>
                <div className="premium-site-daygrid">
                  {monthCells(month).map((date,i)=>{
                    if(!date)return <div key={"empty-"+i} className="premium-site-day-empty"/>;
                    const key=dayCode(date);
                    const active=showDays.has(key);
                    return <button type="button" key={key}
                      aria-label={date.toLocaleDateString("pt-BR")+
                        (active?", apresentação publicada":", sem apresentação")}
                      aria-pressed={selectedDay===key}
                      className={(active?"premium-site-day-hasshow ":"")+
                        (selectedDay===key?"premium-site-day-selected":"")}
                      onClick={()=>setSelectedDay(v=>v===key?null:key)}>
                      {date.getDate()}{active&&<Mic2 size={12}/>}
                    </button>;
                  })}
                </div>
                <p className="premium-site-calendar-legend">
                  <Mic2 size={15}/> Dia com apresentação pública
                </p>
              </div>
              <div className="premium-site-showlist">
                <div className="premium-site-showlist-head">
                  <h3>{selectedDay?"Shows do dia":"Próximos shows"}</h3>
                  {selectedDay&&<button type="button" onClick={()=>setSelectedDay(null)}>
                    Ver todos <ArrowRight size={14}/>
                  </button>}
                </div>
                {currentShows.length>0 ?
                  <ProShowCards shows={currentShows} artistName={artist.name}/> :
                  <div className="premium-site-no-shows">
                    <CalendarDays size={24}/>
                    <strong>{selectedDay?"Nenhuma apresentação nesse dia.":"Novas datas em breve."}</strong>
                    <span>Acompanhe a agenda do artista para novidades.</span>
                  </div>}
              </div>
            </div>
          </section>}

        {design.visible_sections.includes("contact")&&
          <section className="pro-public-contact" id="premium-contato"
            style={{order:design.section_order.indexOf("contact")}}>
            <div className="premium-site-contact">
              <div className="premium-site-contact-icon"><Mic2 size={27}/></div>
              <div>
                <h2>Leve {artist.name} para seu evento.</h2>
                <p>{contactHref
                  ?"Converse diretamente pelo canal de contratação escolhido pelo artista."
                  :contactIsForm?"Envie uma solicitação privada e o cantor poderá retornar seu contato."
                  :"Para informações sobre apresentações, acompanhe as redes oficiais."}</p>
              </div>
              {contactHref&&<a className="premium-site-main-action"
                  target="_blank" rel="noopener noreferrer" href={contactHref}>
                  {contactMode==="whatsapp"?<MessageCircle size={16}/>:<Instagram size={16}/>}
                  {contactTitle} <ArrowUpRight size={15}/>
                </a>}
            </div>
            {contactIsForm&&
              <div className="pro-public-booking">
                <ArtistBookingForm username={artist.username} artistName={artist.name}/>
              </div>}
          </section>}
        {!proUnlocked&&<section className="singer-premium-upgrade" aria-label={proEligible?"Recursos Pro em preparação":"Personalização Pro bloqueada"}
          style={{order:6}}>
          <div className="singer-premium-upgrade-symbol"><Crown size={22}/></div>
          <div><h2>{proEligible?"Seu Pro já está liberado":"Mais destaque para a sua carreira"}</h2>
            <p>{proEligible?"O cantor pode publicar o visual e as galerias Pro quando estiver pronto. Nenhum conteúdo privado é exposto antes da publicação.":"Seu perfil já tem um visual profissional; galerias e temas especiais são recursos opcionais Pro."}</p></div>
          {!proEligible&&<Link href="/planos" className="btn btn-primary">Ver planos e benefícios <ArrowUpRight size={16}/></Link>}
        </section>}
      </div>
      <footer className="premium-site-footer">
        <span><Music2 size={18}/> STAGE FLOW
          <small>Conectando artistas, músicos e produtores</small>
        </span>
        <span>{proUnlocked?"Perfil de cantor · Pro publicado":proEligible?"Perfil de cantor · Pro liberado":"Perfil de cantor · Recursos Pro opcionais"} · Stage Flow</span>
      </footer>
    </div>
    {error&&<p className="pro-public-error" role="alert">{error}</p>}
  </main>;
}
