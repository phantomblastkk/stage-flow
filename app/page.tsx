import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Globe2, Music2, Users, Zap, Instagram, Play, Bell } from "lucide-react";

export default function Home() {
  return (
    <main>
      <div className="container">
        <nav className="nav">
          <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
          <div className="nav-links">
            <a className="hide-mobile" href="#recursos">Recursos</a>
            <a className="hide-mobile" href="#artistas">Para artistas</a>
            <Link className="btn btn-quiet" href="/login">Entrar</Link>
            <Link className="btn btn-primary" href="/cadastro">Criar conta <ArrowRight size={15}/></Link>
          </div>
        </nav>
        <section className="hero">
          <div>
            <div className="eyebrow"><span className="dot"/> A música acontece. A organização também.</div>
            <h1>Sua carreira musical, <span className="accent">no ritmo certo.</span></h1>
            <p className="lead">Organize shows, confirme convites e apresente seu trabalho em um só lugar. Menos mensagens perdidas, mais música acontecendo.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/cadastro">Começar agora <ArrowRight size={16}/></Link>
              <a className="btn btn-quiet" href="#recursos">Conhecer a plataforma</a>
            </div>
            <p className="fine">Para músicos, bandas, produtores e equipes de eventos.</p>
          </div>
          <div className="preview">
            <div className="preview-top"><div><div className="tiny-label">PAINEL DO ARTISTA</div><div className="preview-title">Sua agenda</div></div><span className="status">● Tudo organizado</span></div>
            <div className="stat-row"><div className="stat"><strong>08</strong><span>Shows no mês</span></div><div className="stat"><strong>03</strong><span>Convites novos</span></div><div className="stat"><strong>100%</strong><span>No controle</span></div></div>
            <div className="event"><div className="event-date"><div><strong>18</strong><br/><span>OUT</span></div></div><div className="event-info"><strong>Pagode na Praça</strong><span>São Paulo · 20h</span></div><span className="event-pill">Confirmado</span></div>
            <div className="event"><div className="event-date"><div><strong>22</strong><br/><span>OUT</span></div></div><div className="event-info"><strong>Festival de Música</strong><span>Guarulhos · 18h</span></div><span className="event-pill">Convite</span></div>
            <div className="event"><div className="event-date"><div><strong>26</strong><br/><span>OUT</span></div></div><div className="event-info"><strong>Evento particular</strong><span>São Paulo · 15h</span></div><span className="event-pill">Confirmado</span></div>
          </div>
        </section>
        <section className="section" id="recursos">
          <div className="section-heading"><h2>Feito para quem vive de música.</h2><p>Uma rotina mais simples para quem sobe no palco e para quem faz os shows acontecerem nos bastidores.</p></div>
          <div className="cards">
            <article className="feature"><div className="feature-icon"><CalendarDays/></div><h3>Agenda sem conflito</h3><p>Centralize datas, horários, locais e detalhes dos eventos para consultar tudo com clareza.</p></article>
            <article className="feature"><div className="feature-icon"><Users/></div><h3>Convites organizados</h3><p>Produtores convidam músicos e acompanham as confirmações em um só fluxo.</p></article>
            <article className="feature"><div className="feature-icon"><Bell/></div><h3>Notificações importantes</h3><p>Tenha um lugar central para acompanhar convites, alterações e atualizações da agenda.</p></article>
          </div>
        </section>
        <section className="section" id="artistas">
          <div className="section-heading"><h2>Seu talento merece uma vitrine própria.</h2><p>Estamos preparando páginas públicas personalizadas para artistas compartilharem sua agenda, história e contatos profissionais.</p></div>
          <div className="profile-demo"><div className="avatar">CS</div><div className="profile-copy"><h3>Cantor Sousa</h3><p>Samba · Pagode · São Paulo, SP</p><div className="profile-url">cantorsousa.stageflow.com <span style={{color:"#98a3b6"}}>· exemplo de endereço futuro</span></div></div><div style={{display:"flex",gap:8,color:"#c6f36b"}}><Instagram/><Music2/><Play/></div></div>
        </section>
        <section className="cta"><div><h2>Vamos colocar sua agenda em movimento?</h2><p>Crie seu acesso e acompanhe a evolução do Stage Flow.</p></div><Link className="btn btn-primary" href="/cadastro">Criar minha conta <ArrowRight size={16}/></Link></section>
        <footer className="footer"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><span>Projeto em desenvolvimento · Nome e domínio provisórios</span><span>© {new Date().getFullYear()} Stage Flow</span></footer>
      </div>
    </main>
  );
}
