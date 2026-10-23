import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Images, ShieldCheck, FlaskConical } from "lucide-react";

export const metadata={title:"Stage Flow — Ambiente de testes"};

export default function HomologacaoPage(){
  if(process.env.NEXT_PUBLIC_STAGE_FLOW_ENV!=="homologation")notFound();
  const boxes=[
    {title:"Deck Espeto Bar",description:"Veja a página pública fictícia da casa: agenda, destaques, flyers, galeria e sugestão de atrações.",href:"/casa/deck-espetobar-qa",icon:CalendarDays},
    {title:"Casa B de testes",description:"Confira uma segunda casa e verifique se os shows dela aparecem somente na própria programação.",href:"/casa/casa-b-qa",icon:Images},
    {title:"Área do responsável",description:"Entre com uma conta criada neste ambiente de testes. O acesso à administração da casa exige autorização separada.",href:"/parceiros",icon:ShieldCheck}
  ];
  return <main className="container" style={{minHeight:"100vh",paddingBottom:72}}>
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/">Ir ao início <ArrowRight size={15}/></Link>
    </nav>
    <section style={{padding:"58px 0 28px",maxWidth:780}}>
      <div className="eyebrow"><FlaskConical size={16}/> AMBIENTE DE HOMOLOGAÇÃO</div>
      <h1 style={{fontSize:"clamp(32px,6vw,55px)",letterSpacing:"-.05em",lineHeight:1.1,margin:"20px 0"}}>Teste o Stage Flow <span className="accent">sem riscos.</span></h1>
      <p className="lead">Este é um site de testes conectado a um banco separado. Casas, shows e mensagens apresentados nesta área são fictícios. Nada daqui altera o Stage Flow oficial.</p>
    </section>
    <section aria-label="Páginas para experimentar" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:15}}>
      {boxes.map(x=><Link href={x.href} key={x.href} style={{display:"flex",flexDirection:"column",gap:14,padding:24,border:"1px solid var(--line)",borderRadius:18,background:"var(--panel)",color:"inherit",textDecoration:"none"}}>
        <x.icon size={26} color="#b79af5"/>
        <h2 style={{fontSize:19,margin:0}}>{x.title}</h2>
        <p style={{color:"var(--muted)",fontSize:13,lineHeight:1.6,flex:1}}>{x.description}</p>
        <span style={{display:"flex",gap:8,alignItems:"center",color:"#cab6f1",fontWeight:750,fontSize:13}}>Abrir <ArrowRight size={15}/></span>
      </Link>)}
    </section>
    <p style={{color:"var(--muted)",fontSize:12,lineHeight:1.7,maxWidth:750,marginTop:28}}>O módulo público da casa está pronto para testes. Algumas ferramentas de músicos, contratação e marketplace ainda dependem de outras migrações neste banco de homologação. Para testar cadastros e edição com diferentes níveis de acesso, serão necessárias contas de teste.</p>
  </main>;
}
