import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const get=p=>readFileSync(resolve(process.cwd(),p),"utf8");
test("single artist page provides thumb-friendly editing shortcuts and explicit save button",()=>{
 const artist=get("components/artist-profile-editor.tsx");
 assert.ok(artist.includes('formId="artist-main-form"'));
 assert.ok(artist.includes('id="artist-main-form"'));
 for(const id of ["artist-edit-photo","artist-edit-bio","artist-edit-publicacao","artist-edit-booking"])
  assert.ok(artist.includes('id="'+id+'"'));
});
test("musician editor uses in-page sections without creating a second identity or changing publishing rights",()=>{
 const edit=get("components/instrumentalist-profile-editor.tsx");
 for(const id of ["mp-aparencia","mp-fotos","mp-instrumentos","mp-trajetoria","mp-midias","mp-cache","mp-publicacao"])
  assert.ok(edit.includes('id="'+id+'"'));
 assert.ok(edit.includes('formId="musician-portfolio-form"'));
 assert.ok(edit.includes('unifiedSinger?"Publicar informações de músico"'));
 assert.ok(edit.includes('!unifiedSinger&&'));
 assert.ok(get("app/meu-portfolio/musician-portfolio-editor.css").includes("scroll-margin-top:90px"));
});

test("the actual mobile wizard hides inactive sections only on small screens",()=>{
 const singerCss=get("app/meu-perfil-artistico/singer-unified-editor.css");
 const musicianCss=get("app/meu-portfolio/musician-portfolio-editor.css");
 assert.ok(singerCss.includes('.artist-wizard-mode [data-editor-step]{display:none!important}'));
 assert.ok(singerCss.includes('.artist-wizard-mode[data-editor-active="3"] .artist-wizard-extras'));
 assert.ok(musicianCss.includes('.mp-editor-workspace [data-editor-step]{display:none!important}'));
 assert.ok(musicianCss.includes('.mp-editor-workspace[data-editor-active="4"] [data-editor-step="4"]'));
});

test("fast mobile edits never reset the previously selected group or venue kind",()=>{
 const profiles=get("app/perfis/page.tsx");
 assert.ok(profiles.includes("setForm(previous=>({...previous,[key]:value}))"));
 assert.ok(profiles.includes('setForm(previous=>({...previous,kind,musical_type:kind==="group"?"Grupo de Pagode":"Cantor"}))'));
 assert.ok(!profiles.includes("onChange={e=>setForm({...form,"));
 for(const field of ["name","city","bio","members","musical_type","producerConsent","is_public"])
  assert.ok(profiles.includes('updateForm("'+field+'",e.currentTarget.'),"missing "+field);
 assert.ok(profiles.includes('"stage_save_performance_profile"'));
 assert.ok(profiles.includes('data?.status==="producer_required"'));
});
