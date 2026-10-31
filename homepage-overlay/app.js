(function(){
const upstream="https://waschi-ekdq613p6-bernd-9907.vercel.app/app.js";
const realFetch=window.fetch.bind(window);
const reqCache=new Map();
function ensureDownloadsCss(){
  if(document.querySelector('link[data-waschi-download-css]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='/downloads.css';link.dataset.waschiDownloadCss='1';
  document.head.appendChild(link);
}
function enhanceDownloads(){
  ensureDownloadsCss();
  const nav=document.querySelector('.nav');
  if(nav&&!nav.querySelector('a[href="/download/"]')){
    const a=document.createElement('a');
    a.href='/download/';a.className='download-nav';
    a.innerHTML='<span class="ico">⇩</span><span>Download</span>';
    const before=nav.querySelector('a[href="/streams/"]');
    nav.insertBefore(a,before||null);
  }
  const grid=document.querySelector('.quick-grid');
  if(grid&&!grid.querySelector('.quick.downloads')){
    const a=document.createElement('a');
    a.className='quick downloads';a.href='/download/';
    a.innerHTML='<div class="quick-bg"></div><div class="quick-content"><div class="quick-icon">⇩</div><div><strong>Download</strong><small>Tools & Dateien</small></div></div>';
    const bis=grid.querySelector('.quick.bis');
    if(bis&&bis.nextSibling)grid.insertBefore(a,bis.nextSibling);else grid.appendChild(a);
  }
}
function configureExternalLinks(){
  document.querySelectorAll('a[href]').forEach(function(a){
    const href=a.getAttribute('href')||'';
    if(!href||href.charAt(0)==='#'||/^(mailto:|tel:|javascript:)/i.test(href))return;
    let url;
    try{url=new URL(href,window.location.href)}catch(e){return}
    if(url.protocol!=='http:'&&url.protocol!=='https:')return;
    const host=url.hostname.toLowerCase();
    const internal=host===window.location.hostname.toLowerCase()||host==='waschi.fun'||host.endsWith('.waschi.fun');
    const bisToolLink=internal&&(url.pathname==='/bis'||url.pathname==='/bis/'||url.pathname.startsWith('/bis/'));
    if(!internal||bisToolLink){
      a.target='_blank';
      const rel=new Set((a.getAttribute('rel')||'').split(/\s+/).filter(Boolean));
      rel.add('noopener');rel.add('noreferrer');
      a.setAttribute('rel',Array.from(rel).join(' '));
      a.dataset.waschiExternal=!internal?'1':'0';
      if(bisToolLink)a.dataset.waschiBisNewTab='1';
    }
  });
}
ensureDownloadsCss();
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
function setImage(card,p,d,detailSrc){
  const src=[detailSrc,d&&d.image,d&&d.insetImage,d&&d.avatar].filter(function(v,i,a){return v&&a.indexOf(v)===i});
  let i=0;
  if(!src.length){fallback(card,p);return}
  p.fb.hidden=true;p.fb.style.display="none";
  p.img.hidden=false;p.img.removeAttribute("hidden");p.img.style.display="block";p.img.loading="eager";p.img.decoding="async";
  p.img.onload=function(){p.fb.hidden=true;p.fb.style.display="none";p.img.hidden=false;p.img.removeAttribute("hidden");p.img.style.display="block"};
  p.img.onerror=function(){i++;if(i<src.length)p.img.src=src[i];else fallback(card,p)};
  p.img.src=src[0];
}
async function detailImage(card,name,realm){
  try{
    const detail=card.dataset.detail||("/charakter/?realm="+encodeURIComponent(realm)+"&name="+encodeURIComponent(name));
    const r=await realFetch(detail,{cache:"force-cache"});
    if(!r.ok)return "";
    const html=await r.text();
    const doc=new DOMParser().parseFromString(html,"text/html");
    const img=doc.querySelector(".char-detail-art img[src]");
    return img?img.getAttribute("src")||"":"";
  }catch(e){return ""}
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
    const pair=await Promise.allSettled([
      realFetch("/api/guild-character?"+q.toString(),{cache:"force-cache"}).then(async function(r){if(!r.ok)throw new Error("character");return r.json()}),
      detailImage(card,name,realm)
    ]);
    const d=pair[0].status==="fulfilled"?pair[0].value:{};
    const detailSrc=pair[1].status==="fulfilled"?pair[1].value:"";
    setImage(card,p,d,detailSrc);
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
function forceHeaderLogoSize(){
  const logo=document.querySelector(".brand-logo");
  if(!logo)return;
  logo.style.setProperty("width","150px","important");
  logo.style.setProperty("height","150px","important");
  logo.style.setProperty("min-width","150px","important");
  logo.style.setProperty("flex","0 0 150px","important");
  logo.style.setProperty("background-size","contain","important");
  logo.style.setProperty("background-position","center center","important");
  logo.style.setProperty("background-repeat","no-repeat","important");
  logo.style.setProperty("transform","none","important");
  logo.style.setProperty("display","block","important");
  const brand=logo.closest(".brand");
  if(brand){
    brand.style.setProperty("overflow","visible","important");
    brand.style.setProperty("align-items","center","important");
  }
  const navwrap=logo.closest(".navwrap");
  if(navwrap){
    navwrap.style.removeProperty("min-height");
    navwrap.style.setProperty("overflow","visible","important");
    navwrap.style.setProperty("padding-top","0","important");
    navwrap.style.setProperty("padding-bottom","0","important");
  }
}
function applyHalloweenTheme(){
  const isHome=location.pathname==='/'||location.pathname==='';
  if(!isHome)return;
  const halloweenEnds=Date.parse('2026-11-01T11:00:00Z');
  if(Date.now()>=halloweenEnds){
    document.documentElement.classList.remove('waschi-halloween');
    const oldStyle=document.getElementById('waschi-halloween-style');if(oldStyle)oldStyle.remove();
    const oldFx=document.getElementById('waschi-halloween-fx');if(oldFx)oldFx.remove();
    return;
  }

  document.documentElement.classList.add('waschi-halloween');

  if(!document.getElementById('waschi-halloween-style')){
    const style=document.createElement('style');
    style.id='waschi-halloween-style';
    style.textContent=`
html.waschi-halloween body{background:#030104!important;overflow:hidden!important}
html.waschi-halloween .header{visibility:hidden!important;pointer-events:none!important}
#waschi-halloween-fx{
  position:fixed;
  inset:0;
  z-index:2147483000;
  pointer-events:none;
  overflow:hidden;
  background:#030104;
}
#waschi-halloween-fx .hw-stage{
  position:absolute;
  left:50%;
  top:50%;
  width:min(100vw,calc(100vh * 1672 / 941));
  aspect-ratio:1672/941;
  transform:translate(-50%,-50%);
  background-image:url("/halloween-2026.webp");
  background-size:100% 100%;
  background-position:center;
  background-repeat:no-repeat;
  pointer-events:none;
}
#waschi-halloween-fx .hw-hotspot{
  position:absolute;
  top:24.55%;
  height:6.1%;
  pointer-events:auto;
  display:block;
  border-radius:8px;
  cursor:pointer;
  background:rgba(255,255,255,0);
}
#waschi-halloween-fx .hw-hotspot:hover,
#waschi-halloween-fx .hw-hotspot:focus-visible{
  outline:2px solid rgba(255,130,45,.55);
  outline-offset:-2px;
  box-shadow:0 0 18px rgba(255,72,0,.35) inset,0 0 18px rgba(255,72,0,.18);
}
#waschi-halloween-fx .hw-hotspot.home{left:13.0%;width:9.5%}
#waschi-halloween-fx .hw-hotspot.guild{left:22.9%;width:9.7%}
#waschi-halloween-fx .hw-hotspot.mplus{left:32.7%;width:8.2%}
#waschi-halloween-fx .hw-hotspot.extensions{left:40.8%;width:10.6%}
#waschi-halloween-fx .hw-hotspot.bis{left:51.2%;width:8.5%}
#waschi-halloween-fx .hw-hotspot.download{left:59.7%;width:9.4%}
#waschi-halloween-fx .hw-hotspot.streams{left:69.3%;width:8.2%}
#waschi-halloween-fx .hw-hotspot.community{left:77.9%;width:9.8%}
`;
    document.head.appendChild(style);
  }

  if(!document.getElementById('waschi-halloween-fx')&&document.body){
    const navLinks=[...document.querySelectorAll('.header .nav a')];
    const map={};
    navLinks.forEach(a=>{
      const t=(a.textContent||'').trim().toLowerCase();
      if(t.includes('start'))map.home=a.href;
      else if(t.includes('gilde'))map.guild=a.href;
      else if(t.includes('m+'))map.mplus=a.href;
      else if(t.includes('erweiter'))map.extensions=a.href;
      else if(t.includes('bis'))map.bis=a.href;
      else if(t.includes('download'))map.download=a.href;
      else if(t.includes('stream'))map.streams=a.href;
      else if(t.includes('community'))map.community=a.href;
    });

    const fx=document.createElement('div');
    fx.id='waschi-halloween-fx';
    fx.setAttribute('aria-hidden','false');
    fx.innerHTML='<div class="hw-stage"></div>';

    const stage=fx.querySelector('.hw-stage');
    const defs=[
      ['home','Startseite','/'],
      ['guild','Waschi Gilde','#'],
      ['mplus','M+ Team','#'],
      ['extensions','Erweiterungen','#'],
      ['bis','BiS-Tools','/bis/'],
      ['download','Download','#'],
      ['streams','Streams','#'],
      ['community','Community','#']
    ];
    defs.forEach(([key,label,fallback])=>{
      const a=document.createElement('a');
      a.className='hw-hotspot '+key;
      a.href=map[key]||fallback;
      a.setAttribute('aria-label',label);
      a.title=label;
      stage.appendChild(a);
    });

    document.body.appendChild(fx);
  }
}
function boot(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();scan();applyHalloweenTheme()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
new MutationObserver(function(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();scan();applyHalloweenTheme()}).observe(document.documentElement,{childList:true,subtree:true});
const s=document.createElement("script");s.src=upstream;s.async=true;document.head.appendChild(s);
})();