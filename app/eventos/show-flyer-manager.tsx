"use client";

import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight, Check, Download, ImagePlus, LoaderCircle, Move,
  RotateCcw, Save, Share2, Trash2, WandSparkles
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  defaultFlyerSettings, downloadFlyer, drawFlyer, flyerFileName,
  loadFlyerImage, makeFlyerBlob, safeFlyerSettings,
  type FlyerCrop, type FlyerFit, type FlyerFormat, type FlyerSettings
} from "@/app/meu-perfil-artistico/site-profissional/show-flyer-render";
import "./show-flyer-manager.css";

const BUCKET="stage-show-flyers";
const MAX_SIZE=8*1024*1024;
type StoredFlyer={flyer_path:string|null;flyer_settings:FlyerSettings};

export default function ShowFlyerManager({
  eventId, title, onSaved
}:{
  eventId:string;
  title:string;
  onSaved?:(value:StoredFlyer)=>void;
}){
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [flyerPath,setFlyerPath]=useState<string|null>(null);
  const [settings,setSettings]=useState<FlyerSettings>(defaultFlyerSettings);
  const [format,setFormat]=useState<FlyerFormat>("feed");
  const [originalBlob,setOriginalBlob]=useState<Blob|null>(null);
  const [pendingFile,setPendingFile]=useState<File|null>(null);
  const [imageUrl,setImageUrl]=useState<string|null>(null);
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const pointerRef=useRef<{x:number;y:number;crop:FlyerCrop}|null>(null);
  const crop=settings[format];

  useEffect(()=>{
    let active=true;
    async function load(){
      const supabase=createClient();
      const {data,error:queryError}=await supabase.from("events")
        .select("flyer_path,flyer_settings").eq("id",eventId).single();
      if(!active)return;
      if(queryError){
        setError("A edição de flyers precisa da migração pro_artist_show_flyers_migration.sql no Supabase. "+queryError.message);
        return;
      }
      setReady(true);
      setFlyerPath(data?.flyer_path||null);
      setSettings(safeFlyerSettings(data?.flyer_settings));
      if(data?.flyer_path){
        const {data:blob,error:downloadError}=await supabase.storage
          .from(BUCKET).download(data.flyer_path);
        if(!active)return;
        if(downloadError||!blob){
          setError("Não foi possível carregar o flyer existente: "+(downloadError?.message||"Arquivo indisponível."));
        }else setOriginalBlob(blob);
      }
    }
    void load();
    return()=>{active=false};
  },[eventId]);

  useEffect(()=>{
    const blob=pendingFile??originalBlob;
    if(!blob){setImageUrl(null);return;}
    const url=URL.createObjectURL(blob);
    setImageUrl(url);
    return()=>URL.revokeObjectURL(url);
  },[pendingFile,originalBlob]);

  useEffect(()=>{
    let active=true;
    setImage(null);
    if(!imageUrl)return;
    void loadFlyerImage(imageUrl).then(loaded=>{
      if(active)setImage(loaded);
    }).catch(()=>{if(active)setError("Não foi possível abrir a imagem selecionada.");});
    return()=>{active=false};
  },[imageUrl]);

  useEffect(()=>{
    if(!image||!canvasRef.current)return;
    const frame=requestAnimationFrame(()=>{
      if(canvasRef.current)drawFlyer(canvasRef.current,image,format,crop,true);
    });
    return()=>cancelAnimationFrame(frame);
  },[image,format,crop]);

  function setCrop(partial:Partial<FlyerCrop>){
    setSettings(current=>({
      ...current,
      [format]:{...current[format],...partial}
    }));
    setMessage("");
  }

  function chooseFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value="";
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)
      ||file.size===0||file.size>MAX_SIZE){
      setError("Use JPG, PNG ou WebP com até 8 MB.");
      return;
    }
    setError("");setMessage("");
    setPendingFile(file);
  }

  function startDrag(event:PointerEvent<HTMLCanvasElement>){
    if(!image)return;
    pointerRef.current={x:event.clientX,y:event.clientY,crop:{...crop}};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event:PointerEvent<HTMLCanvasElement>){
    if(!pointerRef.current||!image)return;
    const box=event.currentTarget.getBoundingClientRect();
    const drag=pointerRef.current;
    const clamp=(n:number)=>Math.round(Math.max(-100,Math.min(100,n)));
    setCrop({
      x:clamp(drag.crop.x+(event.clientX-drag.x)/Math.max(1,box.width)*170),
      y:clamp(drag.crop.y+(event.clientY-drag.y)/Math.max(1,box.height)*170)
    });
  }
  function stopDrag(){
    pointerRef.current=null;
  }

  async function save(){
    if(!ready||busy)return;
    setBusy(true);setError("");setMessage("");
    const supabase=createClient();
    const oldPath=flyerPath;
    let nextPath=oldPath;
    if(pendingFile){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){
        setError("Sua sessão expirou. Faça login novamente.");
        setBusy(false);return;
      }
      const extension:Record<string,string>={
        "image/jpeg":"jpg","image/png":"png","image/webp":"webp"
      };
      nextPath=user.id+"/"+eventId+"/"+crypto.randomUUID()+"."+extension[pendingFile.type];
      const {error:uploadError}=await supabase.storage.from(BUCKET)
        .upload(nextPath,pendingFile,{upsert:false,contentType:pendingFile.type});
      if(uploadError){
        setError("Falha no envio do flyer: "+uploadError.message);
        setBusy(false);return;
      }
    }
    const {data,error:saveError}=await supabase.rpc("stage_set_show_flyer",{
      p_event_id:eventId,p_path:nextPath,p_settings:settings
    });
    if(saveError||data!=="saved"){
      if(pendingFile&&nextPath)await supabase.storage.from(BUCKET).remove([nextPath]);
      setError("Não foi possível salvar: "+(saveError?.message||String(data)));
      setBusy(false);return;
    }
    if(pendingFile)setOriginalBlob(pendingFile);
    setPendingFile(null);
    setFlyerPath(nextPath);
    setMessage("Flyer e enquadramento salvos no show.");
    if(oldPath&&oldPath!==nextPath)
      void supabase.storage.from(BUCKET).remove([oldPath]);
    onSaved?.({flyer_path:nextPath,flyer_settings:settings});
    setBusy(false);
  }

  async function remove(){
    if(!flyerPath||busy||!window.confirm("Remover o flyer deste show?"))return;
    setBusy(true);setError("");setMessage("");
    const oldPath=flyerPath;
    const supabase=createClient();
    const {data,error:rpcError}=await supabase.rpc("stage_set_show_flyer",{
      p_event_id:eventId,p_path:null,p_settings:null
    });
    if(rpcError||data!=="saved"){
      setError("Não foi possível remover o flyer: "+(rpcError?.message||String(data)));
      setBusy(false);return;
    }
    setFlyerPath(null);
    setPendingFile(null);
    setOriginalBlob(null);
    setSettings(defaultFlyerSettings());
    onSaved?.({flyer_path:null,flyer_settings:defaultFlyerSettings()});
    const {error:removeError}=await supabase.storage.from(BUCKET).remove([oldPath]);
    setMessage(removeError?
      "Flyer desvinculado, mas o arquivo antigo não pôde ser excluído.":
      "Flyer removido do show.");
    setBusy(false);
  }

  async function exportFormat(output:FlyerFormat){
    if(!image)return;
    setBusy(true);setError("");
    try{
      const blob=await makeFlyerBlob(image,output,settings[output]);
      downloadFlyer(blob,flyerFileName(title,output));
    }catch{
      setError("Não foi possível exportar. Tente selecionar a imagem novamente.");
    }finally{setBusy(false)}
  }

  async function shareCurrentFormat(){
    if(!image||busy)return;
    setBusy(true);setError("");
    try{
      const blob=await makeFlyerBlob(image,format,crop);
      const file=new File([blob],flyerFileName(title,format),{type:"image/jpeg"});
      if(navigator.share && navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:"Flyer do show "+title});
      }else{
        downloadFlyer(blob,file.name);
        setMessage("Seu navegador não oferece compartilhamento direto de imagens. O flyer foi baixado; envie o arquivo pelo WhatsApp ou Instagram.");
      }
    }catch(error){
      if(!(error instanceof Error && error.name==="AbortError"))
        setError("Não foi possível compartilhar a imagem. Use os botões de download.");
    }finally{setBusy(false)}
  }

  return <section className="show-flyer-manager" aria-label={"Flyer do show "+title}>
    <header>
      <div>
        <span><WandSparkles size={15}/> DIVULGAÇÃO DO SHOW</span>
        <h3>Flyer para Instagram e WhatsApp</h3>
        <p>Suba a arte original e ajuste o enquadramento. A mesma imagem gera
          Feed (1080×1350) e Story/Status (1080×1920).</p>
      </div>
    </header>
    {error&&<p className="show-flyer-error" role="alert">{error}</p>}
    {message&&<p className="show-flyer-success" role="status">{message}</p>}
    <div className="show-flyer-upload">
      <label className={"btn btn-quiet"+(!ready||busy?" is-disabled":"")}>
        <ImagePlus size={16}/> {image?"Trocar flyer original":"Escolher flyer (JPG, PNG, WebP)"}
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden
          disabled={!ready||busy} onChange={chooseFile}/>
      </label>
      <small>Até 8 MB. O flyer original permanece privado e só aparece no site Pro se o show for público.</small>
    </div>
    {image&&<div className="show-flyer-workspace">
      <div className="show-flyer-canvas-wrap">
        <div className="show-flyer-format-tabs" role="group" aria-label="Formato do flyer">
          <button type="button" className={format==="feed"?"is-active":""}
            onClick={()=>setFormat("feed")}>Feed 4:5</button>
          <button type="button" className={format==="story"?"is-active":""}
            onClick={()=>setFormat("story")}>Story / Status 9:16</button>
        </div>
        <canvas ref={canvasRef} className="show-flyer-canvas"
          style={{aspectRatio:format==="feed"?"4 / 5":"9 / 16"}}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          aria-label="Prévia do flyer. Arraste para reposicionar a imagem."/>
        <span className="show-flyer-drag-hint"><Move size={14}/> Arraste a imagem para reposicionar</span>
      </div>
      <div className="show-flyer-controls">
        <strong>Enquadramento do {format==="feed"?"Feed":"Story / Status"}</strong>
        <div className="show-flyer-modes" role="group" aria-label="Tipo de ajuste">
          <button type="button" className={crop.fit==="cover"?"is-active":""}
            onClick={()=>setCrop({fit:"cover",zoom:1,x:0,y:0})}>
            <ArrowLeftRight size={15}/> Preencher / recorte automático
          </button>
          <button type="button" className={crop.fit==="contain"?"is-active":""}
            onClick={()=>setCrop({fit:"contain",zoom:1,x:0,y:0})}>
            <ImagePlus size={15}/> Sem cortar / fundo desfocado
          </button>
        </div>
        <label>
          <span>Zoom <b>{crop.zoom.toFixed(1)}×</b></span>
          <input type="range" min={1} max={3} step={0.1} value={crop.zoom}
            onChange={event=>setCrop({zoom:Number(event.target.value)})}/>
        </label>
        <label>
          <span>Posição horizontal <b>{crop.x}%</b></span>
          <input type="range" min={-100} max={100} step={1} value={crop.x}
            onChange={event=>setCrop({x:Number(event.target.value)})}/>
        </label>
        <label>
          <span>Posição vertical <b>{crop.y}%</b></span>
          <input type="range" min={-100} max={100} step={1} value={crop.y}
            onChange={event=>setCrop({y:Number(event.target.value)})}/>
        </label>
        <button className="show-flyer-reset" type="button"
          onClick={()=>setCrop({fit:"cover",zoom:1,x:0,y:0})}>
          <RotateCcw size={15}/> Restaurar ajuste automático
        </button>
        {pendingFile&&<p className="show-flyer-pending">
          Você selecionou uma nova arte. Clique em <strong>Salvar flyer</strong> para enviá-la ao show.
        </p>}
        <button className="btn btn-primary" type="button"
          onClick={()=>void save()} disabled={!ready||busy}>
          {busy?<LoaderCircle size={16}/>:<Save size={16}/>}
          {busy?"Processando...":"Salvar flyer e enquadramento"}
        </button>
        <button className="btn btn-quiet" type="button" disabled={busy}
          onClick={()=>void shareCurrentFormat()}>
          <Share2 size={16}/> {format==="feed"?"Compartilhar Feed":"Compartilhar Story / Status"} (ou baixar)
        </button>
        <div className="show-flyer-downloads">
          <button className="btn btn-quiet" type="button" disabled={busy}
            onClick={()=>void exportFormat("feed")}>
            <Download size={15}/> Baixar Feed 1080×1350
          </button>
          <button className="btn btn-quiet" type="button" disabled={busy}
            onClick={()=>void exportFormat("story")}>
            <Download size={15}/> Baixar Story 1080×1920
          </button>
        </div>
        {flyerPath&&<button className="show-flyer-remove" type="button"
          disabled={busy} onClick={()=>void remove()}>
          <Trash2 size={15}/> Excluir flyer do show
        </button>}
        <p className="show-flyer-footnote"><Check size={14}/>
          O enquadramento de Feed e Story é salvo separadamente.
          O sistema começa pelo centro da imagem; confira textos, rostos e logos antes de publicar.</p>
      </div>
    </div>}
    {!image&&ready&&<div className="show-flyer-empty">
      Envie o flyer deste show para ativar o recorte automático e os dois formatos de download.
    </div>}
  </section>;
}
