import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Crown, LockKeyhole, Mic2, ShieldCheck } from "lucide-react";

const free = [
  "Cadastro gratuito de cantor, músico e produtor",
  "Perfil artístico básico com @ personalizado",
  "Portfólio gratuito de músico e marketplace",
  "Agenda de shows, equipes e convites",
  "Negociação, chat interno e contratação",
  "Controle financeiro básico por show, histórico, operação e notificações"
];
const professional = [
  "Todos os recursos gratuitos",
  "Relatórios financeiros avançados do cantor e exportação detalhada",
  "Site profissional exclusivo do cantor",
  "Temas, cores e layouts especiais para portfólio artístico",
  "Galeria profissional, vídeos e destaques de portfólio",
  "Publicação Pro com autorização da conta",
  "Subdomínio personalizado incluído no plano quando disponível"
];
export default function PlanosPage() {
  return <main className="container" style={{paddingBottom:80}}>
    <nav className="nav" style={{paddingTop:22}}>
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/"><ArrowLeft size={16}/> Voltar</Link>
    </nav>
    <section style={{maxWidth:850,margin:"65px auto 30px",textAlign:"center"}}>
      <span className="eyebrow"><Crown size={15}/> PLANOS DO CANTOR</span>
      <h1 style={{fontSize:"clamp(32px,5vw,52px)",margin:"16px 0"}}>Sua música cresce. <span className="accent">Sua gestão é grátis.</span></h1>
      <p className="lead">Músicos podem entrar sem convite. Cantores e produtores também usam gratuitamente as ferramentas de shows, contratação e organização. Relatórios financeiros avançados e recursos especiais do portfólio de cantores fazem parte dos planos pagos; registrar receitas e despesas continua gratuito.</p>
    </section>
    <section aria-label="Comparação entre Gratuito e Pro" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,310px),1fr))",gap:20,maxWidth:980,margin:"0 auto"}}>
      <article className="feature" style={{padding:28}}>
        <span className="eyebrow"><Check size={15}/> ACESSO GRATUITO</span>
        <h2 style={{margin:"16px 0 8px"}}>Gratuito</h2>
        <p style={{fontSize:25,fontWeight:800,margin:"0 0 18px"}}>R$ 0</p>
        <p>Para músicos, cantores e produtores. Não exige convite ou assinatura.</p>
        <ul style={{listStyle:"none",padding:0,display:"grid",gap:12,margin:"22px 0"}}>
          {free.map(item=><li key={item} style={{display:"flex",alignItems:"flex-start",gap:9}}><Check size={18} style={{flexShrink:0,color:"var(--accent-solid)"}}/>{item}</li>)}
        </ul>
        <Link className="btn btn-primary" href="/cadastro" style={{width:"100%",justifyContent:"center"}}>Criar conta gratuita <ArrowRight size={16}/></Link>
      </article>
      <article className="feature" style={{padding:28,borderColor:"var(--accent-solid)"}}>
        <span className="eyebrow"><LockKeyhole size={15}/> EXCLUSIVO PARA CANTORES</span>
        <h2 style={{margin:"16px 0 8px"}}>Cantor Pro <Crown size={22} style={{display:"inline",verticalAlign:"middle"}}/></h2>
        <p style={{fontSize:20,fontWeight:750,margin:"0 0 18px"}}>Valores a definir</p>
        <p>Relatórios e recursos profissionais opcionais, agrupados no plano pago. O subdomínio não será cobrado separadamente.</p>
        <ul style={{listStyle:"none",padding:0,display:"grid",gap:12,margin:"22px 0"}}>
          {professional.map(item=><li key={item} style={{display:"flex",alignItems:"flex-start",gap:9}}><LockKeyhole size={17} style={{flexShrink:0,color:"var(--accent-solid)"}}/>{item}</li>)}
        </ul>
        <Link className="btn btn-quiet" href="/meu-perfil-artistico/site-profissional" style={{width:"100%",justifyContent:"center"}}>Conhecer a prévia Pro <ArrowRight size={16}/></Link>
        <p style={{fontSize:12,marginTop:15}}>A prévia exige uma conta de cantor. Não há checkout, assinatura automática nem provisionamento de subdomínio nesta fase.</p>
      </article>
    </section>
    <section className="feature" style={{maxWidth:980,margin:"24px auto",padding:22}}>
      <p style={{display:"flex",gap:9,alignItems:"center",margin:0}}><ShieldCheck size={20}/> <strong>Sem surpresas:</strong> o plano gratuito continua funcionando mesmo se o cantor não contratar o Pro. Publicação profissional depende de autorização no servidor; o cadeado visual não substitui o controle de acesso.</p>
    </section>
  </main>;
}
