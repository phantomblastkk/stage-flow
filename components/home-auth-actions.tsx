"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Placement = "nav" | "hero" | "closing" | "portfolio";

export default function HomeAuthActions({placement}:{placement:Placement}) {
  // Apenas interface: autenticação e permissões são verificadas nas páginas protegidas.
  // Null means checking — don't flash "Entrar" to a signed-in user on navigation.
  const [signedIn,setSignedIn] = useState<boolean|null>(null);
  useEffect(()=>{
    const supabase=createClient();
    let active=true;
    async function refreshSession(){
      try {
        const {data,error}=await supabase.auth.getSession();
        if(active)setSignedIn(error?null:!!data.session);
      } catch {
        if(active)setSignedIn(null);
      }
    }
    void refreshSession();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(active)setSignedIn(!!session);
    });
    function onFocus(){void refreshSession();}
    window.addEventListener("focus",onFocus);
    return()=>{
      active=false;subscription.unsubscribe();
      window.removeEventListener("focus",onFocus);
    };
  },[]);

  if(signedIn===null) return <Link className="btn btn-quiet" href="/painel">
    Minha conta <ArrowRight size={15}/>
  </Link>;

  if(placement==="nav") return signedIn
    ? <Link className="btn btn-primary" href="/painel">Meu painel <ArrowRight size={15}/></Link>
    : <>
        <Link className="btn btn-quiet" href="/login">Entrar</Link>
        <Link className="btn btn-primary" href="/cadastro">Criar conta <ArrowRight size={15}/></Link>
      </>;

  if(placement==="hero")return <Link className="btn btn-primary"
    href={signedIn?"/painel":"/cadastro"}>
    {signedIn?"Acessar meu painel":"Começar gratuitamente"} <ArrowRight size={17}/>
  </Link>;

  if(placement==="portfolio")return <Link className="btn btn-primary"
    href={signedIn?"/meu-portfolio":"/cadastro"}>
    {signedIn?"Personalizar meu portfólio":"Criar conta para personalizar"} <ArrowUpRight size={17}/>
  </Link>;

  return <Link className="btn btn-primary" href={signedIn?"/painel":"/cadastro"}>
    {signedIn?"Voltar ao meu painel":"Criar minha conta"} <ArrowRight size={16}/>
  </Link>;
}
