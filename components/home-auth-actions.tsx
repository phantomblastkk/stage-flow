"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Placement = "nav" | "hero" | "closing" | "portfolio";

export default function HomeAuthActions({placement}:{placement:Placement}) {
  // Apenas interface: autenticação e permissões são verificadas nas páginas protegidas.
  const [signedIn,setSignedIn] = useState(false);
  useEffect(()=>{
    const supabase=createClient();
    let active=true;
    void supabase.auth.getSession().then(({data})=>{
      if(active)setSignedIn(!!data.session);
    }).catch(()=>{if(active)setSignedIn(false)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(active)setSignedIn(!!session);
    });
    return()=>{active=false;subscription.unsubscribe()};
  },[]);

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
