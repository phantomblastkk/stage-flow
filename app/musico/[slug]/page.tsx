"use client";
import {useEffect} from "react";
import {useParams} from "next/navigation";
import PublicSingerSite from "@/components/public-singer-site";
import {trackPublicPortfolioView} from "@/lib/musician-metrics";
// Compatibility URL: one public artistic page for singers and musicians.
export default function PortfolioMusicoPublico(){
 const {slug}=useParams<{slug:string}>();
 useEffect(()=>{if(slug)void trackPublicPortfolioView(slug);},[slug]);
 return <PublicSingerSite musicianSlug={slug}/>;
}
