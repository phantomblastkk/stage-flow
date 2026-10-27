import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("src/domains/navigation/workspace-routes.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { workspaceRouteTitle, workspaceRoutes } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("all opted-in work routes and nested screens resolve without changing URLs", () => {
  for (const [route, title] of workspaceRoutes) {
    assert.equal(workspaceRouteTitle(route), title);
    assert.equal(workspaceRouteTitle(route + "/detalhes"), title);
    assert.equal(workspaceRouteTitle(route + "-publico"), null);
  }
});
test("public, authentication, admin and self-contained dashboard never mount workspace", () => {
  for (const path of ["/", "/login", "/cadastro", "/convite", "/painel", "/artista/sousa",
    "/musico/sousa", "/sousa", "/casa/deck", "/pro/sousa", "/admin/central", "/api/asaas/webhook"]) {
    assert.equal(workspaceRouteTitle(path), null, path);
  }
});
test("root preserves server layout, private frame is deferred and role reads stay owner-scoped", () => {
  const layout = read("app/layout.tsx");
  const boundary = read("src/domains/navigation/components/workspace-boundary.tsx");
  const hook = read("src/domains/navigation/hooks/use-workspace-role.ts");
  assert.doesNotMatch(layout, /use client/);
  assert.match(layout, /<WorkspaceBoundary>\{children\}<\/WorkspaceBoundary>/);
  assert.match(boundary, /dynamic\(\(\) => import/);
  assert.match(boundary, /title \? <WorkspaceFrame/);
  assert.match(hook, /\.eq\("id", user.id\)/);
  assert.match(hook, /Promise.all/);
  assert.match(hook, /subscription.unsubscribe\(\)/);
  assert.doesNotMatch(hook, /signOut\(|router.replace|localStorage|user_metadata/);
  assert.match(hook, /onAuthStateChange\(\(event, session\) =>/);
});
