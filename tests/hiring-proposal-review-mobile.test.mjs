import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const component=readFileSync(resolve(process.cwd(),"components/hiring-proposals.tsx"),"utf8");
const browser=readFileSync(resolve(process.cwd(),"tests/browser/agenda-finance.mjs"),"utf8");

test("mobile proposal requires a deliberate review before any network send",()=>{
 assert.match(component,/if\(!reviewing\)\{e\.preventDefault\(\);return;\}void submit\(e\)/);
 assert.match(component,/Revisar proposta/);
 assert.match(component,/Confirmar e enviar proposta/);
 assert.match(component,/Voltar e editar/);
});

test("required controls unmount in review step, preventing hidden native-validation traps",()=>{
 assert.match(component,/\{!reviewing&&<div className="hiring-proposals-step">/);
 assert.doesNotMatch(component,/<div className="hiring-proposals-step" hidden=\{reviewing\}>/);
 assert.match(component,/\{reviewing&&<section className="hiring-proposals-review"/);
 assert.match(component,/form\?\.reportValidity\(\)/);
});

test("the review validates dates and Brazilian currency, formats the same date as the proposal",()=>{
 assert.match(component,/parseProposalFee\(fee\)===undefined/);
 assert.match(component,/date\.getTime\(\)<=Date\.now\(\)/);
 assert.match(component,/new Date\(starts\+"-03:00"\)/);
 assert.match(component,/formatFee\(parseProposalFee\(fee\)\?\?null\)/);
 assert.match(component,/role="alert">\{reviewError\}/);
 assert.match(component,/hiring-proposal-inline-error/);
});

test("browser integration exercises first conflict, edit, and then confirmation on the mobile flow",()=>{
 const anchor=browser.slice(browser.indexOf("formal proposal form 360"),browser.indexOf("formal proposal editor 360"));
 assert.match(anchor,/Revisar proposta/);
 assert.match(anchor,/Confirmar e enviar proposta/);
 assert.match(anchor,/Voltar e editar/);
 assert.match(anchor,/Meu rascunho preservado/);
 assert.match(anchor,/compromisso confirmado/);
});
