"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, CheckCircle2, LoaderCircle, Mail, MapPin, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./artist-booking-form.css";

const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2,"0") +
    "-" + String(d.getDate()).padStart(2,"0");
};

const maxDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 3);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2,"0") +
    "-" + String(d.getDate()).padStart(2,"0");
};

type Props = {
  username: string;
  artistName: string;
};

export default function ArtistBookingForm({ username, artistName }: Props) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [problem, setProblem] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setProblem("");
    if (!consent) {
      setProblem("É necessário autorizar o envio dos dados ao artista.");
      return;
    }
    setSending(true);
    const { data, error } = await createClient().rpc("stage_submit_artist_booking", {
      p_username: username,
      p_contact_name: contactName.trim(),
      p_contact_email: contactEmail.trim(),
      p_contact_phone: contactPhone.trim() || null,
      p_event_city: eventCity.trim(),
      p_event_date: eventDate || null,
      p_message: message.trim(),
      p_consent: consent,
      p_website: website
    });

    const errors: Record<string, string> = {
      consent_required: "Confirme o consentimento para enviar.",
      invalid_name: "Informe seu nome com 2 a 100 caracteres.",
      invalid_email: "Informe um e-mail válido para o retorno.",
      invalid_phone: "Informe um telefone válido ou deixe o campo vazio.",
      invalid_city: "Informe uma cidade com pelo menos 2 caracteres.",
      invalid_date: "Escolha uma data futura válida.",
      invalid_message: "Descreva o evento em 20 a 1.500 caracteres.",
      too_many_requests: "O limite temporário de solicitações foi atingido. Tente novamente mais tarde.",
      unavailable: "Este artista não está recebendo solicitações por aqui no momento."
    };

    if (error) {
      setProblem(error.code === "42883" || error.code === "PGRST202"
        ? "O formulário ainda está sendo ativado. Tente novamente mais tarde."
        : "Não foi possível enviar agora. Tente novamente mais tarde.");
    } else if (data !== "received") {
      setProblem(errors[String(data)] || "Não foi possível enviar sua solicitação.");
    } else {
      setSubmitted(true);
    }
    setSending(false);
  }

  if (submitted) {
    return <section className="artist-booking-form artist-booking-complete" aria-live="polite">
      <span className="artist-free-label">CONTATO PROFISSIONAL</span>
      <CheckCircle2 size={34}/>
      <h2>Solicitação enviada!</h2>
      <p>Seus dados foram encaminhados para a caixa de solicitações de {artistName}. O retorno depende da disponibilidade do artista.</p>
      <button type="button" className="btn btn-quiet" onClick={() => {
        setSubmitted(false);
        setMessage("");
        setEventDate("");
        setConsent(false);
      }}>Enviar outra solicitação</button>
    </section>;
  }

  return <section className="artist-free-card artist-booking-form" id="contratar">
    <span className="artist-free-label">CONTATO PROFISSIONAL</span>
    <h2>Contrate {artistName}</h2>
    <p>Quer levar esse show para seu evento? Conte os detalhes e o artista poderá entrar em contato com você.</p>
    <form onSubmit={event => void submit(event)}>
      <div className="artist-booking-fields">
        <div className="artist-booking-field">
          <label htmlFor="artist-booking-name">Seu nome *</label>
          <input id="artist-booking-name" type="text" autoComplete="name"
            required minLength={2} maxLength={100} value={contactName}
            onChange={event => setContactName(event.target.value)}
            placeholder="Como podemos chamar você?"/>
        </div>
        <div className="artist-booking-field">
          <label htmlFor="artist-booking-email"><Mail size={13}/> E-mail para retorno *</label>
          <input id="artist-booking-email" type="email" autoComplete="email"
            required maxLength={254} value={contactEmail}
            onChange={event => setContactEmail(event.target.value)}
            placeholder="voce@exemplo.com"/>
        </div>
        <div className="artist-booking-field">
          <label htmlFor="artist-booking-phone">WhatsApp (opcional)</label>
          <input id="artist-booking-phone" type="tel" autoComplete="tel"
            maxLength={22} value={contactPhone}
            onChange={event => setContactPhone(event.target.value)}
            placeholder="(11) 99999-9999"/>
        </div>
        <div className="artist-booking-field">
          <label htmlFor="artist-booking-city"><MapPin size={13}/> Cidade do evento *</label>
          <input id="artist-booking-city" type="text"
            required minLength={2} maxLength={140} value={eventCity}
            onChange={event => setEventCity(event.target.value)}
            placeholder="Ex.: São Paulo - SP"/>
        </div>
        <div className="artist-booking-field">
          <label htmlFor="artist-booking-date"><CalendarDays size={13}/> Data prevista (opcional)</label>
          <input id="artist-booking-date" type="date" min={today()} max={maxDate()}
            value={eventDate} onChange={event => setEventDate(event.target.value)}/>
        </div>
      </div>

      <div className="artist-booking-field">
        <label htmlFor="artist-booking-message">Conte sobre o evento *</label>
        <textarea id="artist-booking-message" required minLength={20}
          maxLength={1500} rows={5} value={message}
          onChange={event => setMessage(event.target.value)}
          placeholder="Tipo de evento, local, horário, público esperado e outras informações úteis..."/>
        <small>{message.length}/1500 caracteres · mínimo de 20</small>
      </div>

      <div className="artist-booking-honey" aria-hidden="true">
        <label htmlFor="artist-booking-website">Site</label>
        <input id="artist-booking-website" tabIndex={-1} autoComplete="off"
          value={website} onChange={event => setWebsite(event.target.value)}/>
      </div>

      <label className="artist-booking-consent">
        <input type="checkbox" checked={consent} required
          onChange={event => setConsent(event.target.checked)}/>
        <span>Autorizo o envio do meu nome, e-mail, telefone (se informado) e detalhes do evento para {artistName} pelo Stage Flow, exclusivamente para responder a esta solicitação. Os dados não serão exibidos publicamente. *</span>
      </label>

      {problem && <div role="alert" className="artist-booking-error">{problem}</div>}

      <button type="submit" className="btn btn-primary artist-booking-submit"
        disabled={sending || !consent}>
        {sending ? <LoaderCircle size={16}/> : <Send size={16}/>}
        {sending ? "Enviando..." : "Enviar solicitação"}
      </button>
      <p className="artist-booking-note">O envio é gratuito e não confirma uma contratação, reserva ou disponibilidade. O artista poderá responder diretamente pelos contatos informados.</p>
    </form>
  </section>;
}
