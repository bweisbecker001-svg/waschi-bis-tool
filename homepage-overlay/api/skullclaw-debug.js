async function inspectRealm(realm){
  const out={realm};
  try{
    const arm='https://worldofwarcraft.blizzard.com/en-gb/worldsoul/eu/armory/character/'+realm+'/skullclaw';
    const r=await fetch(arm,{headers:{'user-agent':'Mozilla/5.0'}});
    out.status=r.status;
    const html=await r.text();
    out.title=(html.match(/<title>([^<]*)<\/title>/i)||[])[1]||null;
    out.ogTitle=(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)||[])[1]||null;
    out.ogImage=(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)||[])[1]||null;
    out.renderUrls=[...new Set(html.match(/https:\/\/render\.worldofwarcraft\.com\/eu\/character\/[^"' <]+/gi)||[])].slice(0,20);
    out.classHits=[...new Set((html.match(/\b(Rogue|Warrior|Paladin|Hunter|Priest|Shaman|Mage|Warlock|Monk|Druid|Demon Hunter|Death Knight|Evoker)\b/gi)||[]))].slice(0,20);
    const idx=html.toLowerCase().indexOf('skullclaw');
    out.nameContext=idx>=0?html.slice(Math.max(0,idx-500),idx+1500):null;
  }catch(e){out.error=String(e)}
  return out;
}
export default async function handler(req,res){
  res.status(200).json({
    silvermoon:await inspectRealm('silvermoon'),
    eredar:await inspectRealm('eredar')
  });
}