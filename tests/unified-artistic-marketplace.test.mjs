import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const source=path=>readFileSync(resolve(process.cwd(),path),"utf8");
const catalog=source("components/marketplace-catalog.tsx");
const catalogCss=source("components/marketplace-catalog.css");
const publicPage=source("components/public-singer-site.tsx");
const musicianRoute=source("app/musico/[slug]/page.tsx");
const musicianMetadata=source("app/musico/[slug]/layout.tsx");
const sql=source("supabase/unified_artistic_profile_20261028.sql");
const hub=source("app/perfil-artistico/page.tsx");
const musicianEditor=source("components/instrumentalist-profile-editor.tsx");
const crop=source("lib/profile-photo.ts");

test("marketplace features and search share one compact artist card without a decorative banner",()=>{
 assert.match(catalog,/function MarketplaceMusicianCard\(/);
 assert.match(catalog,/{featured\.map\(\(m,index\)=><MarketplaceMusicianCard/);
 assert.match(catalog,/{items\.map\(m=><MarketplaceMusicianCard/);
 assert.doesNotMatch(catalog,/className="market-card-cover"/);
 assert.doesNotMatch(catalog,/className="market-featured-photo"/);
 assert.match(catalogCss,/\.market-artist-avatar img\{[^}]*object-fit:cover/);
 assert.match(catalog,/Ver perfil <ArrowUpRight/);
 assert.match(catalog,/Convidar <ArrowRight/);
 assert.match(catalog,/market-artist-city/);
});

test("ratings derive only from actual verified Marketplace review statistics",()=>{
 assert.match(catalog,/function Rating\(/);
 assert.match(catalog,/if \(!musician\.rating_count\).*Ainda sem avaliações/);
 assert.match(catalog,/musician\.rating_avg/);
 assert.match(catalog,/musician\.rating_count/);
 assert.match(catalog,/function MarketplaceMusicianCard[\s\S]*?<Rating musician=\{musician\}/);
 assert.doesNotMatch(catalog,/128 avaliações|4,9\s*\/\s*5/);
 assert.match(catalog,/stage_marketplace_search/);
});

test("one public artistic page renders instruments only from published musician data",()=>{
 assert.match(musicianRoute,/<PublicSingerSite musicianSlug=\{slug\}/);
 assert.match(publicPage,/stage_public_artistic_musician/);
 assert.match(publicPage,/router\.replace\("\/"\+encodeURIComponent\(result\.username\)\)/);
 assert.match(publicPage,/musician&&<section className="premium-musician-section"/);
 assert.match(publicPage,/musician\.instruments/);
 assert.match(publicPage,/musician\.genres/);
 assert.match(publicPage,/musician\.reference_fee/);
 assert.match(musicianMetadata,/publicUsername/);
 assert.match(musicianMetadata,/alternates: \{ canonical \}/);
});

test("published-only RPCs guard optional musical data, portrait, and marketplace status",()=>{
 assert.match(sql,/public\.stage_public_musician_portfolio\(m\.slug\)/);
 assert.match(sql,/m\.is_published=true and p\.is_artist=true/);
 assert.match(sql,/case when p\.is_public then p\.username else null end/);
 assert.match(sql,/stage_marketplace_musician_settings s on s\.musician_id=p\.id and s\.listed=true/);
 assert.match(sql,/stage_marketplace_hidden_musicians/);
 assert.match(sql,/p\.is_public and p\.is_singer then p\.artist_avatar_path else null end/);
 assert.match(sql,/revoke all on function public\.stage_public_marketplace_identity/);
});

test("hybrid artist maintains one URL and uploads automatically crop square portraits",()=>{
 assert.match(hub,/if\(profile\?\.is_singer\)\{setPublicPath\(profile\.username/);
 assert.match(hub,/unifiedSinger=\{Boolean\(profile\?\.is_singer\)\}/);
 assert.match(musicianEditor,/unifiedSinger&&username \? "\/"\+encodeURIComponent\(username\)/);
 assert.match(musicianEditor,/stage_my_artist_page/);
 assert.match(crop,/prepareProfilePortrait/);
 assert.match(crop,/canvas\.width=800;canvas\.height=800/);
 assert.match(source("components/artist-profile-editor.tsx"),/prepareProfilePortrait\(file\)/);
 assert.match(musicianEditor,/prepareProfilePortrait\(file\)/);
});
