/** Public artist Instagram links are opt-in and limited to Instagram itself. */
export function publicInstagramProfile(raw: string | null | undefined): {url:string;handle:string}|null {
 if(!raw||raw.length>512)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=="https:" || !["instagram.com","www.instagram.com","m.instagram.com"].includes(url.hostname.toLowerCase()))return null;
  const pathname=url.pathname.replace(/\/+$/,"");
  const match=/^\/([a-zA-Z0-9._]{1,30})$/.exec(pathname);
  if(!match||["p","reel","reels","stories","explore","accounts"].includes(match[1].toLowerCase()))return null;
  return {handle:"@"+match[1],url:"https://www.instagram.com/"+match[1]+"/"};
 }catch{return null;}
}
