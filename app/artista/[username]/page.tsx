import Link from "next/link";
import { Instagram, Music2, Play, CalendarDays, MapPin, MessageCircle, ArrowLeft, ExternalLink } from "lucide-react";

type Props = { params: Promise<{ username: string }> };

export default async function ArtistPage({ params }: Props) {
  const { username } = await params;
  const normalized = username.toLowerCase();
  const isSousa = normalized === "cantorsousa";
  const name = isSousa ? "Cantor Sousa" : username.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <main>
      <div className="container">
        <nav className="nav">
          <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
          <Link className="btn btn-quiet" href="/"><ArrowLeft size={15}/> Conhecer o Stage Flow</Link>
        </nav>
        <section style={{maxWidth:820,margin:"48px auto 70px"}}>
          <div style={{height:210,borderRadius:22,background:"radial-gradient(ellipse at 20% 20%,#5d603b,transparent 55%),linear-gradient(120deg,#282c3b,#12151d)",border:"1px solid #303747",display:"grid",placeItems:"center",overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,#090b10cc,transparent 75%)"}}/>
            <div style={{position:"relative",textAlign:"center",padding:20}}><div className="eyebrow"><span className="dot"/> PERFIL DO ARTISTA</div><h1 style={{fontSize:42,margin:"18px 0 4px",letterSpacing:"-1.5px"}}>{name}</h1><p style={{color:"#d4d8e2",margin:0}}>Samba · Pagode · Música ao vivo</p></div>
          </div>
          <div className="profile-demo" style={{marginTop:16}}>
            <div className="avatar">{name.split(" ").map((s)=>s[0]).slice(0,2).join("")}</div>
            <div className="profile-copy"><h3>{name}</h3><p><MapPin size={13} style={{display:"inline",verticalAlign:"middle"}}/> São Paulo, SP · Cantor e intérprete</p><div className="profile-url">{normalized}.stageflow.com <span style={{color:"#98a3b6"}}>· endereço ilustrativo</span></div></div>
            <div style={{display:"flex",gap:10}}><a aria-label="Instagram (demonstração)" className="btn btn-quiet" href="#contato"><Instagram size={17}/></a><a aria-label="Vídeos (demonstração)" className="btn btn-quiet" href="#videos"><Play size={17}/></a></div>
          </div>
          <section className="section" style={{paddingBottom:25}}>
            <div className="section-heading"><h2>Sobre o artista</h2><p>Um espaço para contar sua história, apresentar seu estilo musical e mostrar aos contratantes o que torna seu trabalho especial. Esta página é uma prévia visual; o conteúdo será editável pelo artista quando o cadastro real estiver conectado.</p></div>
            <div className="cards">
              <article className="feature"><div className="feature-icon"><CalendarDays/></div><h3>Agenda de shows</h3><p>Datas públicas, horários e locais divulgados pelo artista.</p></article>
              <article className="feature" id="videos"><div className="feature-icon"><Play/></div><h3>Vídeos e músicas</h3><p>Espaço preparado para incorporar vídeos e links de plataformas musicais.</p></article>
              <article className="feature"><div className="feature-icon"><Music2/></div><h3>Repertório</h3><p>Estilos musicais, repertório e informações para produtores.</p></article>
            </div>
          </section>
          <section className="feature" style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:15}}><h2 style={{font:"800 24px Manrope",margin:0}}>Próximos shows</h2><span className="status">AGENDA PÚBLICA</span></div>
            <div className="event"><div className="event-date"><div><strong>07</strong><br/><span>NOV</span></div></div><div className="event-info"><strong>Show de samba e pagode</strong><span>São Paulo · 20h</span></div><span className="event-pill">Exemplo</span></div>
            <div className="event"><div className="event-date"><div><strong>15</strong><br/><span>NOV</span></div></div><div className="event-info"><strong>Evento particular</strong><span>Local a confirmar · 16h</span></div><span className="event-pill">Exemplo</span></div>
            <p className="fine" style={{margin:"14px 0 0"}}>Datas fictícias para demonstração. Nenhum evento real está publicado.</p>
          </section>
          <section className="cta" id="contato" style={{marginTop:20}}><div><h2>Quer contratar {name}?</h2><p>Os contatos profissionais e o botão de WhatsApp poderão ser configurados pelo artista.</p></div><a className="btn btn-primary" href="mailto:contato@stageflow.com">Contato profissional <MessageCircle size={16}/></a></section>
          <p className="fine" style={{textAlign:"center"}}><ExternalLink size={12} style={{display:"inline",verticalAlign:"middle"}}/> Perfil demonstrativo do Stage Flow. O subdomínio real depende da configuração do domínio e do deploy.</p>
        </section>
      </div>
    </main>
  );
}
