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
  assert.match(signup, /artistKind === "lead" && !inviteCode && cleanUsername/);
  assert.match(signup, /Este usuário já existe ou o @ artístico informado está em uso/);
  assert.match(signup, /if \(databaseSignupFailure\) \{/);
  assert.match(signup, /O cadastro não pôde ser salvo no momento/);
});

test("unique username enforcement remains in the signup metadata", () => {
  assert.match(signup, /reservedArtistUsernames\.has\(cleanUsername\)/);
  assert.match(signup, /username: inviteCode \? null : artistKind === "lead" \? cleanUsername : null/);
});
