(function(){
const upstream="https://waschi-ekdq613p6-bernd-9907.vercel.app/app.js";
const realFetch=window.fetch.bind(window);
const reqCache=new Map();
window.fetch=function(input,init){
  const u=typeof input==="string"?input:(input&&input.url)||"";
  if(u.indexOf("/api/characters")===0 && document.querySelector(".member-profile-page")){
    return Promise.resolve(new Response('{"characters":[]}',{status:200,headers:{"content-type":"application/json"}}));
  }
  if(u.indexOf("/api/guild-character?")===0 && document.querySelector(".member-profile-page")){
    if(!reqCache.has(u)){
      reqCache.set(u,realFetch(input,init).then(function(r){
        setTimeout(function(){reqCache.delete(u)},10000);
        return r.clone();
      }).catch(function(e){reqCache.delete(u);throw e}));
    }
    return reqCache.get(u).then(function(r){return r.clone()});
  }
  return realFetch(input,init);
};
const classDe={Warrior:"Krieger","Death Knight":"Todesritter","Demon Hunter":"Dämonenjäger",Druid:"Druide",Evoker:"Rufer",Hunter:"Jäger",Mage:"Magier",Monk:"Mönch",Paladin:"Paladin",Priest:"Priester",Rogue:"Schurke",Shaman:"Schamane",Warlock:"Hexenmeister"};
const specDe={Arms:"Waffen",Fury:"Furor",Protection:"Schutz",Blood:"Blut",Frost:"Frost",Unholy:"Unheilig",Havoc:"Verwüstung",Vengeance:"Rachsucht",Devourer:"Verschlinger",Balance:"Gleichgewicht",Feral:"Wildheit",Guardian:"Wächter",Restoration:"Wiederherstellung",Augmentation:"Verstärkung",Devastation:"Verheerung",Preservation:"Bewahrung","Beast Mastery":"Tierherrschaft",Marksmanship:"Treffsicherheit",Survival:"Überleben",Arcane:"Arkan",Fire:"Feuer",Brewmaster:"Braumeister",Mistweaver:"Nebelwirker",Windwalker:"Windläufer",Holy:"Heilig",Retribution:"Vergeltung",Discipline:"Disziplin",Shadow:"Schatten",Assassination:"Meucheln",Outlaw:"Gesetzlosigkeit",Subtlety:"Täuschung",Elemental:"Elementar",Enhancement:"Verstärkung",Affliction:"Gebrechen",Demonology:"Dämonologie",Destruction:"Zerstörung"};
function parts(card){
  let art=card.querySelector(".character-card-art")||card.querySelector(".lentor-image-wrap");
  if(!art){
    const old=card.querySelector(".character-static-art");
    if(old){art=document.createElement("div");art.className="character-card-art";old.replaceWith(art)}
  }
  if(!art)return null;
  let img=art.querySelector("img");
  if(!img){img=document.createElement("img");art.prepend(img)}
  let fb=art.querySelector("[data-char-fallback],.character-card-fallback,.lentor-image-fallback");
  if(!fb){fb=document.createElement("div");fb.className="character-card-fallback";art.appendChild(fb)}
  return {img:img,fb:fb};
}
function fallback(card,p){
  p.img.hidden=true;
  p.fb.hidden=false;
  p.fb.style.display="grid";
  p.fb.style.placeItems="center";
  p.fb.style.color="#f0c45a";
  p.fb.style.font="800 64px Georgia,serif";
  p.fb.textContent=(card.dataset.character||"?").charAt(0).toUpperCase();
}
function setImage(card,p,d){
  const src=[d.image,d.insetImage,d.avatar].filter(Boolean);
  let i=0;
  if(!src.length){fallback(card,p);return}
  p.fb.hidden=true;p.fb.style.display="none";p.img.hidden=false;p.img.loading="eager";
  p.img.onload=function(){p.fb.hidden=true;p.fb.style.display="none";p.img.hidden=false};
  p.img.onerror=function(){i++;if(i<src.length)p.img.src=src[i];else fallback(card,p)};
  p.img.src=src[0];
}
async function load(card){
  if(card.dataset.waschiFixed==="1")return;
  const name=card.dataset.character||((card.querySelector("h3")||{}).textContent||"").trim();
  const realm=(card.dataset.realm||((card.querySelector(".character-realm")||{}).textContent)||"").trim().toLowerCase();
  if(!name||!realm)return;
  card.dataset.waschiFixed="1";
  card.dataset.profileImageLoaded="1";
  const p=parts(card);if(!p)return;
  try{
    const q=new URLSearchParams({realm:realm,name:name});
    const r=await realFetch("/api/guild-character?"+q.toString(),{cache:"force-cache"});
    if(!r.ok)throw new Error("character");
    const d=await r.json();
    setImage(card,p,d);
    const c=card.querySelector("[data-char-class]"),s=card.querySelector("[data-char-spec]"),m=card.querySelector("[data-char-score]");
    if(c&&d.className)c.textContent=classDe[d.className]||d.className;
    if(s&&d.spec)s.textContent=specDe[d.spec]||d.spec;
    if(m&&d.mythicPlus&&d.mythicPlus.score!=null)m.textContent=new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(d.mythicPlus.score);
  }catch(e){fallback(card,p)}
}
function scan(){
  if(!document.querySelector(".member-profile-page"))return;
  document.querySelectorAll(".member-profile-page .character-entry[data-character]").forEach(load);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scan);else scan();
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
const s=document.createElement("script");s.src=upstream;s.async=true;document.head.appendChild(s);
})();