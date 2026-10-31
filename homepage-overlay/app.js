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
  if(location.pathname==='/bis'||location.pathname==='/bis/'||location.pathname.startsWith('/bis/'))return;
  const halloweenEnds=Date.parse('2026-11-01T11:00:00Z');
  if(Date.now()>=halloweenEnds){
    document.documentElement.classList.remove('waschi-halloween','waschi-halloween-extreme');
    const oldStyle=document.getElementById('waschi-halloween-style');if(oldStyle)oldStyle.remove();
    const oldFx=document.getElementById('waschi-halloween-fx');if(oldFx)oldFx.remove();
    return;
  }

  document.documentElement.classList.add('waschi-halloween');

  if(!document.getElementById('waschi-halloween-style')){
    const style=document.createElement('style');
    style.id='waschi-halloween-style';
    style.textContent=`
html.waschi-halloween body{background:#030104!important}
html.waschi-halloween .site-bg{filter:brightness(.62) saturate(.86) contrast(1.08)!important}
#waschi-halloween-fx{
  position:fixed;
  inset:0;
  z-index:2147483000;
  pointer-events:none;
  overflow:hidden;
}
#waschi-halloween-fx .hw-full-overlay{
  position:absolute;
  inset:0;
  background-image:url("data:image/webp;base64,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");
  background-size:cover;
  background-position:center top;
  background-repeat:no-repeat;
  opacity:.32;
  filter:saturate(1.02) contrast(1.04) brightness(.64);
  animation:hwOverlayPulse 7s ease-in-out infinite;
  will-change:opacity,filter,transform;
}
#waschi-halloween-fx .hw-full-overlay:after{
  content:"";
  position:absolute;
  inset:0;
  background:linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.20));
}
@keyframes hwOverlayPulse{
  0%,100%{
    opacity:.30;
    filter:saturate(1.00) contrast(1.03) brightness(.60);
    transform:scale(1.005);
  }
  50%{
    opacity:.96;
    filter:saturate(1.16) contrast(1.10) brightness(1.02);
    transform:scale(1);
  }
}
@media(max-width:700px){
  #waschi-halloween-fx .hw-full-overlay{
    background-position:center top;
    animation-duration:8s;
  }
}
@media(prefers-reduced-motion:reduce){
  #waschi-halloween-fx .hw-full-overlay{
    animation:none!important;
    opacity:.82;
    filter:saturate(1.12) contrast(1.08) brightness(.92);
  }
}
`;
    document.head.appendChild(style);
  }

  if(!document.getElementById('waschi-halloween-fx')&&document.body){
    const fx=document.createElement('div');
    fx.id='waschi-halloween-fx';
    fx.setAttribute('aria-hidden','true');
    fx.innerHTML='<div class="hw-full-overlay"></div>';
    document.body.appendChild(fx);
  }
}
function boot(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();scan();applyHalloweenTheme()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
new MutationObserver(function(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();scan();applyHalloweenTheme()}).observe(document.documentElement,{childList:true,subtree:true});
const s=document.createElement("script");s.src=upstream;s.async=true;document.head.appendChild(s);
})();