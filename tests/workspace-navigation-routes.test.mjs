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
test("public, authentication, admin and the dashboard do not receive a second private frame title", () => {
  for (const path of ["/", "/login", "/cadastro", "/convite", "/painel", "/artista/sousa",
    "/musico/sousa", "/sousa", "/casa/deck", "/pro/sousa", "/admin/central", "/api/asaas/webhook"]) {
    assert.equal(workspaceRouteTitle(path), null, path);
  }
});
test("root preserves server layout, private frame is deferred and role reads stay owner-scoped", () => {
  const layout = read("app/layout.tsx");
  const boundary = read("src/domains/navigation/components/workspace-boundary.tsx");
  const hook = read("src/domains/navigation/hooks/use-workspace-role.ts");
  const store = read("src/domains/account/account-store.ts");
  const root = read("src/domains/navigation/components/workspace-root.tsx");
  assert.doesNotMatch(layout, /use client/);
  assert.match(layout, /<WorkspaceBoundary>\{children\}<\/WorkspaceBoundary>/);
  assert.match(boundary, /dynamic\(\(\) => import/);
  assert.match(boundary, /<WorkspaceRoot title=/);
  assert.match(boundary, /path !== "\/marketplace"/);
  assert.match(root, /<AccountProvider><PrivateAccountBoundary>/);
  assert.match(store, /\.eq\("id", user.id\)/);
  assert.match(store, /Promise.all/);
  assert.match(store, /subscription.unsubscribe\(\)/);
  assert.doesNotMatch(hook, /signOut\(|router.replace|localStorage|user_metadata/);
  assert.match(store, /onAuthStateChange\(\(event, session\) =>/);
  assert.match(hook, /useAccount/);
  assert.doesNotMatch(hook, /getUser|\.from\(|\.rpc\(/);
});
