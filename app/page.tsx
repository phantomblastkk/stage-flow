import Link from "next/link";
import HomePartnerVenues from "@/components/home-partner-venues";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, Check,
  CirclePlay, Guitar, Music2, Palette,
  ShieldCheck, Sparkles, Users, Wallet, Search
} from "lucide-react";

export default function Home() {
  return <main className="home-shell">
    <div className="container">
      <nav className="nav home-nav">
        <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
        <div className="nav-links">
          <a className="hide-mobile" href="#recursos">Funcionalidades</a>
          <a className="hide-mobile" href="#musicos">Para músicos</a>
          <Link className="btn btn-quiet" href="/login">Entrar</Link>
          <Link className="btn btn-primary" href="/cadastro">Criar conta <ArrowRight size={15}/></Link>
        </div>
      </nav>

      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-pill"><span className="home-live-dot"/> O palco é seu. A organização também.</div>
          <h1>Mais música.<br/><span>Menos correria.</span></h1>
          <p>Shows, músicos, convites e cachês em um só lugar. O Stage Flow conecta sua agenda ao que realmente importa: fazer a música acontecer.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/cadastro">Começar gratuitamente <ArrowRight size={17}/></Link>
            <a className="btn btn-quiet" href="#recursos">Descobrir o Stage Flow <ArrowUpRight size={16}/></a>
          </div>
          <div className="home-hero-points">
            <span><Check size={15}/> Agenda profissional</span>
            <span><Check size={15}/> Convites por link</span>
            <span><Check size={15}/> Portfólio gratuito</span>
          </div>
        </div>

        <div className="home-stage">
          <div className="home-stage-glow" aria-hidden="true"/>
          <div className="home-stage-card">
            <div className="home-stage-top">
              <span><span className="home-stage-dot"/> STAGE FLOW / SHOWS</span>
              <span className="home-stage-tag">Painel ilustrativo</span>
            </div>
            <div className="home-stage-title">
              <div>
                <span className="home-stage-muted">OUTUBRO / AGENDA</span>
                <h2>Próximos palcos.</h2>
              </div>
              <span className="home-stage-calendar"><CalendarDays size={22}/></span>
            </div>
            <div className="home-stage-events">
              <div className="home-stage-event">
                <span className="home-stage-date"><strong>18</strong><small>OUT</small></span>
                <span className="home-stage-event-info"><strong>Pagode no Deck 2</strong><small>São Paulo · 20h</small></span>
                <span className="home-stage-status"><Check size={13}/> Confirmado</span>
              </div>
              <div className="home-stage-event">
                <span className="home-stage-date"><strong>22</strong><small>OUT</small></span>
                <span className="home-stage-event-info"><strong>Festival de Música</strong><small>Guarulhos · 18h</small></span>
                <span className="home-stage-status home-stage-status-other">Em negociação</span>
              </div>
              <div className="home-stage-event">
                <span className="home-stage-date"><strong>26</strong><small>OUT</small></span>
                <span className="home-stage-event-info"><strong>Show particular</strong><small>São Paulo · 15h</small></span>
                <span className="home-stage-status"><Check size={13}/> Confirmado</span>
              </div>
            </div>
            <div className="home-stage-bottom">
              <div><span className="home-stage-overlap"><Users size={17}/></span><span>Equipe organizada para o próximo show</span></div>
              <span><ArrowUpRight size={17}/></span>
            </div>
          </div>
          <div className="home-floating-note">
            <span><BadgeCheck size={18}/></span>
            <div><strong>Convite aceito!</strong><small>Mais uma participação confirmada</small></div>
          </div>
        </div>
      </section>

      <HomePartnerVenues/>

      <section id="recursos" className="home-resource-section">
        <div className="home-section-heading">
          <span className="home-kicker">TUDO CONECTADO</span>
          <h2>Da primeira conversa <span>até o último acorde.</span></h2>
          <p>Menos informações espalhadas pelo WhatsApp. Mais clareza para músicos, cantores e contratantes.</p>
        </div>
        <div className="home-resource-grid">
          <article className="home-resource-card">
            <span className="home-resource-icon"><CalendarDays size={21}/></span>
            <span className="home-resource-index">01 / AGENDA</span>
            <h3>Seus shows em ordem.</h3>
            <p>Organize datas, locais, horários e as participações que você já confirmou.</p>
          </article>
          <article className="home-resource-card">
            <span className="home-resource-icon"><Wallet size={21}/></span>
            <span className="home-resource-index">02 / NEGOCIAÇÃO</span>
            <h3>Convites e cachês privados.</h3>
            <p>Envie convites individuais e negocie propostas e contrapropostas com privacidade.</p>
          </article>
          <article className="home-resource-card">
            <span className="home-resource-icon"><Users size={21}/></span>
            <span className="home-resource-index">03 / FORMAÇÕES</span>
            <h3>Sua equipe de sempre.</h3>
            <p>Salve músicos em formações reutilizáveis para convidar nos próximos shows.</p>
          </article>
          <article className="home-resource-card">
            <span className="home-resource-icon"><Music2 size={21}/></span>
            <span className="home-resource-index">04 / PORTFÓLIO</span>
            <h3>Seu trabalho merece aparecer.</h3>
            <p>Crie uma página gratuita com instrumentos, trabalhos e o estilo visual que combina com você.</p>
          </article>
          <Link href="/marketplace" className="home-resource-card"
            style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <span className="home-resource-icon"><Search size={21}/></span>
            <span className="home-resource-index">05 / MARKETPLACE · EM BREVE</span>
            <h3>O próximo palco começa aqui.</h3>
            <p>Uma novidade para encontrar músicos, descobrir talentos e conectar oportunidades. Ainda em preparação.</p>
          </Link>
        </div>
      </section>

      <section id="musicos" className="home-musician-section">
        <div className="home-musician-copy">
          <div className="home-pill"><Sparkles size={14}/> NOVIDADE PARA MÚSICOS</div>
          <h2>Uma página com <span>a sua cara.</span></h2>
          <p>Seu talento não cabe numa mensagem de texto. Mostre seus instrumentos, experiências e trabalhos num portfólio que é realmente seu.</p>
          <div className="home-musician-benefits">
            <span><ShieldCheck size={17}/> Cachês de shows negociados em particular</span>
            <span><Palette size={17}/> Temas, cores, capa e foto personalizados</span>
            <span><Guitar size={17}/> Instrumentos e estilos em destaque</span>
          </div>
          <Link href="/meu-portfolio" className="btn btn-primary">Personalizar meu portfólio <ArrowUpRight size={17}/></Link>
          <p className="fine" style={{ marginTop: 15 }}>Página simples e gratuita, sem necessidade de subdomínio.</p>
        </div>
        <div className="home-musician-card">
          <div className="home-musician-cover">
            <div className="home-musician-lines" aria-hidden="true"/>
            <span className="home-musician-label">STAGE FLOW / MÚSICO</span>
            <div className="home-musician-identity">
              <span className="home-musician-avatar">JO</span>
              <div><span>PERCUSSIONISTA · SÃO PAULO</span><strong>João Oliveira</strong><small>Samba, pagode e música ao vivo.</small></div>
            </div>
          </div>
          <div className="home-musician-body">
            <div className="home-musician-chips"><span>Pandeiro</span><span>Tantã</span><span>Repique de mão</span></div>
            <div className="home-musician-bottom"><span>CACHÊ DE REFERÊNCIA<strong>Sob consulta</strong></span><span className="home-musician-play"><CirclePlay size={27}/></span></div>
          </div>
          <span className="home-musician-caption">Prévia ilustrativa · personalize seu próprio perfil</span>
        </div>
      </section>

      <section className="home-closing">
        <div>
          <span className="home-kicker">SEU PRÓXIMO SHOW COMEÇA AQUI</span>
          <h2>Menos burocracia. <span>Mais palco.</span></h2>
          <p>Organize seu próximo projeto musical com quem faz parte dele.</p>
        </div>
        <Link className="btn btn-primary" href="/cadastro">Criar minha conta <ArrowRight size={16}/></Link>
      </section>

      <footer className="footer">
        <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
        <span>Plataforma em desenvolvimento · Marketplace em preparação</span>
        <span>© {new Date().getFullYear()} Stage Flow</span>
      </footer>
    </div>
  </main>;
}

