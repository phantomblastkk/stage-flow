import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Crown, LockKeyhole, Mic2, ShieldCheck } from "lucide-react";

import "@/src/components/ui/tokens.css";
import "@/src/domains/billing/components/subscription-ui.css";

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
  "Perfil Artístico exclusivo do cantor",
  "Temas, cores e layouts especiais para portfólio artístico",
  "Galeria profissional, vídeos e destaques de portfólio",
  "Publicação Pro com autorização da conta",
  "Subdomínio personalizado incluído no plano quando disponível"
];
export default function PlanosPage() {
  return <main className="container plans-page plans-spacing" >
    <nav className="nav plans-nav" >
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="sf-ui-button sf-ui-button-ghost" href="/"><ArrowLeft size={16}/> Voltar</Link>
    </nav>
    <section className="plans-hero">
      <span className="eyebrow"><Crown size={15}/> PLANOS DO CANTOR</span>
      <h1 className="plans-title">Sua música cresce. <span className="accent">Sua gestão é grátis.</span></h1>
      <p className="lead">Músicos podem entrar sem convite. Cantores e produtores também usam gratuitamente as ferramentas de shows, contratação e organização. Relatórios financeiros avançados e recursos especiais do portfólio de cantores fazem parte dos planos pagos; registrar receitas e despesas continua gratuito.</p>
    </section>
    <section aria-label="Comparação entre Gratuito e Pro" className="plans-comparison">
      <article className="sf-ui-card plans-card" >
        <span className="eyebrow"><Check size={15}/> ACESSO GRATUITO</span>
        <h2 className="plans-card-title">Gratuito</h2>
        <p className="plans-free-price">R$ 0</p>
        <p>Para músicos, cantores e produtores. Não exige convite ou assinatura.</p>
        <ul className="plans-features">
          {free.map(item=><li key={item} className="plans-feature"><Check size={18} className="plans-icon"/>{item}</li>)}
        </ul>
        <Link className="sf-ui-button sf-ui-button-primary plans-action" href="/cadastro" >Criar conta gratuita <ArrowRight size={16}/></Link>
      </article>
      <article className="sf-ui-card plans-pro-card" >
        <span className="eyebrow"><LockKeyhole size={15}/> EXCLUSIVO PARA CANTORES</span>
        <h2 className="plans-card-title">Cantor Pro <Crown size={22} className="plans-inline-icon"/></h2>
        <p className="plans-pro-price">Valores a definir</p>
        <p>Relatórios e recursos profissionais opcionais, agrupados no plano pago. O subdomínio não será cobrado separadamente.</p>
        <ul className="plans-features">
          {professional.map(item=><li key={item} className="plans-feature"><LockKeyhole size={17} className="plans-icon"/>{item}</li>)}
        </ul>
        <Link className="sf-ui-button sf-ui-button-ghost plans-action" href="/assinatura" >Consultar acesso Pro <ArrowRight size={16}/></Link>
        <p className="plans-hint">A prévia exige uma conta de cantor. Não há checkout, assinatura automática nem provisionamento de subdomínio nesta fase.</p>
      </article>
    </section>
    <section className="sf-ui-card plans-footer" >
      <p className="plans-footer-content"><ShieldCheck size={20}/> <strong>Sem surpresas:</strong> o plano gratuito continua funcionando mesmo se o cantor não contratar o Pro. Publicação profissional depende de autorização no servidor; o cadeado visual não substitui o controle de acesso.</p>
    </section>
  </main>;
}
