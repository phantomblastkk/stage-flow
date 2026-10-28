import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const get=p=>readFileSync(resolve(process.cwd(),p),"utf8");
test("single artist page provides thumb-friendly editing shortcuts and explicit save button",()=>{
 const artist=get("components/artist-profile-editor.tsx");
 assert.ok(artist.includes('form="artist-main-form"'));
 assert.ok(artist.includes('id="artist-main-form"'));
 for(const id of ["artist-edit-photo","artist-edit-bio","artist-edit-publicacao","artist-edit-booking"])
  assert.ok(artist.includes('id="'+id+'"'));
});
test("musician editor uses in-page sections without creating a second identity or changing publishing rights",()=>{
 const edit=get("components/instrumentalist-profile-editor.tsx");
 for(const id of ["mp-aparencia","mp-fotos","mp-instrumentos","mp-trajetoria","mp-midias","mp-cache","mp-publicacao"])
  assert.ok(edit.includes('id="'+id+'"'));
 assert.ok(edit.includes('form="musician-portfolio-form"'));
 assert.ok(edit.includes('unifiedSinger?"Publicar informações de músico"'));
 assert.ok(edit.includes('!unifiedSinger&&'));
 assert.ok(get("app/meu-portfolio/musician-portfolio-editor.css").includes("scroll-margin-top:90px"));
});
