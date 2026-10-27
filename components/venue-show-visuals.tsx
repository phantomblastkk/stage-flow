"use client";
import { ArrowUpRight, CalendarDays, Clock3, Image as ImageIcon, Music2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./venue-show-visuals.css";

export type VenuePublicShow = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  flyer_path: string | null;
  status: string;
};

function dateParts(iso: string) {
  const date = new Date(iso);
  const values = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    values.find((item) => item.type === name)?.value || "";
  return { day: part("day"), month: part("month").replace(".","").toUpperCase(),
    year: part("year"), time: part("hour")+":"+part("minute") };
}
export function venueShowFlyerUrl(path: string) {
  return createClient().storage.from("stage-venue-media").getPublicUrl(path).data.publicUrl;
}
export function VenueFlyerPicture({show,featured=false}: {
  show: VenuePublicShow; featured?: boolean
}) {
  return <span className={"sf-house-poster"+(featured?" sf-house-poster-featured":"")}>
    {show.flyer_path
      ? <img loading="lazy" src={venueShowFlyerUrl(show.flyer_path)}
          alt={"Flyer: "+show.title}/>
      : <span className="sf-house-poster-empty">
        <Music2 size={featured?37:29}/>
        <small>{featured?"SHOW AO VIVO":"PROGRAMAÇÃO"}</small>
      </span>}
  </span>;
}

export function VenueShowCard({show,onOpen}: {
  show: VenuePublicShow; onOpen:(show:VenuePublicShow)=>void
}) {
  const date = dateParts(show.starts_at);
  const historical = new Date(show.starts_at).getTime()<Date.now();
  return <button type="button" className="sf-house-show-card"
    onClick={()=>onOpen(show)} aria-label={"Abrir detalhes de "+show.title}>
    <VenueFlyerPicture show={show}/>
    <span className="sf-house-show-date">
      <strong>{date.day}</strong><small>{date.month}</small>
    </span>
    <span className="sf-house-show-body">
      <span className="sf-house-show-kicker">
        <Clock3 size={12}/>{date.time} · {date.year}
        {historical&&<span className="sf-house-tag-past">Já aconteceu</span>}
      </span>
      <strong className="sf-house-show-title">{show.title}</strong>
      {show.description&&<span className="sf-house-show-description">{show.description}</span>}
      <span className="sf-house-show-action">Ver programação <ArrowUpRight size={14}/></span>
    </span>
  </button>;
}

export function VenueFeaturedEvent({show,houseName,onOpen,onGoToCalendar}: {
  show:VenuePublicShow;houseName:string;
  onOpen:(show:VenuePublicShow)=>void;onGoToCalendar:(show:VenuePublicShow)=>void
}) {
  const date = dateParts(show.starts_at);
  return <section className="sf-house-featured" aria-label="Próxima atração da casa">
    <div className="sf-house-featured-content">
      <span className="sf-house-featured-kicker"><span className="sf-house-featured-live"/>
        PRÓXIMA APRESENTAÇÃO
      </span>
      <h2>{show.title}</h2>
      <p className="sf-house-featured-meta"><CalendarDays size={17}/>
        {date.day} de {date.month.toLowerCase()} · {date.time}
      </p>
      <p className="sf-house-featured-place">{houseName}</p>
      {show.description&&<p className="sf-house-featured-description">{show.description}</p>}
      <div className="sf-house-featured-actions">
        <button className="btn btn-primary" type="button" onClick={()=>onOpen(show)}>
          Ver detalhes <ArrowUpRight size={15}/>
        </button>
        <button className="btn btn-quiet" type="button" onClick={()=>onGoToCalendar(show)}>
          <CalendarDays size={15}/> Ver no calendário
        </button>
      </div>
    </div>
    <VenueFlyerPicture show={show} featured/>
  </section>;
}

export function VenueFlyerCard({show,onOpen}:{
  show:VenuePublicShow;onOpen:(show:VenuePublicShow)=>void
}) {
  const date=dateParts(show.starts_at);
  return <button type="button" className="sf-house-flyer-card"
    onClick={()=>onOpen(show)} aria-label={"Ampliar flyer de "+show.title}>
    <VenueFlyerPicture show={show}/>
    <span className="sf-house-flyer-caption">
      <span className="sf-house-flyer-tag"><ImageIcon size={12}/> Flyer oficial</span>
      <strong>{show.title}</strong>
      <small>{date.day} {date.month} · {date.time}</small>
    </span>
  </button>;
}
