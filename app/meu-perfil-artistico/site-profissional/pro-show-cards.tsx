"use client";

import { useEffect, useState } from "react";
import {
  CalendarPlus, Check, ChevronDown, ChevronUp, Clock3, Copy,
  ExternalLink, MapPin, Share2, Ticket
} from "lucide-react";
import "./pro-show-cards.css";

export type ProPublicShow = {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
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
      "Horário de término não informado: ajuste a duração no calendário, se necessário.\n" +
      "Detalhes: " + url
    ),
    "URL:" + url,
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  return lines.join("\r\n") + "\r\n";
}

function eventLink(id: string): string {
  return window.location.origin + window.location.pathname + "#show-" + encodeURIComponent(id);
}

export default function ProShowCards({ shows, artistName, preview = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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
        <div className="pro-show-card-content">
          <span className="pro-show-card-eyebrow"><Ticket size={12}/> SHOW CONFIRMADO NA AGENDA PÚBLICA</span>
          <h4>{show.title}</h4>
          <div className="pro-show-card-facts">
            <span><Clock3 size={15}/>
              {validDate ? weekday + ", " + hour : "Horário não disponível"}
            </span>
            <span><MapPin size={15}/>{location || "Local a confirmar"}</span>
          </div>
          <div className="pro-show-card-actions">
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
