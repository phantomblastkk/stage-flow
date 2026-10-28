import { redirect } from "next/navigation";

// An editor for the same singer profile: keep old bookmarks working.
// Public singer and Pro content always share /username.
export default function LegacyProfessionalEditor() {
  redirect("/perfil-artistico?aba=midia");
}
