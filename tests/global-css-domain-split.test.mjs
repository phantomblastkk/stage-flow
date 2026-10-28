import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const load = path => readFileSync(resolve(process.cwd(), path), "utf8");
const segments = [
  ["app/globals.css", 'import "./globals.css";'],
  ["src/domains/auth/styles/legacy-auth-forms.css", 'import "@/src/domains/auth/styles/legacy-auth-forms.css";'],
  ["app/styles/legacy-base-responsive.css", 'import "./styles/legacy-base-responsive.css";'],
  ["src/domains/artists/styles/legacy-musician-portfolio.css", 'import "@/src/domains/artists/styles/legacy-musician-portfolio.css";'],
  ["app/styles/legacy-global-tail.css", 'import "./styles/legacy-global-tail.css";'],
  ["src/domains/artists/styles/legacy-free-singer.css", 'import "@/src/domains/artists/styles/legacy-free-singer.css";'],
  ["src/domains/auth/styles/legacy-signup-roles.css", 'import "@/src/domains/auth/styles/legacy-signup-roles.css";'],
  ["app/styles/legacy-after-free-singer.css", 'import "./styles/legacy-after-free-singer.css";']
];
const css = Object.fromEntries(segments.map(([path]) => [path, load(path)]));
const hash = value => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619) >>> 0;
  return result.toString(16).padStart(8, "0");
};

test("eight CSS imports exactly preserve their original cascade and content", () => {
  const layout = load("app/layout.tsx");
  const positions = segments.map(([, statement]) => layout.indexOf(statement));
  assert.ok(positions.every(position => position >= 0), "Every CSS segment needs an import");
  assert.ok(positions.every((position, index) => index === 0 || position > positions[index - 1]),
    "Changing CSS import order changes cascade priority");
  for (const [, statement] of segments)
    assert.equal(layout.split(statement).length - 1, 1, "Import each stylesheet exactly once");
  const recomposed = segments.map(([path]) => css[path]).join("");
  assert.equal(recomposed.length, 48480, "No rule or whitespace should be lost from the original");
  assert.equal(hash(recomposed), "eee026ce", "Original global CSS content must be preserved exactly");
});

test("authentication and signup rules are scoped to the auth domain while responsive overrides remain", () => {
  const foundation = css[segments[0][0]];
  const auth = css[segments[1][0]];
  const responsive = css[segments[2][0]];
  const signup = css[segments[6][0]];
  const later = css[segments[7][0]];
  assert.match(foundation, /--accent-solid:#7142D8/);
  assert.doesNotMatch(foundation, /\.auth-aside\{/);
  for (const selector of [".auth-wrap", ".auth-aside", ".auth-main", ".auth-card", ".field-help", ".auth-bottom", ".coming"])
    assert.ok(auth.includes(selector), "Auth selector missing: " + selector);
  assert.match(responsive, /@media\(max-width:800px\)/);
  assert.match(responsive, /@media\(max-width:480px\)/);
  assert.match(responsive, /\.auth-wrap\{grid-template-columns:1fr\}/);
  for (const selector of [".signup-role-picker", ".signup-role-grid", ".signup-role-card", ".signup-producer-add"])
    assert.ok(signup.includes(selector), "Signup selector missing: " + selector);
  assert.doesNotMatch(later, /\.signup-role-card\{\s*appearance:/);
  assert.match(later, /\.signup-role-card\{min-height:132px\}/);
  assert.match(later, /\.auth-main/);
  assert.match(later, /\.artist-mobile-edit-steps/);
  assert.match(later, /\.home-verified-artists/);
});

test("musician theme classes, free singer media queries and later overrides stay intact", () => {
  const musician = css[segments[3][0]];
  const home = css[segments[4][0]];
  const singer = css[segments[5][0]];
  const later = css[segments[7][0]];
  for (const selector of [".mp-shell", ".mp-shell.mp-theme-ivory", ".mp-shell.mp-theme-stage",
    ".mp-layout-minimal", ".mp-hero", ".mp-identity"])
    assert.ok(musician.includes(selector), "Dynamic musician selector missing: " + selector);
  assert.match(home, /Landing page Stage Flow 2026/);
  for (const selector of [".artist-free-page", ".artist-free-hero", ".artist-free-overline",
    ".artist-free-monogram", ".artist-free-intro", ".artist-free-handle",
    ".artist-free-tagline", ".artist-free-content", ".artist-free-socials",
    ".artist-free-events", ".artist-free-event", ".artist-free-event-date",
    ".artist-free-footer", ".artist-free-cover-photo", ".artist-free-photo-fields"])
    assert.ok(singer.includes(selector), "Free singer selector missing: " + selector);
  assert.match(singer, /@media\(max-width:750px\)/);
  assert.match(singer, /@media\(max-width:620px\)/);
  assert.match(later, /\.mp-editor-stickybar/);
});
