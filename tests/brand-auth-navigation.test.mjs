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
  assert.match(login,/window\.location\.replace\("\/painel"\)/);
  assert.match(login,/if\(code\)\{setCheckingSession\(false\);return;\}/);
  assert.match(login,/signInWithPassword/);
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
