import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const load=(path)=>readFileSync(resolve(process.cwd(),path),"utf8");

test("home respects the browser session and links users back to dashboard",()=>{
  const home=load("app/page.tsx");
  const actions=load("components/home-auth-actions.tsx");
  assert.match(home,/HomeAuthActions placement="nav"/);
  assert.match(home,/HomeAuthActions placement="hero"/);
  assert.match(home,/HomeAuthActions placement="closing"/);
  assert.match(actions,/auth\.getSession\(\)/);
  assert.match(actions,/auth\.onAuthStateChange/);
  assert.match(actions,/subscription\.unsubscribe\(\)/);
  assert.match(actions,/signedIn\?"\/painel":"\/cadastro"/);
  assert.match(actions,/Meu painel/);
  assert.doesNotMatch(actions,/auth\.signOut\(/);
});

test("login page does not ask for password when a user already has a valid session",()=>{
  const login=load("app/login/page.tsx");
  assert.match(login,/auth\.getUser\(\)/);
  assert.match(login,/window\.location\.replace\(code\?"\/convite\?codigo="\+encodeURIComponent\(code\):postLoginDestination\(\)\)/);
  assert.match(login,/get\("next"\) === "\/admin\/central"/);
  assert.doesNotMatch(login,/if\(code\)\{setCheckingSession\(false\);return;\}/);
  assert.match(login,/signInWithPassword/);
  const invitations=load("app/meus-convites/page.tsx");
  assert.match(invitations,/\/eventos\/operacao\?evento=/);
  assert.match(invitations,/Ver briefing e logística do show/);
});

test("legacy lemon accent colors are replaced in key Stage Flow experiences",()=>{
  const files=[
    "app/meu-desempenho/performance.css",
    "app/meu-portfolio/musician-portfolio-editor.css",
    "components/marketplace-catalog.css",
    "app/marketplace/coming-soon.css",
    "components/marketplace-musician-settings.css",
  ];
  const legacy=["#c8eb9f","#c6e4a8","#bfe4a0","#b9df98","#c4e69f",
    "#b8e58b","#bbe28e","#bde49a","#c5e79f","#c0e69c"];
  for(const file of files){
    const css=load(file).toLowerCase();
    for(const value of legacy)assert.equal(css.includes(value),false,`${file} still has ${value}`);
  }
  assert.match(load("app/globals.css"),/--accent-solid:#7142D8/i);
});


test("site navigation does not flash login during auth rehydration",()=>{
 const homeActions=load("components/home-auth-actions.tsx");
 const login=load("app/login/page.tsx");
 const dashboard=load("app/painel/page.tsx");
 assert.match(homeActions,/useState<boolean\|null>\(null\)/);
 assert.match(homeActions,/if\(signedIn===null\)/);
 assert.match(homeActions,/Minha conta/);
 assert.match(homeActions,/window\.addEventListener\("focus",onFocus\)/);
 assert.match(login,/checkingSession/);
 assert.match(login,/Verificando sua sessão do Stage Flow/);
 assert.match(dashboard,/if \(userError\)/);
 assert.match(dashboard,/if \(session\)/);
 assert.match(dashboard,/Sua conta não foi desconectada/);
 assert.match(dashboard,/<Link className="btn btn-quiet" href="\/"\>/);
 assert.doesNotMatch(homeActions,/auth\.signOut\(/);
});

test("musicians can register for free without singer invitations or compulsory WhatsApp",()=>{
 const signup=load("app/cadastro/page.tsx");
 const premium=load("components/singer-pro-editor.tsx");
 assert.match(signup,/useState<"lead" \| "support" \| "none">\("support"\)/);
 assert.match(signup,/Músicos não precisam de convite/);
 assert.match(signup,/const needsMusicianPhone = \(Boolean\(inviteCode\) \|\| isArtist\) && whatsappConsent/);
 assert.doesNotMatch(signup,/Esta confirmação é obrigatória/);
 assert.match(signup,/required=\{whatsappConsent\}/);
 assert.match(premium,/Recursos Pro do perfil único de cantor/);
 assert.match(premium,/a publicação das opções pagas exige autorização da conta/);
 assert.match(premium,/a cobrança ainda não estão ativados/);
});

test("plans keep core Stage Flow free and singer Pro gated without checkout",()=>{
 const plans=load("app/planos/page.tsx");
 const publish=load("app/meu-perfil-artistico/site-profissional/pro-publish-controls.tsx");
 assert.match(plans,/Músicos podem entrar sem convite/);
 assert.match(plans,/R\$ 0/);
 assert.match(plans,/Cantor Pro/);
 assert.match(plans,/Valores a definir/);
 assert.match(plans,/Subdomínio personalizado incluído no plano/);
 assert.match(plans,/Não há checkout, assinatura automática/);
 assert.match(publish,/ProFeatureLock title="Personalização Pro do perfil"/);
 assert.match(publish,/!info.entitled/);
});

test("signed-in musicians open invitation links without seeing a second signup form",()=>{
 const signup=load("app/cadastro/page.tsx");
 assert.match(signup,/const \[checkingSession, setCheckingSession\] = useState\(true\)/);
 assert.match(signup,/auth\.getUser\(\)/);
 assert.ok(signup.includes('window.location.replace(code'));
 assert.ok(signup.includes('"/convite?codigo=" + encodeURIComponent(code)'));
 assert.ok(signup.includes('if (checkingSession) return'));
 assert.match(signup,/Verificando sua sessão do Stage Flow/);
});

test("temporary auth errors in invitation inbox do not silently sign out musicians",()=>{
 const invites=load("app/meus-convites/page.tsx");
 assert.ok(invites.includes("if (authError) {"));
 assert.ok(invites.includes("await supabase.auth.getSession()"));
 assert.ok(invites.includes("if (session) {"));
 assert.ok(invites.includes("Sua conta não foi desconectada"));
 assert.ok(invites.includes("setWhatsappLoading(false)"));
 assert.doesNotMatch(invites,/auth\.signOut\(/);
});

test("new application routes are reserved for singer usernames in both frontend and SQL",()=>{
 const signup=load("app/cadastro/page.tsx");
 const migration=load("supabase/artist_reserved_route_slugs_migration.sql");
 const routes=[
  "assinatura","conversas","financeiro","homologacao","locais",
  "meu-desempenho","meus-shows","minha-disponibilidade",
  "notificacoes","parceiros","pro","shows-recorrentes"
 ];
 for(const route of routes){
  assert.ok(signup.includes('"'+route+'"'),"signup lacks reserved slug "+route);
  assert.ok(migration.includes("'"+route+"'"),"database lacks reserved slug "+route);
 }
 assert.match(migration,/stage_protect_reserved_artist_usernames/);
 assert.match(migration,/before insert or update of username on public\.profiles/);
});
