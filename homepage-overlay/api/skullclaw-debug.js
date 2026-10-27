async function inspect(url){
  const out={url};
  try{
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'},redirect:'follow'});
    out.status=r.status; out.finalUrl=r.url;
    const html=await r.text();
    out.title=(html.match(/<title>([^<]*)<\/title>/i)||[])[1]||null;
    out.desc=(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)||[])[1]||null;
    out.ogImage=(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)||[])[1]||null;
    out.renderUrls=[...new Set(html.match(/https:\/\/render\.worldofwarcraft\.com\/eu\/character\/[^"' <]+/gi)||[])].slice(0,10);
  }catch(e){out.error=String(e)}
  return out;
}
export default async function handler(req,res){
 const urls=[
 'https://worldofwarcraft.blizzard.com/en-gb/worldsoul/eu/armory/character/silvermoon/skullclaw',
 'https://worldofwarcraft.blizzard.com/de-de/worldsoul/eu/armory/character/silvermoon/skullclaw',
 'https://worldofwarcraft.blizzard.com/en-us/worldsoul/eu/armory/character/silvermoon/skullclaw',
 'https://worldofwarcraft.blizzard.com/en-gb/character/eu/silvermoon/skullclaw',
 'https://worldofwarcraft.blizzard.com/de-de/character/eu/silvermoon/skullclaw',
 'https://worldofwarcraft.com/en-gb/character/eu/silvermoon/skullclaw',
 'https://worldofwarcraft.com/de-de/character/eu/silvermoon/skullclaw'
 ];
 const results=[];
 for(const u of urls)results.push(await inspect(u));
 res.status(200).json(results);
}