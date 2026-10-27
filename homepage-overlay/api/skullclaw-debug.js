export default async function handler(req,res){
  const realm='eredar';
  const arm='https://worldofwarcraft.blizzard.com/en-gb/worldsoul/eu/armory/character/'+realm+'/skullclaw';
  try{
    const r=await fetch(arm,{headers:{'user-agent':'Mozilla/5.0'}});
    const html=await r.text();
    const positions=[];
    let from=0;
    while(positions.length<12){
      const i=html.toLowerCase().indexOf('skullclaw',from);
      if(i<0)break;
      positions.push(i);from=i+9;
    }
    const contexts=positions.map(i=>html.slice(Math.max(0,i-700),Math.min(html.length,i+1800)));
    const patterns={
      classJson:[...html.matchAll(/.{0,120}(?:playable[_-]?class|class[_-]?name|character[_-]?class).{0,260}/gi)].slice(0,20).map(m=>m[0]),
      rogue:[...html.matchAll(/.{0,120}\bRogue\b.{0,260}/gi)].slice(0,20).map(m=>m[0]),
      warrior:[...html.matchAll(/.{0,120}\bWarrior\b.{0,260}/gi)].slice(0,20).map(m=>m[0])
    };
    res.status(200).json({status:r.status,positions,contexts,patterns});
  }catch(e){res.status(200).json({error:String(e)})}
}