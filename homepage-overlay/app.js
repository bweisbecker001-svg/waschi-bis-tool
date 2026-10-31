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
html.waschi-halloween{--hw-orange:#ff7a18;--hw-green:#91d14f;--hw-violet:#7b3fb0}
html.waschi-halloween body{background:#050306!important}
html.waschi-halloween body:before{content:"";position:fixed;inset:0;z-index:2147482000;pointer-events:none;background:
radial-gradient(circle at 12% 8%,rgba(123,63,176,.18),transparent 28%),
radial-gradient(circle at 88% 14%,rgba(255,122,24,.12),transparent 24%),
linear-gradient(rgba(3,2,5,.12),rgba(2,1,3,.34));mix-blend-mode:screen}
html.waschi-halloween .header{background:linear-gradient(180deg,rgba(7,3,10,.97),rgba(18,5,16,.94))!important;border-bottom-color:rgba(255,122,24,.42)!important;box-shadow:0 12px 36px rgba(0,0,0,.72),0 0 28px rgba(123,63,176,.16)!important}
html.waschi-halloween .brand strong,html.waschi-halloween h1,html.waschi-halloween h2,html.waschi-halloween h3{filter:drop-shadow(0 0 10px rgba(255,122,24,.18))}
html.waschi-halloween .nav a:hover,html.waschi-halloween .nav a.active{color:#ffb15d!important;text-shadow:0 0 12px rgba(255,122,24,.4)}
html.waschi-halloween .btn.gold{background:linear-gradient(180deg,#ff8a27,#9a3d0a)!important;border-color:#ffad5f!important;box-shadow:0 0 18px rgba(255,122,24,.18)!important}
html.waschi-halloween .quick,html.waschi-halloween .panel,html.waschi-halloween .card,html.waschi-halloween .download-card,html.waschi-halloween .addon-card{box-shadow:0 14px 36px rgba(0,0,0,.72),0 0 20px rgba(123,63,176,.08)!important}
#waschi-halloween-fx{position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden}
#waschi-halloween-fx .hw-banner{position:fixed;top:118px;left:50%;transform:translateX(-50%);max-width:min(92vw,760px);padding:9px 18px;border:1px solid rgba(255,122,24,.5);border-radius:999px;background:rgba(12,5,12,.86);color:#ffc27f;font:700 12px/1.25 Georgia,serif;letter-spacing:.08em;text-transform:uppercase;text-align:center;box-shadow:0 0 26px rgba(255,122,24,.14);backdrop-filter:blur(7px)}
#waschi-halloween-fx .hw-moon{position:absolute;right:5vw;top:13vh;width:115px;height:115px;border-radius:50%;background:radial-gradient(circle at 38% 36%,#e9f0c6 0 8%,#a6bc7d 24%,#55704f 52%,rgba(35,52,39,.24) 70%,transparent 72%);opacity:.42;filter:drop-shadow(0 0 24px rgba(145,209,79,.28))}
#waschi-halloween-fx .hw-fog{position:absolute;left:-20vw;width:140vw;height:22vh;border-radius:50%;background:radial-gradient(ellipse at center,rgba(185,193,202,.12),rgba(90,70,100,.05) 45%,transparent 70%);filter:blur(18px);animation:hwFog 19s ease-in-out infinite alternate}
#waschi-halloween-fx .hw-fog.one{bottom:2vh}#waschi-halloween-fx .hw-fog.two{bottom:20vh;opacity:.55;animation-duration:26s;animation-direction:alternate-reverse}
#waschi-halloween-fx .hw-bats{position:absolute;left:6vw;top:18vh;color:rgba(15,8,18,.92);font-size:28px;letter-spacing:18px;transform:rotate(-8deg);text-shadow:80px 45px 0 rgba(15,8,18,.8),165px -15px 0 rgba(15,8,18,.65);animation:hwBats 9s ease-in-out infinite alternate}
#waschi-halloween-fx .hw-pumpkins{position:absolute;right:4vw;bottom:3vh;font-size:34px;filter:drop-shadow(0 0 12px rgba(255,122,24,.4));opacity:.82}
@keyframes hwFog{from{transform:translate3d(-5vw,0,0) scale(1)}to{transform:translate3d(6vw,-2vh,0) scale(1.08)}}
@keyframes hwBats{from{transform:translate3d(0,0,0) rotate(-8deg)}to{transform:translate3d(12vw,-4vh,0) rotate(3deg)}}
@media(max-width:700px){#waschi-halloween-fx .hw-banner{top:92px;font-size:10px;padding:8px 12px}#waschi-halloween-fx .hw-moon{width:78px;height:78px;top:15vh}.hw-bats{opacity:.55}}
@media(prefers-reduced-motion:reduce){#waschi-halloween-fx *{animation:none!important}}
`;
    document.head.appendChild(style);
  }
  if(!document.getElementById('waschi-halloween-fx')&&document.body){
    const fx=document.createElement('div');fx.id='waschi-halloween-fx';fx.setAttribute('aria-hidden','true');
    fx.innerHTML='<div class="hw-banner">☠ Schaurige Grüße aus Azeroth · Waschi Halloween 2026 ☠</div><div class="hw-moon"></div><div class="hw-fog one"></div><div class="hw-fog two"></div><div class="hw-bats">⌁⌁⌁</div><div class="hw-pumpkins">🎃</div>';
    document.body.appendChild(fx);
  }
}
function boot(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();scan();applyHalloweenTheme()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
new MutationObserver(function(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();scan();applyHalloweenTheme()}).observe(document.documentElement,{childList:true,subtree:true});
const s=document.createElement("script");s.src=upstream;s.async=true;document.head.appendChild(s);
})();