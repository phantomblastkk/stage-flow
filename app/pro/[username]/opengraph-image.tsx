import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import {
  getPublishedProSite,
  getPublicArtistImageUrl,
  publicArtistDescription
} from "@/lib/pro-site-public";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const alt="Cartão de apresentação do cantor no Stage Flow";
export const size={width:1200,height:630};
export const contentType="image/png";

async function safePublicPhoto(url:string|null):Promise<string|null>{
  if(!url)return null;
  try{
    const response=await fetch(url,{
      cache:"no-store",
      signal:AbortSignal.timeout(4500)
    });
    if(!response.ok)return null;
    const contentType=response.headers.get("content-type")||"";
    if(!/^image\/(png|jpeg|webp)(;|$)/i.test(contentType))return null;
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength===0||bytes.byteLength>7*1024*1024)return null;
    return "data:"+contentType.split(";")[0]+";base64,"+
      Buffer.from(bytes).toString("base64");
  }catch{
    // Falha de imagem nunca derruba o cartão do artista.
    return null;
  }
}

function initials(name:string):string{
  return name.split(/\s+/).slice(0,2).map(word=>word[0]||"")
    .join("").toLocaleUpperCase("pt-BR");
}

type Props={params:Promise<{username:string}>};

export default async function OpenGraphImage({params}:Props){
  const {username}=await params;
  const site=await getPublishedProSite(username);
  if(!site?.artist)notFound();

  const artist=site.artist;
  const name=(artist.name||"Artista").trim().slice(0,100);
  const description=publicArtistDescription(site).slice(0,110);
  const city=(artist.city||"").trim().slice(0,65);
  const photo=await safePublicPhoto(getPublicArtistImageUrl(site));
  const headingSize=name.length>35?52:name.length>24?61:76;

  return new ImageResponse(
    <div style={{
      display:"flex",position:"relative",width:"100%",height:"100%",
      overflow:"hidden",backgroundColor:"#090b18",
      backgroundImage:"linear-gradient(125deg,#0b1225 0%,#1e1741 65%,#4d2681 100%)",
      color:"#fff",fontFamily:"Arial, sans-serif"
    }}>
      {/* Foto pública de capa ou retrato, sem buscar arquivos privados. */}
      <div style={{
        display:"flex",position:"absolute",top:0,right:0,
        width:photo?"49%":"46%",height:"100%",overflow:"hidden",
        justifyContent:"center",alignItems:"center",
        backgroundImage:"linear-gradient(140deg,#34265b,#17102e)"
      }}>
        {photo?
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:
          <div style={{
            display:"flex",width:350,height:350,
            border:"3px solid #be91fe",borderRadius:999,
            justifyContent:"center",alignItems:"center",
            backgroundColor:"#38205e",fontSize:136,fontWeight:900,
            color:"#e9d6ff"
          }}>{initials(name)}</div>}
      </div>

      {/* Gradiente garante legibilidade com qualquer fotografia. */}
      <div style={{
        display:"flex",position:"absolute",top:0,left:0,
        width:"100%",height:"100%",
        backgroundImage:photo?
          "linear-gradient(90deg,#090d1c 0%,#11132a 39%,#15152aee 55%,#11112770 74%,#0b102444 100%)":
          "linear-gradient(90deg,#090d1c 0%,#141430 47%,#16132a88 65%,#19122c20 100%)"
      }}/>

      {/* Barra roxa de assinatura visual do Stage Flow. */}
      <div style={{
        display:"flex",position:"absolute",left:0,top:0,
        width:12,height:"100%",backgroundColor:"#b585fb"
      }}/>

      <div style={{
        display:"flex",position:"relative",flexDirection:"column",
        padding:"57px 70px 52px 78px",width:900,height:"100%",
        justifyContent:"space-between"
      }}>
        <div style={{display:"flex",flexDirection:"column",gap:15}}>
          <div style={{
            display:"flex",alignItems:"center",gap:13,
            color:"#eed8ff",fontSize:25,fontWeight:900,
            letterSpacing:3
          }}>
            <div style={{
              display:"flex",alignItems:"center",gap:4,height:35
            }}>
              {[14,28,36,24,18].map((height,index)=>
                <div key={index} style={{
                  display:"flex",width:6,height,borderRadius:5,
                  backgroundColor:"#bf8cfb"
                }}/>)}
            </div>
            STAGE FLOW
          </div>
          <div style={{
            display:"flex",fontSize:17,fontWeight:800,
            color:"#bcadd9",letterSpacing:2
          }}>
            SITE PROFISSIONAL DO ARTISTA
          </div>
        </div>

        <div style={{
          display:"flex",flexDirection:"column",width:740,gap:22
        }}>
          <div style={{
            display:"flex",fontSize:headingSize,fontWeight:900,
            lineHeight:1.08,letterSpacing:-2,
            textShadow:"0 5px 22px #080a1c99",
            overflowWrap:"anywhere"
          }}>{name}</div>
          <div style={{
            display:"flex",maxWidth:690,fontSize:25,
            lineHeight:1.35,fontWeight:500,
            color:"#e1d7f2",overflowWrap:"anywhere"
          }}>{description}</div>
        </div>

        <div style={{
          display:"flex",alignItems:"center",gap:12,
          fontSize:19,fontWeight:700,color:"#d7c0f3"
        }}>
          <div style={{
            display:"flex",width:13,height:13,
            borderRadius:999,backgroundColor:"#b88afa"
          }}/>
          {city||"Música • Shows • Apresentações"}
        </div>
      </div>
      <div style={{
        display:"flex",position:"absolute",right:31,bottom:24,
        width:210,height:4,borderRadius:8,
        backgroundColor:"#be8fff"
      }}/>
    </div>,
    {width:size.width,height:size.height}
  );
}
