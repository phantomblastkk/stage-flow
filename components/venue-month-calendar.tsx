"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./venue-month-calendar.css";

export type CalendarShow = { id: string; starts_at: string };
type Props = {
  month: Date; events: CalendarShow[]; selectedDay: number | null;
  onMonthChange: (month: Date) => void; onDayChange: (day: number | null) => void;
};

export function venueMonthStart(date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo",
    year: "numeric", month: "numeric" }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  return new Date(Date.UTC(y, m-1, 1));
}
export function venueDayKey(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
export function venueDayOfMonth(iso: string): number {
  return Number(venueDayKey(iso).slice(-2));
}
export function venueMonthKey(month: Date) {
  return month.toISOString().slice(0, 7);
}
export function shiftVenueMonth(month: Date, delta: number) {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth()+delta, 1));
}
const weekdays = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export default function VenueMonthCalendar({
  month, events, selectedDay, onMonthChange, onDayChange
}: Props) {
  const year = month.getUTCFullYear();
  const mm = month.getUTCMonth();
  const first = new Date(Date.UTC(year, mm, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, mm+1, 0)).getUTCDate();
  const monthKey = venueMonthKey(month);
  const byDay = new Map<number, number>();
  for (const event of events) {
    const key = venueDayKey(event.starts_at);
    if (key.slice(0, 7) !== monthKey) continue;
    const day = Number(key.slice(-2));
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  const label = new Intl.DateTimeFormat("pt-BR", {month:"long",year:"numeric",timeZone:"UTC"}).format(month);
  return <div className="venue-month-widget">
    <div className="venue-month-header">
      <strong>{label}</strong>
      <div className="venue-month-actions">
        <button type="button" aria-label="Mês anterior" onClick={() => {
          onMonthChange(shiftVenueMonth(month, -1)); onDayChange(null);
        }}><ChevronLeft size={19}/></button>
        <button type="button" aria-label="Próximo mês" onClick={() => {
          onMonthChange(shiftVenueMonth(month, 1)); onDayChange(null);
        }}><ChevronRight size={19}/></button>
      </div>
    </div>
    <div className="venue-month-days">
      {weekdays.map((day) => <span className="venue-month-weekday" key={day}>{day}</span>)}
      {Array.from({length: first},(_,i) => <span aria-hidden="true" key={"blank"+i}/>)}
      {Array.from({length:count},(_,i) => {
        const day = i+1, total=byDay.get(day) || 0;
        return <button type="button" key={day}
          className={"venue-month-day"+(selectedDay===day?" is-selected":"")+
            (total?" has-event":"")}
          aria-label={day+" de "+label+(total?", "+total+" shows":"")}
          aria-pressed={selectedDay===day}
          onClick={() => onDayChange(selectedDay===day ? null : day)}>
          <span>{day}</span>{total>0&&<span className="venue-month-count">{total}</span>}
        </button>;
      })}
    </div>
    <div className="venue-month-legend"><span className="venue-month-dot"/> Dia com apresentação
      {selectedDay && <button type="button" onClick={()=>onDayChange(null)}>Limpar filtro</button>}
    </div>
  </div>;
}
