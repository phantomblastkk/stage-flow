import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadTsModule} from "./helpers/load-ts-module.mjs";
const {operationalSummary,greeting}=await loadTsModule("src/domains/dashboard/model/operational-summary.ts");
const now=new Date("2026-11-01T01:00:00Z"); // Still October in São Paulo.
const own={event_id:"own",title:"Own",starts_at:"2026-11-01T01:00:00Z",event_status:"published",gross_revenue:1000.10,received:300.10,expense_total:0,expense_paid:0,musician_agreed:0,musician_paid:0,musician_unpriced:0};
const guest={kind:"participation",record_id:"invite",event_id:"guest",title:"Guest",starts_at:"2026-11-01T02:00:00Z",event_status:"published",personal_fee:500.50,personal_received:100.20,personal_expenses:0};
test("home month uses São Paulo boundaries, exact cents, and deduplicates own participation",()=>{
 const summary=operationalSummary([own],[guest,{...guest,event_id:"own"}],now);
 assert.equal(summary.month.gross,150060);assert.equal(summary.month.received,40030);assert.equal(summary.all.pendingReceivables,110030);
 assert.equal(summary.month.visibleOwner.length+summary.month.visibleMusician.length,2);
 assert.equal(summary.upcoming.length,2);assert.equal(summary.recent.length,2);
});
test("cancelled shows never appear as receipts or pending payments and missing amounts remain partial",()=>{
 const result=operationalSummary([{...own,event_status:"cancelled"}],[{...guest,personal_fee:null}],now);
 assert.equal(result.all.gross,0);assert.equal(result.all.incomplete,true);assert.equal(result.upcoming.length,0);assert.equal(result.recent.length,1);
});
test("greeting follows Brazil local time independently of the execution host",()=>{
 assert.equal(greeting(new Date("2026-10-28T02:00:00Z")),"Boa noite");
 assert.equal(greeting(new Date("2026-10-28T05:00:00Z")),"Boa noite");
 assert.equal(greeting(new Date("2026-10-28T13:00:00Z")),"Bom dia");
 assert.equal(greeting(new Date("2026-10-28T18:00:00Z")),"Boa tarde");
});
test("legacy profile bookmarks redirect while the original editors and their RPCs stay available",()=>{
 const read=p=>readFileSync(p,"utf8");
 assert.match(read("app/meu-perfil-artistico/page.tsx"),/redirect\("\/perfil-artistico"/);
 assert.match(read("app/meu-portfolio/page.tsx"),/redirect\("\/perfil-artistico\?aba=instrumentista"/);
 assert.match(read("components/artist-profile-editor.tsx"),/stage_save_artist_page_v2/);
 assert.match(read("components/instrumentalist-profile-editor.tsx"),/stage_save_musician_portfolio/);
 const nav=read("src/domains/navigation/workspace-navigation.ts");
 for(const title of ["Marketplace","Financeiro","Perfil Artístico"])assert.ok(nav.includes('title:"'+title+'"'));
 assert.doesNotMatch(nav,/Site Pro|title:"Negócios"/);
});
