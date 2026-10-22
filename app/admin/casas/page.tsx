"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, CalendarDays, CheckCircle2, ExternalLink, ImagePlus, LoaderCircle,
  MapPin, Plus, RefreshCw, Save, Search, ShieldCheck, Star, UploadCloud
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./venues-admin.css";

type City = { id: number; name: string; state_code: string };
type Venue = {
  id: string | null;
  name: string;
  city_id: number | null;
  city_name?: string | null;
  state_code?: string | null;
  address: string;
  slug: string;
  description: string;
  instagram_url: string;
  whatsapp: string;
  logo_path: string;
  cover_path: string;
  is_official: boolean;
  is_partner: boolean;
  active: boolean;
  submitted_by?: string | null;
};
type ListResponse = { status: string; items?: Venue[] };
type SaveResponse = { status: string; id?: string };
type AssignedManager = { profile_id: string; email: string; display_name: string; granted_at: string };

const blank = (): Venue => ({
  id: null, name: "", city_id: null, address: "", slug: "",
  description: "", instagram_url: "", whatsapp: "", logo_path: "", cover_path: "",
  is_official: false, is_partner: false, active: true
});

function mediaUrl(path: string): string {
  if (!path) return "";
  return createClient().storage.from("stage-venue-media").getPublicUrl(path).data.publicUrl;
}
function statusMessage(status: string): string {
  const labels: Record<string, string> = {
    forbidden: "Sua conta não tem permissão para administrar casas.",
    invalid: "Revise os campos. Para publicar uma casa oficial, é necessário um endereço de página válido.",
    invalid_media: "O arquivo da imagem não foi reconhecido pelo banco. Faça o upload novamente.",
    duplicate: "Já existe uma casa com esse nome na cidade ou com esse endereço de página.",
    not_found: "Esta casa não foi encontrada. Atualize a lista."
  };
  return labels[status] || "Não foi possível salvar. Verifique as configurações do banco.";
}
const cleanSlug = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 50);

export default function AdminCasasPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState<Venue>(blank);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [managers, setManagers] = useState<AssignedManager[]>([]);
  const [managerEmail, setManagerEmail] = useState("");
  const [managerBusy, setManagerBusy] = useState(false);
  const [managerError, setManagerError] = useState("");
  const [managerNotice, setManagerNotice] = useState("");

  const refresh = useCallback(async (selectId?: string) => {
    const supabase = createClient();
    const [catalog, cityResult] = await Promise.all([
      supabase.rpc("stage_venue_admin_list"),
      supabase.from("cities").select("id,name,state_code").eq("active", true).order("name")
    ]);
    if (catalog.error || cityResult.error) {
      throw new Error(catalog.error?.message || cityResult.error?.message || "Falha ao carregar o catálogo.");
    }
    const payload = catalog.data as ListResponse | null;
    if (!payload || payload.status !== "ok") throw new Error(statusMessage(payload?.status || "error"));
    const rows = payload.items || [];
    setVenues(rows);
    setCities((cityResult.data || []) as City[]);
    if (selectId) {
      const selected = rows.find((item) => item.id === selectId);
      if (selected) setForm({ ...selected, address: selected.address || "",
        description: selected.description || "", slug: selected.slug || "",
        instagram_url: selected.instagram_url || "", whatsapp: selected.whatsapp || "",
        logo_path: selected.logo_path || "", cover_path: selected.cover_path || "" });
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        const { data, error: accessError } = await supabase.rpc("stage_venue_admin_status");
        if (!active) return;
        if (accessError) {
          setError("A área administrativa ainda não está configurada no Supabase. Execute venue_admin_migration.sql.");
          return;
        }
        if (data !== true) {
          setError("Acesso reservado. Sua conta precisa ser autorizada como administradora pelo Supabase.");
          return;
        }
        setAuthorized(true);
        await refresh();
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Erro ao carregar a administração.");
      } finally {
        if (active) setChecking(false);
      }
    }
    void check();
    return () => { active = false; };
  }, [router, refresh]);

  const loadManagers = useCallback(async (venueId: string) => {
    const { data, error } = await createClient().rpc("stage_venue_admin_managers",{p_venue_id:venueId});
    if (error) throw error;
    const payload = data as {status:string;items?:AssignedManager[]};
    if (payload.status!=="ok") throw new Error("Não foi possível consultar os responsáveis cadastrados.");
    return payload.items||[];
  }, []);

  useEffect(() => {
    if (!authorized || !form.id) {setManagers([]);setManagerError("");return;}
    const id = form.id;
    let active = true;
    void loadManagers(id).then(items => {
      if (active) {setManagers(items);setManagerError("");}
    }).catch(err => {
      if (active) setManagerError(err instanceof Error?err.message:"Falha ao carregar os responsáveis.");
    });
    return () => {active=false;};
  },[authorized,form.id,loadManagers]);

  async function setManager(email: string, enabled: boolean) {
    if (!form.id || managerBusy) return;
    setManagerBusy(true);setManagerError("");setManagerNotice("");
    try {
      const { data,error } = await createClient().rpc("stage_venue_admin_set_manager",{
        p_venue_id:form.id,p_email:email.trim(),p_enabled:enabled
      });
      if (error) throw error;
      const result=String(data);
      if (result!=="granted" && result!=="revoked") {
        const messages:Record<string,string>={
          forbidden:"Sua conta não tem permissão para vincular responsáveis.",
          venue_not_partner:"Marque a casa como oficial, parceira e ativa. Salve antes de conceder o acesso.",
          account_not_found:"Não encontramos uma conta Stage Flow cadastrada com esse e-mail.",
          not_found:"A casa não foi encontrada.",invalid:"Informe um e-mail válido."
        };
        throw new Error(messages[result]||"Não foi possível alterar a permissão.");
      }
      setManagers(await loadManagers(form.id));setManagerEmail("");
      setManagerNotice(enabled?"Acesso do responsável concedido.":"Acesso do responsável revogado.");
    } catch(err) {
      setManagerError(err instanceof Error?err.message:"Erro ao gerenciar responsável.");
    } finally {setManagerBusy(false);}
  }

  const filtered = useMemo(() => venues.filter((item) =>
    [item.name, item.city_name, item.slug].join(" ").toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR").trim())
  ), [venues, query]);

  function edit(item: Venue) {
    setForm({ ...item, address: item.address || "", slug: item.slug || "",
      description: item.description || "", instagram_url: item.instagram_url || "",
      whatsapp: item.whatsapp || "", logo_path: item.logo_path || "",
      cover_path: item.cover_path || "" });
    setNotice(""); setError("");
  }
  function setField<K extends keyof Venue>(field: K, value: Venue[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const { data, error: saveError } = await createClient().rpc("stage_venue_admin_save", {
        p_venue: form
      });
      if (saveError) throw saveError;
      const payload = data as SaveResponse;
      if (payload.status !== "ok" || !payload.id) throw new Error(statusMessage(payload.status));
      await refresh(payload.id);
      setNotice(form.id ? "Cadastro atualizado com sucesso." :
        "Casa cadastrada! Agora você pode adicionar o logotipo e a capa.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: "logo" | "cover", file?: File) {
    if (!file) return;
    setError(""); setNotice("");
    if (!form.id) {
      setError("Salve o cadastro antes de enviar imagens.");
      return;
    }
    const extByType: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"
    };
    const extension = extByType[file.type];
    if (!extension || file.size > 5 * 1024 * 1024) {
      setError("Use uma imagem JPG, PNG ou WebP de até 5 MB.");
      return;
    }
    setUploading(kind);
    try {
      const supabase = createClient();
      const path = form.id + "/" + kind + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await supabase.storage.from("stage-venue-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const patched = { ...form, [kind === "logo" ? "logo_path" : "cover_path"]: path };
      const { data, error: saveError } = await supabase.rpc("stage_venue_admin_save", {
        p_venue: patched
      });
      if (saveError) throw saveError;
      const payload = data as SaveResponse;
      if (payload.status !== "ok") throw new Error(statusMessage(payload.status));
      setForm(patched);
      await refresh(form.id);
      setNotice(kind === "logo" ? "Logotipo atualizado." : "Capa atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagem.");
    } finally {
      setUploading(null);
    }
  }

  return <main className="venue-admin"><div className="container">
    <nav className="nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span> stage flow</Link>
      <Link className="btn btn-quiet" href="/painel"><ArrowLeft size={15}/> Voltar ao painel</Link>
    </nav>
    <header className="venue-admin-header">
      <div className="eyebrow"><ShieldCheck size={14}/> ACESSO RESTRITO</div>
      <h1>Casas de <span className="accent">show.</span></h1>
      <p className="lead">Gerencie o catálogo colaborativo, crie páginas oficiais e destaque casas parceiras do Stage Flow.</p>
    </header>
    {checking ? <div className="feature"><LoaderCircle size={18}/> Verificando acesso...</div> :
      !authorized ? <div className="feature venue-admin-alert" role="alert">
        <ShieldCheck size={24}/><h2>Painel protegido</h2><p>{error}</p>
        <p className="fine">Somente administradores autorizados no Supabase podem visualizar ou editar os estabelecimentos.</p>
      </div> :
      <>
        {error && <div className="venue-admin-message venue-admin-error" role="alert">{error}</div>}
        {notice && <div className="venue-admin-message" role="status"><CheckCircle2 size={17}/>{notice}</div>}
        <div className="venue-admin-stats">
          <span><strong>{venues.length}</strong> casas cadastradas</span>
          <span><strong>{venues.filter((v) => v.is_official && v.active).length}</strong> perfis oficiais ativos</span>
          <span><strong>{venues.filter((v) => v.is_partner && v.active).length}</strong> parceiras ativas</span>
        </div>
        <div className="venue-admin-grid">
          <aside className="venue-admin-directory">
            <div className="venue-admin-list-head">
              <h2>Estabelecimentos</h2>
              <button className="btn btn-primary" type="button" onClick={() => {
                setForm(blank()); setError(""); setNotice("");
              }}><Plus size={15}/> Nova casa</button>
            </div>
            <div className="venue-admin-search"><Search size={17}/>
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar casa, cidade ou slug" aria-label="Buscar casas"/>
            </div>
            <div className="venue-admin-items">
              {filtered.map((item) => <button type="button" key={item.id}
                className={"venue-admin-item" + (form.id === item.id ? " selected" : "")}
                onClick={() => edit(item)}>
                <span className="venue-admin-item-mark"><Building2 size={21}/></span>
                <span className="venue-admin-item-text">
                  <strong>{item.name}</strong>
                  <small>{[item.city_name, item.state_code].filter(Boolean).join(" · ") || "Cidade não informada"}</small>
                  <span className="venue-admin-flags">
                    {!item.active ? "Inativa" : item.is_partner ? "Parceira" : item.is_official ? "Oficial" : "Catálogo"}
                  </span>
                </span>
              </button>)}
              {filtered.length === 0 && <p className="fine">Nenhuma casa encontrada.</p>}
            </div>
            <button className="venue-admin-refresh" type="button" onClick={() => {
              void refresh(form.id || undefined).then(() => setNotice("Lista atualizada."))
                .catch((err) => setError(String(err)));
            }}><RefreshCw size={15}/> Atualizar lista</button>
          </aside>
          <section className="venue-admin-editor">
            <div className="venue-admin-editor-head">
              <div><span className="venue-admin-overline">{form.id ? "EDITAR ESTABELECIMENTO" : "NOVO ESTABELECIMENTO"}</span>
                <h2>{form.name || "Nova casa de show"}</h2></div>
              {form.id && form.is_official && form.active && form.slug && <Link className="btn btn-quiet" target="_blank"
                href={"/casa/" + form.slug}>Ver página <ExternalLink size={15}/></Link>}
            </div>
            <form onSubmit={save}>
              <div className="venue-admin-fields">
                <div className="field"><label htmlFor="venue-admin-name">Nome da casa *</label>
                  <input id="venue-admin-name" required maxLength={120} value={form.name}
                    onChange={(e) => setField("name", e.target.value)} placeholder="Ex.: Deck Espeto Bar"/></div>
                <div className="field"><label htmlFor="venue-admin-city">Cidade *</label>
                  <select id="venue-admin-city" required value={form.city_id || ""}
                    onChange={(e) => setField("city_id", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Selecione...</option>
                    {cities.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.state_code}</option>)}
                  </select></div>
                <div className="field venue-admin-wide"><label htmlFor="venue-admin-address">Endereço</label>
                  <input id="venue-admin-address" maxLength={240} value={form.address}
                    onChange={(e) => setField("address", e.target.value)} placeholder="Rua, número e bairro"/></div>
                <div className="field venue-admin-wide"><label htmlFor="venue-admin-description">Descrição da casa</label>
                  <textarea id="venue-admin-description" rows={3} maxLength={1500} value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="Conte um pouco sobre o espaço, o estilo musical e a experiência..."/></div>
                <div className="field"><label htmlFor="venue-admin-slug">Endereço da página (slug)</label>
                  <input id="venue-admin-slug" value={form.slug}
                    onChange={(e) => setField("slug", cleanSlug(e.target.value))}
                    placeholder="ex.: deckspetobar" maxLength={50}/>
                  <small className="fine">stageflow.com/casa/{form.slug || "nome-da-casa"}</small></div>
                <div className="field"><label htmlFor="venue-admin-whatsapp">WhatsApp</label>
                  <input id="venue-admin-whatsapp" value={form.whatsapp}
                    onChange={(e) => setField("whatsapp", e.target.value)}
                    placeholder="5511999999999"/></div>
                <div className="field venue-admin-wide"><label htmlFor="venue-admin-instagram">Instagram (URL completa)</label>
                  <input id="venue-admin-instagram" type="url" value={form.instagram_url}
                    onChange={(e) => setField("instagram_url", e.target.value)}
                    placeholder="https://www.instagram.com/nome_da_casa/"/></div>
              </div>
              <div className="venue-admin-checks">
                <label><input type="checkbox" checked={form.active}
                  onChange={(e) => setField("active", e.target.checked)}/>
                  <span><strong>Ativa no catálogo</strong><small>Disponível nas sugestões para os músicos</small></span></label>
                <label><input type="checkbox" checked={form.is_official}
                  onChange={(e) => {
                    setForm((old) => ({ ...old, is_official: e.target.checked, is_partner: e.target.checked ? old.is_partner : false }));
                  }}/>
                  <span><strong>Perfil oficial</strong><small>Publica a página da casa quando ativa e com slug</small></span></label>
                <label><input type="checkbox" checked={form.is_partner} disabled={!form.is_official}
                  onChange={(e) => setField("is_partner", e.target.checked)}/>
                  <span><strong><Star size={14}/> Casa parceira</strong><small>Destaque reservado às parcerias aprovadas</small></span></label>
              </div>
              <div className="venue-admin-editor-footer">
                <button type="submit" className="btn btn-primary" disabled={saving || !!uploading || !cities.length}>
                  {saving ? <LoaderCircle size={17}/> : <Save size={17}/>}
                  {saving ? "Salvando..." : "Salvar cadastro"}
                </button>
              </div>
            </form>
            <div className="venue-admin-media">
              <h3><ImagePlus size={20}/> Identidade visual</h3>
              <p className="fine">Salve a casa antes de enviar imagens. Formatos JPG, PNG ou WebP de até 5 MB.</p>
              <div className="venue-admin-media-grid">
                {(["logo", "cover"] as const).map((kind) => {
                  const path = kind === "logo" ? form.logo_path : form.cover_path;
                  return <div className="venue-admin-media-card" key={kind}>
                    <strong>{kind === "logo" ? "Logotipo" : "Capa"}</strong>
                    <div className={"venue-admin-image " + kind}>
                      {path ? <img src={mediaUrl(path)} alt={kind === "logo" ? "Logotipo cadastrado" : "Capa cadastrada"}/> :
                        <ImagePlus size={28}/>}
                    </div>
                    <label className={"btn btn-quiet " + (!form.id || !!uploading ? "venue-admin-disabled" : "")}>
                      <UploadCloud size={15}/> {uploading === kind ? "Enviando..." : "Enviar imagem"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" hidden
                        disabled={!form.id || !!uploading || saving}
                        onChange={(e) => {
                          void upload(kind, e.target.files?.[0]);
                          e.currentTarget.value = "";
                        }}/>
                    </label>
                  </div>;
                })}
              </div>
            </div>
            {form.id && <div className="venue-admin-media venue-admin-show-review">
              <h3><CalendarDays size={20}/> Calendário oficial da casa</h3>
              <p className="fine">Cadastre os shows desta casa, organize flyers por data, publique fotos e consulte as sugestões recebidas. Esta agenda é independente da agenda dos músicos.</p>
              <Link className="btn btn-primary" href={"/admin/casas/" + form.id + "/programacao"}>
                <CalendarDays size={17}/> Gerenciar programação, flyers e fotos
              </Link>
            </div>}
            {form.id && <div className="venue-admin-media venue-admin-manager-panel">
              <h3><ShieldCheck size={20}/> Responsáveis pela casa</h3>
              <p className="fine">Conceda acesso a uma conta Stage Flow já cadastrada. O responsável poderá editar só shows, flyers, galeria e visualizar sugestões desta casa. Apenas a administração geral controla parceiros, logo, capa e permissões.</p>
              {!form.is_partner && <p className="venue-admin-manager-tip">Para liberar o portal, marque a casa como oficial e parceira, mantenha ativa e salve as alterações.</p>}
              {managerError && <p className="venue-admin-review-error" role="alert">{managerError}</p>}
              {managerNotice && <p className="venue-admin-manager-ok" role="status">{managerNotice}</p>}
              <div className="venue-admin-manager-invite">
                <label htmlFor="venue-manager-email">E-mail de cadastro do responsável</label>
                <div>
                  <input id="venue-manager-email" type="email" maxLength={254} value={managerEmail}
                    onChange={e=>setManagerEmail(e.target.value)}
                    placeholder="responsavel@exemplo.com" autoComplete="off"/>
                  <button type="button" className="btn btn-primary" disabled={managerBusy || !managerEmail.includes("@") || !form.active || !form.is_official || !form.is_partner}
                    onClick={()=>void setManager(managerEmail,true)}>
                    <Plus size={15}/>{managerBusy?"Salvando...":"Conceder acesso"}
                  </button>
                </div>
              </div>
              <div className="venue-admin-manager-list">
                {managers.map(manager=><div className="venue-admin-manager-row" key={manager.profile_id}>
                  <div><strong>{manager.display_name}</strong><small>{manager.email}</small></div>
                  <button type="button" className="btn btn-quiet" disabled={managerBusy}
                    onClick={()=>void setManager(manager.email,false)}>Revogar</button>
                </div>)}
                {!managers.length && <p className="fine">Nenhum responsável com acesso a esta casa.</p>}
              </div>
            </div>}
          </section>
        </div>
        <p className="fine venue-admin-footnote"><MapPin size={14}/> Os locais enviados pelos músicos continuam no catálogo. Torná-los oficiais exige aprovação nesta área administrativa.</p>
      </>
    }
  </div></main>;
}
