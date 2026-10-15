import { redirect } from "next/navigation";

// Rota anterior mantida apenas por compatibilidade.
// O perfil gratuito canônico do artista é /@sem-o-arroba: /cantorsousa.
// A experiência de site completo com subdomínio será uma opção paga,
// implementada separadamente e autorizada no servidor.
export default async function OldArtistPage({ params }: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  redirect("/" + encodeURIComponent(username));
}
