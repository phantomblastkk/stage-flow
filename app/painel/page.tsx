import Link from "next/link";
import { ArrowLeft, CalendarDays, Users, Bell, Plus, Clock3 } from "lucide-react";

export default function DashboardPreview() {
  return <main><div className="container">
    <nav className="nav"><Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link><Link className="btn btn-quiet" href="/"><ArrowLeft size={15}/> Voltar ao site</Link></nav>
    <section style={{padding:"50px 0 30px"}}>
      <div className="eyebrow"><span className="dot"/> PRÉVIA DO APLICATIVO</div>
      <h1 style={{fontSize:46,marginBottom:12}}>Seu painel <span className="accent">musical.</span></h1>
      <p className="lead">Um exemplo da área de trabalho que vamos tornar funcional com login e dados reais.</p>
      <div className="hero-actions"><button className="btn btn-primary" onClick={undefined}><Plus size={16}/> Novo evento (em breve)</button><Link className="btn btn-quiet" href="/artista/cantorsousa">Ver portfólio de exemplo</Link></div>
    </section>
    <div className="stat-row"><div className="stat"><CalendarDays color="#c6f36b"/><strong>08</strong><span>Eventos no mês</span></div><div className="stat"><Users color="#c6f36b"/><strong>03</strong><span>Convites pendentes</span></div><div className="stat"><Bell color="#c6f36b"/><strong>02</strong><span>Notificações novas</span></div></div>
    <section className="section"><div className="section-heading"><h2>Próximos eventos</h2><p>Quando conectarmos o Supabase, esta lista mostrará a agenda da conta autenticada.</p></div><div className="feature">
      <div className="event"><div className="event-date"><div><strong>18</strong><br/><span>OUT</span></div></div><div className="event-info"><strong>Pagode na Praça</strong><span><Clock3 size={12} style={{display:"inline",verticalAlign:"middle"}}/> 20h · São Paulo</span></div><span className="event-pill">Confirmado</span></div>
      <div className="event"><div className="event-date"><div><strong>22</strong><br/><span>OUT</span></div></div><div className="event-info"><strong>Festival de Música</strong><span><Clock3 size={12} style={{display:"inline",verticalAlign:"middle"}}/> 18h · Guarulhos</span></div><span className="event-pill">Convite pendente</span></div>
      <div className="event"><div className="event-date"><div><strong>26</strong><br/><span>OUT</span></div></div><div className="event-info"><strong>Evento particular</strong><span><Clock3 size={12} style={{display:"inline",verticalAlign:"middle"}}/> 15h · São Paulo</span></div><span className="event-pill">Confirmado</span></div>
    </div></section>
    <div className="coming">Importante: este painel é apenas visual. Ainda não autentica usuários nem cria, altera ou salva eventos. O próximo passo técnico é conectar a autenticação e o banco de dados.</div>
  </div></main>;
}
