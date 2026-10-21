import Link from "next/link";
import { ArrowLeft, ArrowRight, BellRing, Guitar, LockKeyhole, Music2, Sparkles, Users } from "lucide-react";
import "./coming-soon.css";

export const metadata = {
  title: "Marketplace de Músicos — Em breve | Stage Flow",
  description: "O marketplace de músicos do Stage Flow está em preparação. Em breve, conectando talentos e contratantes."
};

export default function MarketplaceComingSoon() {
  return <main className="market-coming-page">
    <div className="market-coming-wrap">
      <nav className="market-coming-nav">
        <Link href="/" className="brand"><span className="brand-mark">S</span> stage flow</Link>
        <Link href="/" className="market-coming-return"><ArrowLeft size={15}/> Voltar ao Stage Flow</Link>
      </nav>
      <section className="market-coming-hero">
        <div className="market-coming-orbits" aria-hidden="true">
          <span/><span/><span/>
          <Music2 size={78}/>
        </div>
        <div className="market-coming-content">
          <span className="market-coming-pill"><Sparkles size={14}/> NOVIDADE EM DESENVOLVIMENTO</span>
          <div className="market-coming-mark">STAGE FLOW <span>/ MUSIC MARKETPLACE</span></div>
          <h1>O próximo encontro<br/>acontece <em>no palco.</em></h1>
          <p>Estamos preparando um novo espaço para descobrir músicos, explorar portfólios e conectar talentos a oportunidades de shows.</p>
          <div className="market-coming-status">
            <span className="market-coming-dot"/>
            <strong>Em breve</strong>
            <span>Sem data de lançamento anunciada</span>
          </div>
          <div className="market-coming-actions">
            <Link href="/meu-portfolio" className="market-coming-primary">
              <Guitar size={17}/> Preparar meu portfólio <ArrowRight size={16}/>
            </Link>
            <Link href="/painel" className="market-coming-secondary">
              Ir para meu painel <ArrowRight size={16}/>
            </Link>
          </div>
        </div>
      </section>
      <section className="market-coming-features" aria-label="O que vem por aí">
        <div><Users size={21}/><strong>Encontre profissionais</strong><span>Por instrumento, estilo e região</span></div>
        <div><Guitar size={21}/><strong>Conheça os trabalhos</strong><span>Portfólios gratuitos dos músicos</span></div>
        <div><BellRing size={21}/><strong>Convites mais simples</strong><span>Planejados para a sua agenda</span></div>
      </section>
      <footer className="market-coming-footer">
        <span><LockKeyhole size={14}/> Funcionalidade ainda não liberada ao público.</span>
        <span>STAGE FLOW © 2026</span>
      </footer>
    </div>
  </main>;
}
