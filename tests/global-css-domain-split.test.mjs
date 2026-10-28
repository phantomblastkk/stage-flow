import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const load = path => readFileSync(resolve(process.cwd(), path), "utf8");
const paths = [
  "app/globals.css",
  "src/domains/artists/styles/legacy-musician-portfolio.css",
  "app/styles/legacy-global-tail.css",
  "src/domains/artists/styles/legacy-free-singer.css",
  "app/styles/legacy-after-free-singer.css"
];

test("all five CSS segments preserve their original cascade order", () => {
  const layout = load("app/layout.tsx");
  const imports = [
    'import "./globals.css";',
    'import "@/src/domains/artists/styles/legacy-musician-portfolio.css";',
    'import "./styles/legacy-global-tail.css";',
    'import "@/src/domains/artists/styles/legacy-free-singer.css";',
    'import "./styles/legacy-after-free-singer.css";'
  ];
  const positions = imports.map(value => layout.indexOf(value));
  assert.ok(positions.every(position => position >= 0), "All stylesheet imports must be present");
  assert.ok(positions.every((position, index) => index === 0 || position > positions[index - 1]),
    "CSS import order controls legacy cascade precedence");
  for (const value of imports)
    assert.equal(layout.split(value).length - 1, 1, "Each stylesheet is imported once");
  for (const path of paths) assert.ok(load(path).length > 100, "CSS must not be empty: " + path);
});

test("dynamic musician themes stay in the musician domain stylesheet", () => {
  const foundation = load(paths[0]), musician = load(paths[1]), publicHome = load(paths[2]);
  assert.match(foundation, /--accent-solid:#7142D8/);
  assert.doesNotMatch(foundation, /\.mp-shell\.mp-theme-ivory/);
  for (const selector of [
    ".mp-shell", ".mp-shell.mp-theme-ivory", ".mp-shell.mp-theme-stage",
    ".mp-layout-minimal", ".mp-hero", ".mp-identity"
  ]) assert.ok(musician.includes(selector), "Retain dynamic musician selector " + selector);
  assert.match(publicHome, /Landing page Stage Flow 2026/);
});

test("singer free profile styles remain complete and precede late overrides", () => {
  const free = load(paths[3]), late = load(paths[4]);
  for (const selector of [
    ".artist-free-page", ".artist-free-hero", ".artist-free-overline",
    ".artist-free-monogram", ".artist-free-intro", ".artist-free-handle",
    ".artist-free-tagline", ".artist-free-content", ".artist-free-socials",
    ".artist-free-events", ".artist-free-event", ".artist-free-event-date",
    ".artist-free-footer", ".artist-free-cover-photo", ".artist-free-photo-fields"
  ]) assert.ok(free.includes(selector), "Retain free singer selector " + selector);
  assert.match(free, /@media\(max-width:750px\)/);
  assert.match(free, /@media\(max-width:620px\)/);
  assert.doesNotMatch(free, /\.signup-role-card/);
  assert.match(late, /\.signup-role-card/);
  assert.match(late, /\.artist-mobile-edit-steps/);
  assert.match(late, /\.home-verified-artists/);
  assert.match(late, /\.mp-editor-stickybar/);
});
