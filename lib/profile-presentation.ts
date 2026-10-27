// Keeps the short signature and long-form biography as distinct public content.
// Editing a biography to repeat the signature must not echo the same words
// throughout the hero and About section.
export function normalizeProfileCopy(value: string | null | undefined): string {
  return (value || "").normalize("NFKC").trim()
    .replace(/[“”„"‘’']/g, "")
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/[.!?…;:]+$/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function distinctPublicBiography(
  signature: string | null | undefined,
  biography: string | null | undefined
): string {
  const text = (biography || "").trim();
  return normalizeProfileCopy(text) === normalizeProfileCopy(signature) ? "" : text;
}
