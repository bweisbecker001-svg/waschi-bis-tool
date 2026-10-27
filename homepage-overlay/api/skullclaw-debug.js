export default async function handler(req,res){
  const out={};
  try{
    const api='https://raider.io/api/v1/characters/profile?region=eu&realm=silvermoon&name=Skullclaw&fields=gear';
    const r=await fetch(api,{headers:{'user-agent':'Waschi.fun lookup'}});
    out.apiStatus=r.status;
    out.api=await r.json().catch(()=>null);
  }catch(e){out.apiError=String(e)}
  try{
    const url='https://raider.io/characters/eu/silvermoon/Skullclaw';
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
    out.pageStatus=r.status;
    const html=await r.text();
    out.ogImage=(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)||[])[1]||null;
    out.renderUrls=[...new Set((html.match(/https:\/\/render\.worldofwarcraft\.com\/[^"' <]+/gi)||[]))].slice(0,20);
    out.cdnUrls=[...new Set((html.match(/https:\/\/[^"' <]+(?:avatar|main-raw|inset)[^"' <]*/gi)||[]))].slice(0,20);
  }catch(e){out.pageError=String(e)}
  res.status(200).json(out);
}