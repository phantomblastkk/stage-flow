// Build-artifact measurement, not a browser timing or a prediction of CDN transfer sizes.
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {gzipSync} from "node:zlib";
import {resolve} from "node:path";
const build=resolve(process.argv[2]||".next");
const manifest=JSON.parse(readFileSync(resolve(build,"app-build-manifest.json"),"utf8"));
const loadable=JSON.parse(readFileSync(resolve(build,"react-loadable-manifest.json"),"utf8"));
const sizes=new Map();
function size(file){
 if(!sizes.has(file)){const bytes=readFileSync(resolve(build,file));sizes.set(file,{bytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length});}
 return sizes.get(file);
}
function total(files){return files.reduce((sum,file)=>{const s=size(file);return {bytes:sum.bytes+s.bytes,gzipBytes:sum.gzipBytes+s.gzipBytes};},{bytes:0,gzipBytes:0});}
const routes={};
for(const [entry,files] of Object.entries(manifest.pages).sort(([a],[b])=>a.localeCompare(b))){
 if(!entry.endsWith("/page"))continue;
 const layouts=Object.entries(manifest.pages).filter(([key])=>key.endsWith("/layout")&&(key==="/layout"||entry.startsWith(key.slice(0,-7)+"/"))).flatMap(([,assets])=>assets);
 const assets=[...new Set([...layouts,...files])];
 const js=assets.filter(file=>file.endsWith(".js")),css=assets.filter(file=>file.endsWith(".css"));
 routes[entry.slice(0,-5)||"/"]={js:{...total(js),files:js},css:{...total(css),files:css}};
}
const deferredModules=Object.fromEntries(Object.entries(loadable).filter(([key])=>/event-team-invites|event-budget-panel/.test(key)).map(([key,value])=>[key,{...total(value.files),files:value.files}]));
console.log(JSON.stringify({revision:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),nextVersion:JSON.parse(readFileSync("node_modules/next/package.json","utf8")).version,method:"Unique route + ancestor layout assets in app-build-manifest. Per-file gzip level 9, summed. Excludes runtime-mounted lazy chunks, RSC payloads, images, API, browser cache and timings. Route totals cannot be added together because assets are shared.",routes,deferredModules},null,2));
