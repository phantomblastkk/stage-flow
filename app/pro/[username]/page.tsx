import {notFound,permanentRedirect} from "next/navigation";

// Retrocompatibilidade: o site profissional e o perfil gratuito são agora
// um único endereço canônico, com funções Pro bloqueadas quando necessário.
export default async function OldProSingerPage({params}:{
  params:Promise<{username:string}>;
}){
  const {username}=await params;
  if(!/^[a-z0-9-]{3,30}$/.test(username))notFound();
  permanentRedirect("/"+encodeURIComponent(username));
}
