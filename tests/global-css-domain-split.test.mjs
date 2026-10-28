import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const load = path => readFileSync(resolve(process.cwd(), path), "utf8");

test("legacy global styles load in the original cascade order", () => {
  const layout = load("app/layout.tsx");
  const imports = [
    'import "./globals.css";',
    'import "@/src/domains/artists/styles/legacy-musician-portfolio.css";',
    'import "./styles/legacy-global-tail.css";'
  ];
  const positions = imports.map(value => layout.indexOf(value));
  assert.ok(positions.every(position => position >= 0), "All stylesheet imports must be present");
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2],
    "Changing import order changes CSS cascade priority");
  for (const value of imports) assert.equal(layout.split(value).length - 1, 1,
    "Each CSS source is imported exactly once");
});

test("musician portfolio themes and layouts remain separate from global foundation", () => {
  const base = load("app/globals.css");
  const musician = load("src/domains/artists/styles/legacy-musician-portfolio.css");
  const tail = load("app/styles/legacy-global-tail.css");
  assert.match(base, /--accent-solid:#7142D8/);
  assert.doesNotMatch(base, /\.mp-shell\.mp-theme-ivory/);
  for (const selector of [
    ".mp-shell", ".mp-shell.mp-theme-ivory", ".mp-shell.mp-theme-stage",
    ".mp-layout-minimal", ".mp-hero", ".mp-identity"
  ]) assert.ok(musician.includes(selector), "Keep dynamic portfolio class " + selector);
  assert.match(tail, /Landing page Stage Flow 2026/);
  assert.match(tail, /\.signup-role-card/);
  assert.match(tail, /\.artist-free-hero/);
  assert.match(tail, /\.home-verified-artists/);
  // Later legacy refinements intentionally stay after the musician stylesheet.
  assert.match(tail, /\.mp-editor-stickybar/);
});
