(function(){
  const oldApp="https://waschi-ekdq613p6-bernd-9907.vercel.app/app.js";
  const rawFetch=window.fetch.bind(window);
  const pending=new Map();
  window.fetch=function(input,init){
    try{
      const u=typeof input==="string"?input:(input&&input.url)||"";
      const method=(init&&init.method)||"GET";
      if(method==="GET"&&u.indexOf("/api/guild-character?")===0){
        if(!pending.has(u)){
          pending.set(u,rawFetch(input,init).then(r=>{const c=r.clone();setTimeout(()=>pending.delete(u),8000);return c}).catch(e=>{pending.delete(u);throw e}));
        }
        return pending.get(u).then(r=>r.clone());
      }
    }catch(e){}
    return rawFetch(input,init);
  };

  const images={
    "Prayox":"https://render.worldofwarcraft.com/eu/character/blackhand/22/163146006-main-raw.png",
    "Schnuffelox":"https://render.worldofwarcraft.com/eu/character/blackhand/157/164229277-main-raw.png",
    "Skullbär":"https://render.worldofwarcraft.com/eu/character/silvermoon/59/225691451-main-raw.png",
    "Skullbat":"https://render.worldofwarcraft.com/eu/character/silvermoon/60/223971644-main-raw.png",
    "Skullchaos":"https://render.worldofwarcraft.com/eu/character/blackhand/63/163093567-main-raw.png",
    "Skullcow":"https://render.worldofwarcraft.com/eu/character/blackhand/175/166362287-main-raw.png",
    "Skulldust":"https://render.worldofwarcraft.com/eu/character/blackhand/60/163246652-main-raw.png",
    "Skullfreeze":"https://render.worldofwarcraft.com/eu/character/blackhand/111/166370415-main-raw.png",
    "Skullkeg":"https://render.worldofwarcraft.com/eu/character/blackhand/67/168204611-main-raw.png",
    "Skullmare":"https://render.worldofwarcraft.com/eu/character/blackhand/110/171504494-main-raw.png",
    "Skullopterix":"https://render.worldofwarcraft.com/eu/character/blackhand/19/166134035-main-raw.png",
    "Skullpain":"https://render.worldofwarcraft.com/eu/character/blackhand/128/163246720-main-raw.png",
    "Skullrex":"https://render.worldofwarcraft.com/eu/character/blackhand/89/164708185-main-raw.png",
    "Skullthief":"https://render.worldofwarcraft.com/eu/character/blackhand/214/166071510-main-raw.png",
    "Zepros":"https://render.worldofwarcraft.com/eu/character/blackhand/178/164094642-main-raw.png"
  };

  function fixAdrian(){
    if(location.pathname!=="/team/adrian-prayox/"&&location.pathname!=="/team/adrian-prayox")return;
    document.querySelectorAll(".character-entry[data-character]").forEach(card=>{
      const src=images[card.dataset.character];
      const img=card.querySelector("[data-char-image],.character-card-art img");
      const fb=card.querySelector("[data-char-fallback],.character-card-fallback");
      if(src&&img){
        img.hidden=false;
        img.src=src;
        if(fb)fb.hidden=true;
        img.onerror=function(){
          const inset=src.replace("-main-raw.png","-inset.jpg");
          if(img.src!==inset){img.src=inset;return}
          img.hidden=true;if(fb)fb.hidden=false;
        };
      }else if(card.dataset.character==="Skullclaw"&&fb){
        fb.hidden=false;
      }
    });
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fixAdrian);else fixAdrian();

  const s=document.createElement("script");
  s.src=oldApp;
  s.async=true;
  document.head.appendChild(s);
})();