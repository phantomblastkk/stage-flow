import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const signup = readFileSync(resolve(process.cwd(), "app/cadastro/page.tsx"), "utf8");

test("singer signup handles database failures without exposing raw English error", () => {
  assert.match(signup, /signUpError\.status === 500/);
  assert.match(signup, /signUpError\.code === "unexpected_failure"/);
  assert.match(signup, /signUpError\.code === "user_already_exists"/);
  assert.match(signup, /user already \(\?:registered\|exists\)/);
  assert.match(signup, /Este usuário já existe\. Use Entrar/);
  assert.match(signup, /username: null/);
  assert.match(signup, /if \(databaseSignupFailure\) \{/);
  assert.match(signup, /O cadastro não pôde ser salvo no momento/);
});

test("account creation never requires an artistic username before onboarding", () => {
  assert.match(signup, /username: null/);
  assert.match(signup, /O perfil.*@|@ ficam para depois/i);
});
