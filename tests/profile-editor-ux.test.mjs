import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read = path=>readFileSync(resolve(process.cwd(),path),"utf8");
const artist=read("components/artist-profile-editor.tsx");
const musician=read("components/instrumentalist-profile-editor.tsx");
const hook=read("src/domains/artists/hooks/use-session-profile-draft.ts");
const banner=read("src/domains/artists/components/profile-draft-banner.tsx");

test("draft recovery is limited to the current account and tab; no automatic RPC publication",()=>{
 assert.match(artist,/sf:artist:tabdraft:v1:.*draftOwner/);
 assert.match(musician,/sf:musician:tabdraft:v1:.*draftOwner/);
 assert.match(hook,/window\.sessionStorage\.setItem/);
 assert.match(hook,/window\.sessionStorage\.getItem/);
 assert.doesNotMatch(hook,/localStorage|supabase|\.rpc\(|\.from\(/i);
 assert.match(hook,/expiresAt:Date\.now\(\)\+HOURS_24/);
 assert.match(hook,/if\(serialized.length>16000\)/);
 assert.match(hook,/setPending\(\{key,value:entry.value as T\}\)/);
 assert.match(banner,/Recuperar rascunho/);
 assert.match(banner,/Descartar/);
 assert.match(banner,/seu perfil publicado não foi alterado/i);
});

test("publication is still explicit and only the account save clears the temporary draft",()=>{
 assert.match(artist,/p_is_public: published/);
 assert.match(musician,/p_is_published: portfolio\.is_published/);
 assert.match(artist,/draft\.savedToAccount\(\)/);
 assert.match(musician,/draft\.savedToAccount\(\)/);
 assert.match(artist,/type="submit" loading=\{saving\}/);
 assert.match(musician,/type="submit" loading=\{saving\}/);
 assert.doesNotMatch(hook,/is_published|is_public|whatsapp/i);
});

test("simple editing highlights essentials and keeps appearance optional",()=>{
 assert.match(artist,/<details className="sf-editor-extra"><summary>Personalização opcional: frase e cores<\/summary>/);
 assert.match(musician,/<details className="sf-editor-extra"><summary>Aparência avançada \(opcional\)<\/summary>/);
 assert.match(musician,/<details className="sf-editor-extra"><summary>Adicionar vídeo principal \(opcional\)<\/summary>/);
 assert.match(musician,/Pré-visualizar perfil antes de publicar/);
 assert.match(artist,/sf-editor-publication-explain/);
 assert.match(musician,/sf-editor-publication-explain/);
});

test("restoring typed fields cannot inject published flags or replace profile ownership",()=>{
 assert.match(artist,/if\(typeof value\.bio==="string"\)/);
 assert.match(musician,/setPortfolio\(previous=>\(\{\.\.\.previous,/);
 assert.doesNotMatch(musician,/is_published:\s*value\./);
 assert.doesNotMatch(artist,/setPublished\(value\./);
});
