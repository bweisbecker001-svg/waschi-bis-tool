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

  function berlinPseudoNow(){
    const parts=new Intl.DateTimeFormat('en-CA',{
      timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
    }).formatToParts(new Date());
    const v={};
    parts.forEach(p=>{if(p.type!=='literal')v[p.type]=p.value});
    return Date.UTC(+v.year,+v.month-1,+v.day,+v.hour,+v.minute,+v.second);
  }
  function easterSunday(year){
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
    const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
    const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
    const l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
    const month=Math.floor((h+l-7*m+114)/31);
    const day=((h+l-7*m+114)%31)+1;
    return Date.UTC(year,month-1,day);
  }
  const day=86400000;
  const now=berlinPseudoNow();
  const nowYear=new Date(now).getUTCFullYear();

  const hotspotPresets={
    halloween:{top:20.62,height:6.16,boxes:[[8.97,12.26],[21.23,9.87],[31.10,8.07],[39.18,11.96],[51.14,8.67],[59.81,8.85],[68.66,9.39],[78.05,11.96]]},
    christmas:{top:21.35,height:6.7,boxes:[[11.6,10.7],[22.9,9.2],[32.0,8.3],[40.5,10.8],[51.3,8.5],[59.9,9.0],[69.4,8.7],[78.2,10.9]]},
    newyear:{top:20.8,height:6.9,boxes:[[11.3,10.7],[22.2,9.4],[31.8,8.1],[40.0,11.2],[51.2,8.6],[59.8,9.0],[69.0,8.9],[78.0,10.6]]},
    easter:{top:20.3,height:7.2,boxes:[[9.9,11.2],[21.8,9.9],[31.9,8.6],[40.5,11.1],[51.6,8.5],[60.2,9.1],[69.6,8.9],[78.6,10.7]]},
    nikolaus:{top:20.6,height:6.9,boxes:[[10.0,10.7],[21.4,10.0],[31.7,8.5],[40.2,11.2],[51.4,8.6],[60.0,9.0],[69.2,9.0],[78.3,10.7]]}
  };

  const ranges=[];
  for(let y=nowYear-1;y<=nowYear+1;y++){
    const easter=easterSunday(y);
    ranges.push(
      {key:'halloween',image:'/halloween-2026.webp',start:Date.UTC(y,9,24,0,0,0),end:Date.UTC(y,10,1,12,0,0),priority:50},
      {key:'nikolaus',image:'/season-nikolaus.webp',start:Date.UTC(y,10,29,0,0,0),end:Date.UTC(y,11,7,12,0,0),priority:60},
      {key:'christmas',image:'/season-christmas.webp',start:Date.UTC(y,11,17,0,0,0),end:Date.UTC(y,11,27,12,0,0),priority:90},
      {key:'newyear',image:'/season-newyear.webp',start:Date.UTC(y,11,24,0,0,0),end:Date.UTC(y+1,0,2,12,0,0),priority:80},
      {key:'easter',image:'/season-easter.webp',start:easter-7*day,end:easter+2*day+12*3600000,priority:70}
    );
  }
  const active=ranges.filter(r=>now>=r.start&&now<r.end).sort((a,b)=>b.priority-a.priority)[0]||null;

  if(!active){
    document.documentElement.classList.remove('waschi-halloween');
    const oldStyle=document.getElementById('waschi-halloween-style');if(oldStyle)oldStyle.remove();
    const oldFx=document.getElementById('waschi-halloween-fx');if(oldFx)oldFx.remove();
    return;
  }

  document.documentElement.classList.add('waschi-halloween');

  let style=document.getElementById('waschi-halloween-style');
  if(!style){
    style=document.createElement('style');
    style.id='waschi-halloween-style';
    style.textContent=`
html.waschi-halloween body{background:#030104!important;overflow:hidden!important}
html.waschi-halloween .header{visibility:hidden!important;pointer-events:none!important}
#waschi-halloween-fx{position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;background:#030104}
#waschi-halloween-fx .hw-stage{position:absolute;left:50%;top:50%;width:min(100vw,calc(100vh * 1672 / 941));aspect-ratio:1672/941;transform:translate(-50%,-50%);background-size:100% 100%;background-position:center;background-repeat:no-repeat;pointer-events:none}
#waschi-halloween-fx .hw-hotspot{position:absolute;pointer-events:auto;display:block;border-radius:8px;cursor:pointer;background:rgba(255,255,255,0)}
#waschi-halloween-fx .hw-hotspot:hover,#waschi-halloween-fx .hw-hotspot:focus-visible{outline:2px solid rgba(255,130,45,.55);outline-offset:-2px;box-shadow:0 0 18px rgba(255,72,0,.35) inset,0 0 18px rgba(255,72,0,.18)}
`;
    document.head.appendChild(style);
  }

  let fx=document.getElementById('waschi-halloween-fx');
  if(fx&&fx.dataset.theme!==active.key){fx.remove();fx=null}
  if(!fx&&document.body){
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

    fx=document.createElement('div');
    fx.id='waschi-halloween-fx';
    fx.dataset.theme=active.key;
    fx.setAttribute('aria-hidden','false');
    fx.innerHTML='<div class="hw-stage"></div>';
    const stage=fx.querySelector('.hw-stage');
    stage.style.backgroundImage='url("'+active.image+'")';

    const preset=hotspotPresets[active.key];
    const defs=[
      ['home','Startseite','/'],['guild','Waschi Gilde','#'],['mplus','M+ Team','#'],
      ['extensions','Erweiterungen','#'],['bis','BiS-Tools','/bis/'],['download','Download','#'],
      ['streams','Streams','#'],['community','Community','#']
    ];
    defs.forEach(([key,label,fallback],idx)=>{
      const a=document.createElement('a');
      a.className='hw-hotspot '+key;
      a.href=map[key]||fallback;
      a.setAttribute('aria-label',label);
      a.title=label;
      a.style.top=preset.top+'%';
      a.style.height=preset.height+'%';
      a.style.left=preset.boxes[idx][0]+'%';
      a.style.width=preset.boxes[idx][1]+'%';
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