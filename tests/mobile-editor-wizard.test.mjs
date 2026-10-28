import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=p=>readFileSync(resolve(process.cwd(),p),"utf8");
const component=read("components/mobile-editor-wizard.tsx");
const css=read("components/mobile-editor-wizard.css");
const singer=read("components/artist-profile-editor.tsx");
const musician=read("components/instrumentalist-profile-editor.tsx");

test("wizard is mobile-only, accessible and submits without discarding previous fields",()=>{
 assert.ok(css.includes(".sf-editor-wizard{display:none}"));
 assert.ok(css.includes("@media(max-width:850px)"));
 assert.ok(component.includes('aria-current={step.value===active?"step":undefined}'));
 assert.ok(component.includes("aria-valuenow={index+1}"));
 assert.ok(component.includes("form.requestSubmit()"));
 assert.ok(component.includes('invalid.closest<HTMLElement>("[data-editor-step]")'));
 assert.ok(component.includes("invalid.reportValidity()"));
 assert.ok(component.includes("As alterações só são gravadas quando você toca em"));
});
test("singer has four steps, preserves form and canonical booking path",()=>{
 for(const n of [0,1,2,3])assert.ok(singer.includes('data-editor-step="'+n+'"'));
 assert.ok(singer.includes('data-editor-active={mobileStep}'));
 assert.ok(singer.includes('saveDisabled={published&&!config.username}'));
 assert.ok(singer.includes('formId="artist-main-form"'));
 assert.ok(singer.includes('id="artist-main-form"'));
 assert.ok(singer.includes('id="artist-edit-booking"'));
 assert.ok(singer.includes('className="artist-wizard-preview"'));
});
test("musician has five step groups or four for the unified singer",()=>{
 for(const [id,n] of [["mp-aparencia",0],["mp-fotos",0],["mp-instrumentos",1],
 ["mp-trajetoria",2],["mp-midias",3],["mp-cache",4],["mp-publicacao",4]])
  assert.ok(musician.includes('id="'+id+'" data-editor-step="'+n+'"'));
 assert.ok(musician.includes("useState(unifiedSinger?1:0)"));
 assert.ok(musician.includes("required={!unifiedSinger}"));
 assert.ok(musician.includes('data-editor-step="4" className="mp-marketplace-wizard-setting"'));
 assert.ok(musician.includes('formId="musician-portfolio-form"'));
 assert.ok(musician.includes('unifiedSinger?"Publicar informações de músico"'));
});
