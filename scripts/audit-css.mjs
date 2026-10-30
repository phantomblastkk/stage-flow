// Read-only inventory. Repeated blocks are candidates, not proof that selectors can be merged.
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
const files=execFileSync("git",["ls-files","--","*.css"],{encoding:"utf8"}).trim().split("\n").filter(Boolean).sort();
const base=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const groups=new Map();
function category(path){
 if(path.includes("legacy-"))return "Legado — migração gradual";
 if(path==="src/components/ui/tokens.css")return "Design System";
 if(path==="app/globals.css")return "Global — revisar cascata";
 if(path.startsWith("src/domains/"))return "Domínio";
 if(path.startsWith("components/"))return "Componente";
 return "Rota";
}
const rows=files.map(path=>{
 const content=readFileSync(path,"utf8"),clean=content.replace(/\/\*[\s\S]*?\*\//g,"");
 let blocks=0;
 for(const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  if(match[1].trim().startsWith("@"))continue;
  blocks++;
  const declarations=match[2].split(";").map(x=>x.trim().replace(/\s+/g," ")).filter(Boolean);
  if(declarations.length<3)continue;
  // Preserve declaration order: fallbacks and overrides may depend on it.
  const key=declarations.join(";");
  const matches=groups.get(key)||[];matches.push({path,selector:match[1].trim().replace(/\s+/g," ")});groups.set(key,matches);
 }
 return {path,category:category(path),bytes:Buffer.byteLength(content),lines:content.split("\n").length-Number(content.endsWith("\n")),blocks};
});
console.log("# Inventário CSS — StageFlow\n");
console.log(`Base Git: \`${base}\`. Conteúdo lido da árvore de trabalho; execute após as edições para comparar.\n`);
console.log(`${files.length} arquivos rastreados; ${rows.reduce((n,r)=>n+r.bytes,0)} bytes de fonte CSS (sem minificação/compressão).\n`);
console.log("Gerar novamente: `node scripts/audit-css.mjs`. Contagem de blocos é heurística; não mede CSS efetivamente usado, especificidade ou bundle.\n");
console.log("| Arquivo | Grupo | Linhas | Bytes | Blocos |\n| --- | --- | ---: | ---: | ---: |");
for(const r of rows)console.log(`| \`${r.path}\` | ${r.category} | ${r.lines} | ${r.bytes} | ${r.blocks} |`);
const repeated=[...groups.entries()].filter(([,matches])=>new Set(matches.map(x=>x.path)).size>1).sort((a,b)=>b[1].length-a[1].length);
console.log(`\n## Candidatos a repetição\n\n${repeated.length} blocos idênticos com três ou mais declarações em arquivos diferentes. A extração exige revisão dos seletores e contextos responsivos. Abaixo, até 12 grupos mais frequentes.\n`);
for(const [declarations,matches] of repeated.slice(0,12)){
 console.log(`- \`${declarations.replaceAll("`","")}\``);
 for(const m of matches)console.log(`  - \`${m.path}\` — \`${m.selector.replaceAll("`","")}\``);
}
console.log("\n## Prioridades de migração\n\n1. Formulários públicos de contratação e denúncias: campos, botões e feedback compartilhados (Parte 45).\n2. Moderação e administração: controles e avisos próprios; conferir autorização, carregamento e ações antes de migrar.\n3. Cascata global e arquivos legacy: mapear importações e seletores consumidos antes de remover regras.\n4. Cards/listas de casas e operação: manter layout de domínio e substituir somente os padrões comuns demonstrados.\n\nNão eliminar folhas apenas para reduzir a quantidade de arquivos. Layouts de domínio e temas públicos continuam tendo estilos próprios.\n");
