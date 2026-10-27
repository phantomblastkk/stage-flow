import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

// Transpile pure local TS modules in memory; resolve runtime imports without app/browser aliases.
function moduleUrl(path, cache) {
  if (cache.has(path)) return cache.get(path);
  let code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const ast = ts.createSourceFile(path, code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS), edits = [];
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const name = node.moduleSpecifier.text;
    if (!name.startsWith(".")) throw Error("Only pure relative imports are supported: " + name);
    const target = resolve(dirname(path), name.endsWith(".ts") ? name : name + ".ts");
    edits.push({ start: node.moduleSpecifier.getStart(ast), end: node.moduleSpecifier.end, value: JSON.stringify(moduleUrl(target, cache)) });
  }
  for (const edit of edits.reverse()) code = code.slice(0, edit.start) + edit.value + code.slice(edit.end);
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  cache.set(path, url);return url;
}
export function loadTsModule(path) { return import(moduleUrl(resolve(path), new Map())); }
