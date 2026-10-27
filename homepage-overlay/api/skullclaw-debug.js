async function inspect(url){
  const out={url};
  try{
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'},redirect:'follow'});
    out.status=r.status;out.finalUrl=r.url;
    const html=await r.text();
    out.title=(html.match(/<title[^>]*>([^<]*)<\/title>/i)||[])[1]||null;
    out.ogImage=(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)||[])[1]||null;
    out.images=[...new Set((html.match(/https?:\/\/[^"' <]+/gi)||[]).filter(x=>/render\.worldofwarcraft\.com|avatar|main-raw|inset/i.test(x)))].slice(0,30);
    out.hasSkullclaw=/skullclaw/i.test(html);
  }catch(e){out.error=String(e)}
  return out;
}
export default async function handler(req,res){
 const urls=[
 'https://www.wowprogress.com/character/eu/silvermoon/Skullclaw',
 'https://check-pvp.fr/eu/Silvermoon/Skullclaw',
 'https://simplearmory.com/#/eu/silvermoon/skullclaw',
 'https://www.warcraftlogs.com/character/eu/silvermoon/skullclaw'
 ];
 const results=[];
 for(const u of urls)results.push(await inspect(u));
 res.status(200).json(results);
}