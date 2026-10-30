"use client";
import Link from "next/link";
import {useAccount} from "../../account/account-context";
import {useDashboardArtistData} from "./dashboard-artist-data";
export default function ProfileReadiness(){
 const {snapshot:{profile}}=useAccount();
 const snapshots=useDashboardArtistData();
 const data=(profile?.is_singer?snapshots.singer:snapshots.musician).data;
 const fields=data?[Boolean(data.name?.trim()),Boolean(data.bio?.trim()),Boolean(data.city?.trim()),Boolean(data.avatar_path||data.avatar_url),Boolean(data.instagram_url||data.youtube_url||data.spotify_url),Boolean(data.is_public||data.is_published)]:null;
 const score=fields?Math.round(fields.filter(Boolean).length/fields.length*100):null;
 if(!profile?.is_singer&&!profile?.is_musician)return <Link href="/perfis">Gerenciar perfis</Link>;
 return <Link href="/perfil-artistico" title="Nome, biografia, cidade, foto, rede social e publicação"><strong>{score===null?"—":score+"%"}</strong> do perfil completo <span>Revisar perfil →</span></Link>;
}
