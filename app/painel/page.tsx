"use client";

import { useEffect, useState } from "react";
import {useRouter} from "next/navigation";
import {Check,Guitar,LayoutDashboard,Mic2,Settings2} from "lucide-react";
import WorkspaceSidebar from "@/src/domains/navigation/components/workspace-sidebar";
import WorkspaceOverview from "@/src/domains/dashboard/components/workspace-overview";
import { createClient } from "@/lib/supabase/client";
import NotificationBell from "@/components/notification-bell";
import DashboardAccountMenu from "@/components/dashboard-account-menu";
import { useAccount } from "@/src/domains/account/account-context";
import "./painel-account-actions.css";
import {greeting} from "@/src/domains/dashboard/model/operational-summary";

type ArtistKind = "lead" | "support";
export default function Dashboard() {
  const router = useRouter();
  const {snapshot:account,refresh:refreshAccount}=useAccount();
  const profile=account.profile;

  const {isOwnerAdmin,partnerHouseCount}=account.permissions;
  const [singerPhoto,setSingerPhoto]=useState<string|null>(null);
  const [musicianPhoto,setMusicianPhoto]=useState<string|null>(null);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [changingKind, setChangingKind] = useState(false);

  useEffect(()=>{
    if(!profile||!account.user)return;
    const user=account.user,data=profile,supabase=createClient();
    const request=new AbortController();
    setSingerPhoto(null);setMusicianPhoto(null);
    const singerPath=data.artist_avatar_path;
    if(data.is_singer&&singerPath&&new RegExp("^"+user.id+"/[0-9a-f-]{36}\\.(jpg|png|webp)$","i").test(singerPath))
      setSingerPhoto(supabase.storage.from("stage-artist-public").getPublicUrl(singerPath).data.publicUrl);
    async function musicianAvatar(){
      if(!data.is_musician)return;
      const {data:portfolioData}=await supabase.rpc("stage_my_musician_portfolio").abortSignal(request.signal);
      if(request.signal.aborted)return;
      const url=(portfolioData as {avatar_url?:string|null}|null)?.avatar_url;
      const safePrefix=new URL(supabase.storage.from("stage-musician-media").getPublicUrl(user.id+"/placeholder.png").data.publicUrl);
      try{
        const candidate=url?new URL(url):null;
        setMusicianPhoto(candidate&&candidate.protocol==="https:"&&candidate.origin===safePrefix.origin&&
          candidate.pathname.startsWith(safePrefix.pathname.replace("placeholder.png",""))?candidate.href:null);
      }catch{setMusicianPhoto(null);}
    }
    void musicianAvatar().catch(()=>{});
    return()=>request.abort();
  },[profile?.id,profile?.is_singer,profile?.is_musician,profile?.artist_avatar_path,account.user?.id]);

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
      setMessage("Não foi possível mudar a experiência. Tente novamente.");
    } else {
      await refreshAccount();
      setMessage("Seu painel agora prioriza as ferramentas de " +
        (kind === "lead" ? "cantor/artista principal." : "músico de apoio.") +
        " Seus dados e permissões foram preservados.");
    }
    setChangingKind(false);
  }

  async function handleSignOut() {
    setSigningOut(true);setMessage("");
    try{
      const {error}=await createClient().auth.signOut();
      if(error)throw error;
      router.replace("/login");router.refresh();
    }catch{setMessageError(true);setMessage("Não foi possível sair da conta. Tente novamente.");}
    finally{setSigningOut(false);}
  }

  const kind: ArtistKind = profile?.is_singer && !profile?.is_musician ? "lead"
    : profile?.is_musician && !profile?.is_singer ? "support"
    : profile?.artist_kind === "support" ? "support" : "lead";
  const isSupport = Boolean(profile?.is_musician && kind === "support");
  const isLead = Boolean(profile?.is_singer && kind === "lead");
  // O avatar da conta tem uma identidade independente do modo cantor/musico.
  // Priorizar a foto artistica principal evita resgatar a miniatura antiga.
  const accountPhoto=singerPhoto||musicianPhoto;
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
        <h1>{greeting()}, <span>{profile?.display_name?.split(" ")[0]||"bem-vindo(a)"}</span> 👋</h1>
        <p>O que merece sua atenção hoje? Suas tarefas, shows e oportunidades em um só lugar.</p>

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
    </div>
  </main>;
}
