"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Bell, CalendarDays, Check, Guitar, Building2,
  LoaderCircle, Mic2, Music2, Settings2,
  UserRound, Users, Inbox, Search, ChartNoAxesCombined, Globe2, ShieldCheck
} from "lucide-react";
import WorkspaceSidebar from "@/src/domains/navigation/components/workspace-sidebar";
import WorkspaceOverview from "@/src/domains/dashboard/components/workspace-overview";
import {LayoutDashboard} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NotificationBell from "@/components/notification-bell";
import DashboardAccountMenu from "@/components/dashboard-account-menu";
import "./painel-account-actions.css";

type ArtistKind = "lead" | "support";
type Profile = {
  id: string;
  role: "musician" | "producer";
  is_artist: boolean;
  is_producer: boolean;
  is_singer: boolean;
  is_musician: boolean;
  artist_kind?: ArtistKind | null;
  display_name: string;
  username: string | null;
  city: string | null;
  is_public: boolean;
  artist_avatar_path?:string|null;
};

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [singerPhoto,setSingerPhoto]=useState<string|null>(null);
  const [musicianPhoto,setMusicianPhoto]=useState<string|null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [changingKind, setChangingKind] = useState(false);
  const [partnerHouseCount, setPartnerHouseCount] = useState(0);
  const [isOwnerAdmin, setIsOwnerAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadDashboard() {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError) {
        // A transient validation/network error must not be mistaken for sign-out.
        // Never sign out or discard an existing local session here.
        const {data:{session}}=await supabase.auth.getSession();
        if (!active) return;
        if (session) {
          setMessageError(true);
          setMessage("Não foi possível validar a sessão agora. Sua conta não foi desconectada. Confira a conexão e atualize a página.");
          setLoading(false);
          return;
        }
        router.replace("/login");
        return;
      }
      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, is_artist, is_producer, is_singer, is_musician, display_name, username, city, is_public, artist_avatar_path")
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
        // Publicly uploaded artist photo. Initials are only a fallback.
        const singerPath=data.artist_avatar_path;
        if(data.is_singer&&singerPath&&
          new RegExp("^"+user.id+"/[0-9a-f-]{36}\\.(jpg|png|webp)$","i").test(singerPath)){
          setSingerPhoto(supabase.storage.from("stage-artist-public")
            .getPublicUrl(singerPath).data.publicUrl);
        }else setSingerPhoto(null);
        if(data.is_musician){
          // The private owner-only RPC returns the public avatar the musician
          // explicitly uploaded in the portfolio editor.
          const {data:portfolioData}=await supabase.rpc("stage_my_musician_portfolio");
          if(!active)return;
          const url=(portfolioData as {avatar_url?:string|null}|null)?.avatar_url;
          const safePrefix=new URL(supabase.storage.from("stage-musician-media")
            .getPublicUrl(user.id+"/placeholder.png").data.publicUrl);
          try{
            const candidate=url?new URL(url):null;
            setMusicianPhoto(candidate&&candidate.protocol==="https:"&&
              candidate.origin===safePrefix.origin&&
              candidate.pathname.startsWith(safePrefix.pathname.replace("placeholder.png",""))?
                candidate.href:null);
          }catch{setMusicianPhoto(null);}
        }else setMusicianPhoto(null);
        // O portal de parceiros e opcional e nao interfere no painel atual.
        const {data: partnerData}=await supabase.rpc("stage_venue_partner_access");
        if (!active) return;
        const available=partnerData as {status?:string;items?:unknown[]} | null;
        if (available?.status==="ok") setPartnerHouseCount(available.items?.length||0);
        // Optional navigation only; every privileged action is independently
        // authorized by its own RPC in the database.
        const {data: ownerAccess,error:ownerAccessError}=await supabase.rpc("stage_owner_admin_status");
        if (!active) return;
        setIsOwnerAdmin(!ownerAccessError&&ownerAccess===true);
      }
      setLoading(false);
    }

    void loadDashboard();
    return () => { active = false; };
  }, [router]);

  async function changeExperience(kind: ArtistKind) {
    if (!profile?.is_artist || changingKind || profile.artist_kind === kind) return;
    if ((kind==="lead"&&!profile.is_singer)||(kind==="support"&&!profile.is_musician)) {
      router.push("/minha-conta");return;
    }
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

  const kind: ArtistKind = profile?.is_singer && !profile?.is_musician ? "lead"
    : profile?.is_musician && !profile?.is_singer ? "support"
    : profile?.artist_kind === "support" ? "support" : "lead";
  const isSupport = Boolean(profile?.is_musician && kind === "support");
  const isLead = Boolean(profile?.is_singer && kind === "lead");
  const accountPhoto=isSupport?(musicianPhoto||singerPhoto):(singerPhoto||musicianPhoto);
  const roleLabel = !profile ? "Conta"
    : isSupport ? "Músico de apoio" + (profile.is_producer ? " + Produtor" : "")
    : isLead ? "Cantor / artista" + (profile.is_producer ? " + Produtor" : "")
    : "Produtor / contratante";

  return <main className="sf-workspace">
    <WorkspaceSidebar role={{
      isSinger:Boolean(profile?.is_singer),
      isMusician:Boolean(profile?.is_musician),
      isProducer:Boolean(profile?.is_producer),
      isOwnerAdmin,
      partnerHouseCount
    }}/>
    <div className="sf-workspace-main">
      <header className="sf-workspace-topbar">
        <div className="sf-workspace-breadcrumb"><LayoutDashboard size={18}/>
          <span>Início / Visão geral</span>
        </div>
        <div className="sf-workspace-top-actions">
          <NotificationBell/>
          <DashboardAccountMenu displayName={profile?.display_name||""}
            avatarUrl={accountPhoto}
            isSinger={Boolean(profile?.is_singer)}
            isMusician={Boolean(profile?.is_musician)}
            isOwnerAdmin={isOwnerAdmin}
            signingOut={signingOut}
            onSignOut={()=>void handleSignOut()}/>
        </div>
      </header>
      <section className="sf-workspace-welcome">
        <span className="eyebrow"><span className="dot"/> SEU STAGEFLOW · {roleLabel.toUpperCase()}</span>
        <h1>Olá, <span>{profile?.display_name||"bem-vindo(a)"}</span>!</h1>
        <p>O que merece sua atenção hoje? Suas tarefas, shows e oportunidades em um só lugar.</p>
        {email&&<p className="sf-workspace-private-email">Conta: {email}</p>}
      </section>

      {message&&<div role={messageError?"alert":"status"}
        className={messageError?"sf-workspace-error":"sf-workspace-feedback"}>{message}</div>}

      {profile?.is_singer&&profile.is_musician&&
        <section className="sf-workspace-role" aria-label="Sua função em destaque">
          <span><Settings2 size={15}/> Minha experiência:</span>
          <button type="button" aria-pressed={kind==="lead"}
            disabled={changingKind} onClick={()=>void changeExperience("lead")}>
            <Mic2 size={16}/> Cantor {kind==="lead"&&<Check size={15}/>}
          </button>
          <button type="button" aria-pressed={kind==="support"}
            disabled={changingKind} onClick={()=>void changeExperience("support")}>
            <Guitar size={16}/> Músico {kind==="support"&&<Check size={15}/>}
          </button>
        </section>}

      <WorkspaceOverview isSinger={Boolean(profile?.is_singer)}
        isMusician={Boolean(profile?.is_musician)}
        isProducer={Boolean(profile?.is_producer)}/>
      <p className="sf-workspace-asof">O painel reúne funções já existentes; as antigas URLs continuam válidas.
        Sua função ativa não altera contratações, permissões, planos ou cachês.</p>
    </div>
  </main>;
}
