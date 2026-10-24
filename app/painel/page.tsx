"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, Check, Guitar, Building2,
  LoaderCircle, LogOut, Mic2, Music2, Settings2,
  UserRound, Users, Inbox, Search, ChartNoAxesCombined, Globe2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ArtistKind = "lead" | "support";
type Profile = {
  id: string;
  role: "musician" | "producer";
  is_artist: boolean;
  is_producer: boolean;
  artist_kind?: ArtistKind | null;
  display_name: string;
  username: string | null;
  city: string | null;
  is_public: boolean;
};

type Shortcut = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  label?: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [changingKind, setChangingKind] = useState(false);
  const [partnerHouseCount, setPartnerHouseCount] = useState(0);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadDashboard() {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, is_artist, is_producer, display_name, username, city, is_public")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setMessageError(true);
        setMessage("Não conseguimos carregar seu perfil. Confira se as migrações do Supabase foram executadas.");
      } else if (!data) {
        setMessageError(true);
        setMessage("Sua conta está autenticada, mas o perfil não foi encontrado. Saia e entre novamente; se continuar, avise para corrigirmos.");
      } else {
        // A consulta separada não interrompe o painel enquanto a nova
        // migração ainda não tiver sido executada pelo administrador.
        let kind: ArtistKind | null = data.is_artist
          ? (data.username ? "lead" : "support") : null;
        if (data.is_artist) {
          const { data: experience } = await supabase
            .from("profiles")
            .select("artist_kind")
            .eq("id", user.id)
            .maybeSingle();
          if (!active) return;
          if (experience?.artist_kind === "lead" || experience?.artist_kind === "support") {
            kind = experience.artist_kind;
          }
        }
        setProfile({ ...data, artist_kind: kind } as Profile);
        // O portal de parceiros e opcional e nao interfere no painel atual.
        const {data: partnerData}=await supabase.rpc("stage_venue_partner_access");
        if (!active) return;
        const available=partnerData as {status?:string;items?:unknown[]} | null;
        if (available?.status==="ok") setPartnerHouseCount(available.items?.length||0);
      }
      setLoading(false);
    }

    void loadDashboard();
    return () => { active = false; };
  }, [router]);

  async function changeExperience(kind: ArtistKind) {
    if (!profile?.is_artist || changingKind || profile.artist_kind === kind) return;
    setChangingKind(true);
    setMessage("");
    setMessageError(false);

    const { data, error } = await createClient().rpc(
      "stage_choose_artist_experience", { p_kind: kind }
    );
    if (error || data !== "saved") {
      setMessageError(true);
      setMessage(error?.message
        ? "Não foi possível trocar de visualização. Execute artist_account_experience_migration.sql no Supabase. " + error.message
        : "Não foi possível mudar a experiência. Confira suas permissões.");
    } else {
      setProfile(previous => previous ? { ...previous, artist_kind: kind } : null);
      setMessage("Seu painel agora prioriza as ferramentas de " +
        (kind === "lead" ? "cantor/artista principal." : "músico de apoio.") +
        " Seus dados e permissões foram preservados.");
    }
    setChangingKind(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) return <main><div className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
    <p style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 10 }}>
      <LoaderCircle size={18}/> Carregando seu Stage Flow...
    </p>
  </div></main>;

  const kind: ArtistKind = profile?.artist_kind === "support" ? "support" : "lead";
  const isSupport = profile?.is_artist && kind === "support";
  const isLead = profile?.is_artist && kind === "lead";
  const roleLabel = !profile ? "Conta"
    : isSupport ? "Músico de apoio" + (profile.is_producer ? " + Produtor" : "")
    : isLead ? "Cantor / artista" + (profile.is_producer ? " + Produtor" : "")
    : "Produtor / contratante";

  let primary: Shortcut[];
  if (isSupport) {
    primary = [
      {
        href: "/meus-convites", title: "Meus convites", icon: Bell,
        description: "Receba oportunidades, confirme participações e negocie seu cachê em particular.",
        label: "COMECE AQUI"
      },
      {
        href: "/meu-portfolio", title: "Meu portfólio de músico", icon: Guitar,
        description: "Divulgue instrumentos, trabalhos, cidade e escolha entre mostrar cachê ou sob consulta."
      },
      {
        href: "/meu-desempenho", title: "Meu desempenho", icon: ChartNoAxesCombined,
        description: "Acompanhe visitas ao portfólio, visibilidade no marketplace e convites recebidos."
      },
      {
        href: "/eventos", title: "Minha agenda", icon: CalendarDays,
        description: "Veja seus shows e as participações que já estão confirmadas."
      }
    ];
  } else if (isLead) {
    primary = [
      {
        href: "/eventos", title: "Minha agenda de shows", icon: CalendarDays,
        description: "Cadastre shows, locais e horários e escolha quais eventos serão públicos.",
        label: "COMECE AQUI"
      },
      {
        href: "/meu-perfil-artistico", title: "Minha página de cantor", icon: Mic2,
        description: "Divulgue sua carreira no endereço gratuito com seu @ artístico."
      },
      {
        href: "/meu-perfil-artistico/site-profissional", title: "Meu site Pro", icon: Globe2,
        description: "Personalize a galeria e a agenda e publique seu site Pro se sua conta estiver habilitada."
      },
      {
        href: "/meu-perfil-artistico/solicitacoes", title: "Pedidos de contratação", icon: Inbox,
        description: "Leia as solicitações recebidas pela página pública e responda aos interessados."
      },
      {
        href: "/convites", title: "Convidar músicos", icon: Users,
        description: "Envie propostas individuais e acompanhe respostas e negociações."
      },
      {
        href: "/equipes", title: "Minhas equipes", icon: Music2,
        description: "Salve formações para reutilizar nos próximos shows."
      }
    ];
  } else {
    primary = [
      {
        href: "/eventos", title: "Meus eventos", icon: CalendarDays,
        description: "Organize os shows que você produz ou contrata.", label: "COMECE AQUI"
      },
      {
        href: "/convites", title: "Convidar músicos", icon: Users,
        description: "Acompanhe respostas e negocie valores individuais de contratação."
      },
      {
        href: "/equipes", title: "Formações de músicos", icon: Music2,
        description: "Crie equipes recorrentes e reutilize-as em novos eventos."
      }
    ];
  }

  primary.splice(0,0,{
    href: "/conversas", title: "Conversas e contratações", icon: Inbox,
    description: "Converse com músicos ou contratantes, consulte disponibilidade e acompanhe propostas.",
    label: "CHAT INTERNO"
  });
  primary.splice(2,0,{
    href: "/financeiro", title: "Central financeira", icon: ChartNoAxesCombined,
    description: "Receitas brutas, cachês, transporte, despesas, valores pagos e relatório por show e por mês.",
    label: "CONTROLE OPCIONAL"
  });
  primary.splice(1,0,{
    href: "/meus-shows", title: "Meus shows e histórico", icon: CalendarDays,
    description: "Reveja apresentações realizadas, confirme participações e acompanhe seus relatórios financeiros opcionais.",
    label: "HISTÓRICO E FINANCEIRO"
  });
  if (partnerHouseCount > 0) primary.unshift({
    href: "/parceiros", title: "Minhas casas parceiras", icon: Building2,
    description: "Gerencie shows, flyers, fotos e sugestões das casas autorizadas para você.",
    label: "ACESSO DA CASA"
  });
  const secondary: Shortcut[] = [];
  if (isSupport) {
    secondary.push(
      { href: "/convites", title: "Convidar músicos para um show", description: "Se também organizar uma apresentação.", icon: Users },
      { href: "/equipes", title: "Gerenciar minhas formações", description: "Se quiser criar sua própria equipe.", icon: Music2 },
      { href: "/meu-perfil-artistico/solicitacoes", title: "Pedidos de contratação", description: "Veja contatos enviados pela sua página pública de artista.", icon: Inbox }
    );
  }
  if (isLead) {
    secondary.push(
      { href: "/meus-convites", title: "Convites para tocar", description: "Cantores também podem participar de outros shows.", icon: Bell },
      { href: "/meu-portfolio", title: "Portfólio simples de músico", description: "Use também sua vitrine de instrumentista.", icon: Guitar },
      { href: "/meu-desempenho", title: "Desempenho do portfólio de músico", description: "Visitas e oportunidades do seu perfil gratuito de instrumentista.", icon: ChartNoAxesCombined },
      { href: "/meu-perfil-artistico/site-profissional", title: "Editor e publicação Pro", description: "Prepare a versão profissional; publicar exige direito Pro habilitado.", icon: Globe2 }
    );
  }
  secondary.push({
    href: "/marketplace", title: "Marketplace de músicos · Em breve",
    description: "Conheça o próximo espaço para descobrir talentos. O catálogo ainda não foi lançado.",
    icon: Search
  });
  if (profile?.is_artist && profile.username && profile.is_public) {
    secondary.push({
      href: "/" + profile.username, title: "Abrir minha página @" + profile.username,
      description: "Veja o seu perfil gratuito como o público vê.", icon: UserRound
    });
  }

  return <main><div className="container" style={{ paddingBottom: 60 }}>
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link className="btn btn-quiet" href="/"><ArrowLeft size={15}/> Site</Link>
        <button className="btn btn-quiet" onClick={() => void handleSignOut()} disabled={signingOut}>
          <LogOut size={15}/>{signingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </nav>

    <section style={{ padding: "48px 0 26px" }}>
      <div className="eyebrow"><span className="dot"/> PAINEL STAGE FLOW · {roleLabel.toUpperCase()}</div>
      <h1 style={{ fontSize: "clamp(33px, 5vw, 47px)", marginBottom: 12 }}>
        Olá, <span className="accent">{profile?.display_name || "bem-vindo(a)"}</span>!
      </h1>
      <p className="lead" style={{ maxWidth: 690 }}>
        {isSupport
          ? "Seu espaço para receber convites, acertar cachês e mostrar seu trabalho aos contratantes."
          : isLead
            ? "Seus shows, sua equipe e sua presença artística, tudo no mesmo lugar."
            : "Organize eventos, monte equipes e acompanhe os músicos contratados."}
      </p>
      <p style={{ color: "var(--muted)", fontSize: 12, overflowWrap: "anywhere" }}>{email}</p>
    </section>

    {message && <div className="coming" role={messageError ? "alert" : "status"}
      style={messageError ? { borderColor: "#754343", background: "#281919", color: "#ffb5b5" } : {}}>
      {message}
    </div>}

    {profile?.is_artist && <section className="dashboard-experience" aria-label="Escolha como usar o Stage Flow">
      <div>
        <span className="dashboard-experience-eyebrow"><Settings2 size={15}/> MINHA ATIVIDADE PRINCIPAL</span>
        <p>Escolha quais ferramentas aparecem primeiro. Pode mudar quando quiser, sem perder dados.</p>
      </div>
      <div className="dashboard-experience-actions">
        <button type="button" className="dashboard-experience-choice" aria-pressed={kind === "lead"}
          disabled={changingKind} onClick={() => void changeExperience("lead")}>
          <Mic2 size={17}/> Cantor / artista {kind === "lead" && <Check size={15}/>}
        </button>
        <button type="button" className="dashboard-experience-choice" aria-pressed={kind === "support"}
          disabled={changingKind} onClick={() => void changeExperience("support")}>
          <Guitar size={17}/> Músico de apoio {kind === "support" && <Check size={15}/>}
        </button>
      </div>
    </section>}

    <section className="section" style={{ paddingTop: 34 }}>
      <div className="section-heading">
        <h2>{isSupport ? "Seu trabalho musical" : isLead ? "Sua carreira, organizada" : "Gestão de eventos"}</h2>
        <p>{isSupport ? "Tudo o que você precisa para tocar em novos shows." :
          isLead ? "Acesse as ferramentas essenciais para cuidar das suas apresentações." :
          "Suas principais ferramentas de produção em um só lugar."}</p>
      </div>
      <div className="dashboard-shortcuts">
        {primary.map(item => {
          const Icon = item.icon;
          return <Link className="dashboard-shortcut" href={item.href} key={item.href}>
            <div className="dashboard-shortcut-top">
              <span className="dashboard-shortcut-icon"><Icon size={22}/></span>
              {item.label && <span className="dashboard-shortcut-tag">{item.label}</span>}
              <ArrowRight size={16} className="dashboard-shortcut-arrow"/>
            </div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </Link>;
        })}
      </div>
    </section>

    {secondary.length > 0 && <section style={{ paddingTop: 14 }}>
      <h2 className="dashboard-secondary-title">Outras ferramentas</h2>
      <div className="dashboard-secondary-grid">
        {secondary.map(item => {
          const Icon = item.icon;
          return <Link className="dashboard-secondary-link" href={item.href} key={item.href}>
            <Icon size={17}/><span><strong>{item.title}</strong><small>{item.description}</small></span>
            <ArrowRight size={15}/>
          </Link>;
        })}
      </div>
    </section>}

    {profile && <p className="fine" style={{ marginTop: 35, lineHeight: 1.7 }}>
      As preferências de visualização não alteram seus papéis, cachês ou assinatura.
      Marketplace e subdomínios personalizados continuam em desenvolvimento.
    </p>}
  </div></main>;
}
