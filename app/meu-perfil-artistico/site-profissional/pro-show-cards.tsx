"use client";

import { useEffect, useState } from "react";
import {
  CalendarPlus, Check, ChevronDown, ChevronUp, Clock3, Copy,
  Download, ExternalLink, Image as ImageIcon, MapPin, Share2, Ticket
} from "lucide-react";
import "./pro-show-cards.css";
import { createClient } from "@/lib/supabase/client";
import {
  downloadFlyer, flyerFileName, loadFlyerImage,
  makeFlyerBlob, safeFlyerSettings, type FlyerFormat
} from "./show-flyer-render";

export type ProPublicShow = {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  flyer_path?: string | null;
  flyer_settings?: unknown;
};

type Props = {
  shows: ProPublicShow[];
  artistName: string;
  preview?: boolean;
};

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function eventLocation(show: ProPublicShow): string {
  return [show.venue?.trim(), show.city?.trim()].filter(Boolean).join(" · ");
}

function createCalendarFile(show: ProPublicShow, artistName: string, url: string): string | null {
  const start = new Date(show.starts_at);
  if (!Number.isFinite(start.getTime())) return null;

  const location = eventLocation(show);
  const title = show.title.trim() || "Apresentação ao vivo";
  // Sem DTEND: o cadastro do show informa apenas o início.
  // Não inventamos um horário de término para o calendário do visitante.
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stage Flow//Agenda Publica//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + show.id.replace(/[^a-zA-Z0-9-]/g, "") + "@stageflow",
    "DTSTAMP:" + timestamp(new Date()),
    "DTSTART:" + timestamp(start),
    "SUMMARY:" + escapeIcs(title + " — " + artistName),
    ...(location ? ["LOCATION:" + escapeIcs(location)] : []),
    "DESCRIPTION:" + escapeIcs(
      "Apresentação de " + artistName + ".\n" +
      "Horário de término não informado: ajuste a duração no calendário, se necessário." +
      (url ? "\nDetalhes: " + url : "")
    ),
    ...(url ? ["URL:" + url] : []),
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  return lines.join("\r\n") + "\r\n";
}

function eventLink(id: string): string {
  return window.location.origin + window.location.pathname + "#show-" + encodeURIComponent(id);
}


/** Signed URL is only requested for the cards currently mounted/visible. */
function ShowFlyerThumb({path,title}:{path:string;title:string}){
  const [url,setUrl]=useState("");
  useEffect(()=>{
    let active=true;
    void createClient().storage.from("stage-show-flyers")
      .createSignedUrl(path,3600).then(({data,error})=>{
        if(active && !error && data?.signedUrl)setUrl(data.signedUrl);
      });
    return()=>{active=false};
  },[path]);
  if(!url)return <div className="pro-show-card-flyer is-loading">
    <ImageIcon size={23}/><small>FLYER</small>
  </div>;
  return <div className="pro-show-card-flyer">
    <img src={url} alt={"Cartaz do show "+title} loading="lazy"/>
    <span>FLYER</span>
  </div>;
}

export default function ProShowCards({ shows, artistName, preview = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [downloading,setDownloading] = useState<string|null>(null);

  // Links individuais continuam funcionando quando a lista foi recolhida,
  // inclusive após o carregamento assíncrono do site Pro publicado.
  useEffect(() => {
    if (preview) return;
    const target = window.location.hash.slice(1);
    if (target.startsWith("show-") &&
      shows.some(show => "show-" + show.id === target)) {
      setExpanded(true);
    }
  }, [shows, preview]);

  useEffect(() => {
    if (preview || !expanded) return;
    const target = window.location.hash.slice(1);
    if (!target.startsWith("show-")) return;
    document.getElementById(target)?.scrollIntoView({ block: "center" });
  }, [expanded, shows, preview]);

  async function shareShow(show: ProPublicShow) {
    const url = eventLink(show.id);
    const text = show.title + " — " + artistName +
      (eventLocation(show) ? " | " + eventLocation(show) : "");
    setMessage("");
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(show.id);
    } catch {
      setMessage("Não foi possível copiar. Abra o show no navegador e copie o endereço.");
    }
  }

  function saveCalendar(show: ProPublicShow) {
    setMessage("");
    const url = preview ? "" : eventLink(show.id);
    const ics = createCalendarFile(show, artistName, url);
    if (!ics) {
      setMessage("A data deste show está inválida e não pode ser enviada ao calendário.");
      return;
    }
    const file = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = file;
    anchor.download = "show-" + show.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 30) + ".ics";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(file), 30000);
  }

  async function exportFlyer(show:ProPublicShow,format:FlyerFormat){
    if(!show.flyer_path||downloading)return;
    setDownloading(show.id+format);
    setMessage("");
    const {data:blob,error}=await createClient().storage
      .from("stage-show-flyers").download(show.flyer_path);
    if(error||!blob){
      setMessage("Não foi possível baixar o flyer. Confira se o site está publicado e o arquivo ainda existe.");
      setDownloading(null);
      return;
    }
    const url=URL.createObjectURL(blob);
    try{
      const image=await loadFlyerImage(url);
      const settings=safeFlyerSettings(show.flyer_settings);
      const output=await makeFlyerBlob(image,format,settings[format]);
      downloadFlyer(output,flyerFileName(show.title,format));
    }catch{
      setMessage("Não foi possível gerar o flyer. Confira a imagem original.");
    }finally{
      URL.revokeObjectURL(url);
      setDownloading(null);
    }
  }

  const visible = expanded ? shows : shows.slice(0, 6);
  return <div className="pro-show-cards">
    {visible.map(show => {
      const start = new Date(show.starts_at);
      const validDate = Number.isFinite(start.getTime());
      const location = eventLocation(show);
      const day = validDate ? start.toLocaleDateString("pt-BR", { day: "2-digit" }) : "--";
      const month = validDate ? start.toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "").toUpperCase() : "---";
      const weekday = validDate ? start.toLocaleDateString("pt-BR", { weekday: "long" }) : "";
      const hour = validDate ? start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

      return <article className="pro-show-card" id={"show-" + show.id} key={show.id}
        aria-label={"Show " + show.title}>
        <div className="pro-show-card-date" aria-label={validDate ? start.toLocaleDateString("pt-BR") : "Data não definida"}>
          <strong>{day}</strong>
          <span>{month}</span>
        </div>
        {show.flyer_path && <ShowFlyerThumb path={show.flyer_path} title={show.title}/>}
        <div className="pro-show-card-content">
          <span className="pro-show-card-eyebrow"><Ticket size={12}/> SHOW PUBLICADO NA AGENDA</span>
          <h4>{show.title}</h4>
          <div className="pro-show-card-facts">
            <span><Clock3 size={15}/>
              {validDate ? weekday + ", " + hour : "Horário não disponível"}
            </span>
            <span><MapPin size={15}/>{location || "Local a confirmar"}</span>
          </div>
          <div className="pro-show-card-actions">
            {show.flyer_path&&<>
              <button type="button" disabled={Boolean(downloading)}
                onClick={()=>void exportFlyer(show,"feed")}
                title="Baixar arte em 1080 × 1350 px">
                <Download size={15}/> {downloading===show.id+"feed"?"Gerando...":"Baixar Feed"}
              </button>
              <button type="button" disabled={Boolean(downloading)}
                onClick={()=>void exportFlyer(show,"story")}
                title="Baixar arte em 1080 × 1920 px">
                <Download size={15}/> {downloading===show.id+"story"?"Gerando...":"Baixar Story"}
              </button>
            </>}
            <button type="button" onClick={() => saveCalendar(show)}
              disabled={!validDate} title="Baixar evento .ics (horário de término não informado)">
              <CalendarPlus size={15}/> Adicionar ao calendário
            </button>
            {!preview && <button type="button"
              onClick={() => void shareShow(show)}>
              {copiedId === show.id ? <Check size={15}/> : <Share2 size={15}/>}
              {copiedId === show.id ? "Link copiado" : "Compartilhar show"}
            </button>}
            {!preview && <a href={"#show-" + show.id}
              aria-label={"Link direto para o show " + show.title}>
              <ExternalLink size={15}/> Ver link
            </a>}
          </div>
        </div>
      </article>;
    })}
    {shows.length > 6 && <button type="button" className="pro-show-cards-more"
      onClick={() => setExpanded(value => !value)}
      aria-expanded={expanded}>
      {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
      {expanded ? "Mostrar menos shows" : "Ver todos os " + shows.length + " shows"}
    </button>}
    {preview && shows.length > 0 && <p className="pro-show-cards-hint">
      Na página pública, cada show também terá um link próprio para compartilhar.
    </p>}
    {message && <p className="pro-show-cards-message" role="alert">
      <Copy size={14}/>{message}
    </p>}
  </div>;
}
