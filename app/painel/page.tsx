"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Users, Bell, Plus, Clock3, LogOut, Music2, UserRound, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  role: "musician" | "producer";
  display_name: string;
  username: string | null;
  city: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);

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
        .select("id, role, display_name, username, city")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setMessage("Não conseguimos carregar seu perfil. Confira se as consultas SQL do Supabase foram executadas corretamente.");
      } else if (!data) {
        setMessage("Sua conta está autenticada, mas o perfil ainda não apareceu no banco. Saia e entre novamente; se continuar, avise para corrigirmos.");
      } else {
        setProfile(data as Profile);
      }
      setLoading(false);
    }

    loadDashboard();
    return () => { active = false; };
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const roleLabel = profile?.role === "producer" ? "Produtor" : "Músico";

  if (loading) {
    return <main><div className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <p style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 10 }}><LoaderCircle size={18} /> Carregando seu Stage Flow...</p>
    </div></main>;
  }

  return <main><div className="container">
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link className="btn btn-quiet" href="/"><ArrowLeft size={15}/> Site</Link>
        <button className="btn btn-quiet" onClick={handleSignOut} disabled={signingOut}><LogOut size={15}/>{signingOut ? "Saindo..." : "Sair"}</button>
      </div>
    </nav>

    <section style={{ padding: "48px 0 28px" }}>
      <div className="eyebrow"><span className="dot"/> ÁREA DO USUÁRIO · {roleLabel.toUpperCase()}</div>
      <h1 style={{ fontSize: "clamp(34px, 5vw, 46px)", marginBottom: 12 }}>
        Olá, <span className="accent">{profile?.display_name || "bem-vindo(a)"}</span>!
      </h1>
      <p className="lead">Este é seu espaço no Stage Flow. Vamos construir sua agenda e suas ferramentas por aqui.</p>
      <p style={{ color: "var(--muted)", fontSize: 13, overflowWrap: "anywhere" }}>{email}</p>
    </section>

    {message && <div className="coming" role="status">{message}</div>}

    {profile && <div className="stat-row">
      <div className="stat"><UserRound color="#c6f36b"/><strong>{roleLabel}</strong><span>Tipo da sua conta</span></div>
      <div className="stat"><CalendarDays color="#c6f36b"/><strong>Agenda</strong><span>Próxima função a implementar</span></div>
      <div className="stat"><Music2 color="#c6f36b"/><strong>{profile.username ? "@" + profile.username : "Não definido"}</strong><span>Nome de usuário</span></div>
    </div>}

    <section className="section" style={{ paddingTop: 30 }}>
      <div className="section-heading">
        <h2>Seu espaço de trabalho</h2>
        <p>Estamos montando as ferramentas reais. Nesta primeira etapa, o painel já identifica sua conta e carrega seu perfil salvo no Supabase.</p>
      </div>
      <div className="cards">
        <div className="feature">
          <div className="feature-icon"><CalendarDays size={21}/></div>
          <h3>Agenda de shows</h3>
          <p>Em breve você poderá cadastrar apresentações, locais e horários e acompanhar seus próximos compromissos.</p>
        </div>
        <div className="feature">
          <div className="feature-icon"><Users size={21}/></div>
          <h3>{profile?.role === "producer" ? "Artistas e convites" : "Convites para tocar"}</h3>
          <p>{profile?.role === "producer" ? "A próxima etapa permitirá organizar eventos e convidar músicos." : "Aqui você acompanhará convites recebidos de produtores e outros artistas."}</p>
        </div>
        <div className="feature">
          <div className="feature-icon"><Bell size={21}/></div>
          <h3>Notificações</h3>
          <p>Mais adiante, você verá respostas a convites e atualizações importantes da sua agenda.</p>
        </div>
      </div>
      <div className="hero-actions" style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={() => setMessage("A criação de eventos será a próxima funcionalidade que vamos implementar.")}><Plus size={16}/> Novo evento (em desenvolvimento)</button>
        {profile?.role === "musician" && profile.username && <Link className="btn btn-quiet" href={`/artista/${profile.username}`}>Ver meu portfólio</Link>}
        {profile?.role === "musician" && !profile.username && <span className="fine">Seu perfil público será configurado em uma próxima etapa.</span>}
      </div>
    </section>
    <div className="coming">Esta versão já lê sua sessão e seu perfil real. A agenda, os convites e as notificações ainda serão implementados; os botões dessas funções não criam eventos neste momento.</div>
  </div></main>;
}
