import {redirect} from "next/navigation";
export default async function LegacyArtistEditor({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const params=await searchParams;redirect("/perfil-artistico"+(params.aba==="pro"?"?aba=midia":""));
}
