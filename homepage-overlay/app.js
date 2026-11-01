(function(){
const upstream="/base-app.js";
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
    if(!internal){
      a.target='_blank';
      const rel=new Set((a.getAttribute('rel')||'').split(/\s+/).filter(Boolean));
      rel.add('noopener');rel.add('noreferrer');
      a.setAttribute('rel',Array.from(rel).join(' '));
      a.dataset.waschiExternal='1';
    }else{
      if(a.dataset.waschiBisNewTab)delete a.dataset.waschiBisNewTab;
      if(a.dataset.waschiExternal)delete a.dataset.waschiExternal;
      if(a.getAttribute('target')==='_blank'&&url.pathname.startsWith('/bis'))a.removeAttribute('target');
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
      realFetch("/api/guild-character?"+q.toString(),{cache:"no-store"}).then(async function(r){if(!r.ok)throw new Error("character");return r.json()}),
      detailImage(card,name,realm)
    ]);
    const d=pair[0].status==="fulfilled"?pair[0].value:{};
    const detailSrc=pair[1].status==="fulfilled"?pair[1].value:"";
    setImage(card,p,d,detailSrc);
    const c=card.querySelector("[data-char-class]"),sp=card.querySelector("[data-char-spec]"),m=card.querySelector("[data-char-score]");
    if(c&&d.className)c.textContent=classDe[d.className]||d.className;
    if(sp&&d.spec)sp.textContent=specDe[d.spec]||d.spec;
    if(m&&d.mythicPlus&&d.mythicPlus.score!=null)m.textContent=new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(d.mythicPlus.score);
  }catch(e){fallback(card,p)}
}
function normalizeMemberProfileCharacters(){
  const page=document.querySelector(".member-profile-page");
  if(!page)return;
  const cards=[...page.querySelectorAll(".character-directory .character-entry[data-character]")];
  const seen=new Set();
  cards.forEach(function(card){
    const rawName=(card.dataset.character||((card.querySelector("h3")||{}).textContent||"")).trim();
    const name=rawName.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de-DE");
    const realm=(card.dataset.realm||((card.querySelector(".character-realm")||{}).textContent||"")).replace(/^server:\s*/i,"").trim().toLowerCase();
    const key=name+"|"+realm;
    if(name&&seen.has(key)) card.remove();
    else if(name) seen.add(key);
  });
  const count=page.querySelector(".character-count strong");
  if(count){
    const actual=String(page.querySelectorAll(".character-directory .character-entry[data-character]").length);
    if(count.textContent.trim()!==actual) count.textContent=actual;
  }
}
function scan(){
  if(!document.querySelector(".member-profile-page"))return;
  normalizeMemberProfileCharacters();
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

  function firstAdventSunday(year){
    const dec3=Date.UTC(year,11,3,0,0,0);
    return dec3-new Date(dec3).getUTCDay()*day;
  }
  function adventState(){
    const utcDate=new Date(now);
    const seasonYear=utcDate.getUTCMonth()===0?nowYear-1:nowYear;
    const first=firstAdventSunday(seasonYear);
    const end=Date.UTC(seasonYear+1,0,2,12,0,0);
    if(now<first||now>=end)return {active:false,candles:0};
    const candles=Math.max(1,Math.min(4,Math.floor((now-first)/(7*day))+1));
    return {active:true,candles};
  }

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
#waschi-halloween-fx .waschi-advent{position:absolute;right:2.6%;bottom:3.2%;width:20.5%;aspect-ratio:1/1;z-index:2;pointer-events:none;filter:drop-shadow(0 10px 16px rgba(0,0,0,.58))}
#waschi-halloween-fx .waschi-advent .wreath-ring{position:absolute;inset:20% 6% 6%;border-radius:50%;background:radial-gradient(circle at 50% 48%,transparent 0 29%,rgba(12,41,20,.2) 30% 33%,#173f25 34% 42%,#1f5a2e 43% 52%,#0e2e1b 53% 61%,transparent 62%),conic-gradient(from 15deg,#143d20,#2a6a35,#102f1a,#34763d,#12371e,#245d30,#11341d);box-shadow:0 0 0 2px rgba(185,132,38,.35) inset,0 0 28px rgba(18,4,0,.72)}
#waschi-halloween-fx .waschi-advent .wreath-ring:before,#waschi-halloween-fx .waschi-advent .wreath-ring:after{content:"";position:absolute;width:16%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 34% 30%,#ff7159 0 13%,#a80f0f 36%,#5d0707 70%);box-shadow:24px 8px 0 -1px #9e0d0d,11px 23px 0 -2px #c81919;top:54%}
#waschi-halloween-fx .waschi-advent .wreath-ring:before{left:9%}
#waschi-halloween-fx .waschi-advent .wreath-ring:after{right:13%;transform:scale(.9)}
#waschi-halloween-fx .waschi-advent .candle{position:absolute;width:18%;height:39%;bottom:38%;border-radius:13% 13% 8% 8%;background:linear-gradient(90deg,#7e0909 0,#d82c21 27%,#ff6650 50%,#c71915 72%,#690707 100%);border:2px solid rgba(247,183,76,.58);box-shadow:inset 0 0 12px rgba(255,190,110,.25),0 5px 8px rgba(0,0,0,.52)}
#waschi-halloween-fx .waschi-advent .candle:after{content:"";position:absolute;left:12%;right:12%;top:-4%;height:9%;border-radius:50%;background:#f3634f;box-shadow:inset 0 -3px 5px rgba(91,0,0,.55)}
#waschi-halloween-fx .waschi-advent .c1{left:8%;bottom:31%;transform:rotate(-6deg)}
#waschi-halloween-fx .waschi-advent .c2{left:29%;bottom:43%;height:43%;transform:rotate(-2deg)}
#waschi-halloween-fx .waschi-advent .c3{right:29%;bottom:43%;height:43%;transform:rotate(2deg)}
#waschi-halloween-fx .waschi-advent .c4{right:8%;bottom:31%;transform:rotate(6deg)}
#waschi-halloween-fx .waschi-advent .wick{position:absolute;left:47%;top:-12%;width:6%;height:12%;border-radius:5px;background:#1a0c09}
#waschi-halloween-fx .waschi-advent .flame{display:none;position:absolute;left:50%;top:-38%;width:45%;height:34%;transform:translateX(-50%);border-radius:55% 45% 55% 45%;background:radial-gradient(ellipse at 50% 72%,#fff 0 16%,#ffe06b 26%,#ff9a18 52%,rgba(255,74,0,.96) 70%,rgba(255,74,0,0) 74%);filter:drop-shadow(0 0 5px #ffd76d) drop-shadow(0 0 11px rgba(255,117,20,.9));animation:waschiFlame 1.45s ease-in-out infinite alternate;transform-origin:50% 100%}
#waschi-halloween-fx .waschi-advent .candle.lit .flame{display:block}
#waschi-halloween-fx .waschi-advent .bow{position:absolute;left:50%;bottom:4%;width:49%;height:25%;transform:translateX(-50%)}
#waschi-halloween-fx .waschi-advent .bow:before,#waschi-halloween-fx .waschi-advent .bow:after{content:"";position:absolute;top:12%;width:48%;height:62%;background:linear-gradient(135deg,#7b0505,#e31b18 48%,#7b0505);border:2px solid #d79d2c;box-shadow:0 3px 8px rgba(0,0,0,.45)}
#waschi-halloween-fx .waschi-advent .bow:before{left:0;border-radius:55% 12% 46% 18%;transform:rotate(9deg)}
#waschi-halloween-fx .waschi-advent .bow:after{right:0;border-radius:12% 55% 18% 46%;transform:rotate(-9deg)}
#waschi-halloween-fx .waschi-advent .gem{position:absolute;left:50%;top:9%;width:23%;aspect-ratio:1;transform:translateX(-50%) rotate(45deg);background:linear-gradient(135deg,#f7cf67,#9a6017);border:2px solid #ffe28b;box-shadow:0 0 9px rgba(255,198,74,.5)}
#waschi-halloween-fx .waschi-advent .gem:after{content:"W";position:absolute;inset:14%;display:grid;place-items:center;transform:rotate(-45deg);border-radius:50%;background:#122d58;color:#f7d368;font:900 52% Georgia,serif;text-shadow:0 1px 1px #000}
@keyframes waschiFlame{0%{transform:translateX(-50%) rotate(-3deg) scale(.96,1.02)}100%{transform:translateX(-50%) rotate(4deg) scale(1.05,.96)}}
@media(max-width:760px){#waschi-halloween-fx .waschi-advent{width:24%;right:1.2%;bottom:1.8%}}
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
    const advent=adventState();
    if(advent.active&&['nikolaus','christmas','newyear'].includes(active.key)){
      const wreath=document.createElement('div');
      wreath.className='waschi-advent';
      wreath.setAttribute('aria-label','Adventskranz mit '+advent.candles+' brennenden Kerzen');
      wreath.innerHTML='<div class="wreath-ring"></div>'+
        [1,2,3,4].map(function(n){return '<div class="candle c'+n+(n<=advent.candles?' lit':'')+'"><span class="wick"></span><span class="flame"></span></div>'}).join('')+
        '<div class="bow"><span class="gem"></span></div>';
      stage.appendChild(wreath);
    }
    document.body.appendChild(fx);
  }
}

/* waschiAuthoritativeGuildAssignments20261101 */
const waschiGuildAssignments={
  "/team/adrian-prayox/":{player:"Adrian / Prayox",chars:[["Skullrex","blackhand"],["Skullbär","silvermoon"],["Skullclaw","silvermoon"],["Skullcow","blackhand"],["Skullchaos","blackhand"],["Skullfreeze","blackhand"],["Skullmare","blackhand"],["Skullopterix","blackhand"],["Skullthief","blackhand"],["Zepros","blackhand"],["Waschishop","blackhand"],["Skulldust","blackhand"],["Prayox","blackhand"],["Schnuffelox","blackhand"],["Skullbat","silvermoon"],["Skullkeg","blackhand"],["Skullpain","blackhand"]]},
  "/team/andreas-andy/":{player:"Andreas / Andy",chars:[["Laklara","blackhand"],["Shedira","blackhand"]]},
  "/team/bernd-lentor/":{player:"Bernd / Lentor",chars:[["Kainskind","blackhand"],["Olun","blackhand"],["Axeos","blackhand"],["Léntór","blackhand"],["Sînsîn","blackhand"],["Léntor","blackhand"],["Sâtânsbrâten","todeswache"],["Lentifux","blackhand"]]},
  "/team/christina-fearry/":{player:"Christina / Fearry",chars:[["Fearry","blackrock"]]},
  "/team/corni/":{player:"Corni",chars:[["Arcanon","todeswache"],["Corni","todeswache"],["Nastyangel","todeswache"]]},
  "/team/curtis-curt/":{player:"Curtis / Curt",chars:[["Trapbotx","eredar"],["Poisonbotx","blackmoore"],["Carriefisher","eredar"],["Cleavelandz","eredar"],["Decaybotx","blackrock"],["Jønnå","eredar"],["Cheapsheep","blackrock"],["Shamnsfun","blackrock"],["Høtbøtx","eredar"],["Sparrowlolz","blackmoore"],["Shieldbotx","silvermoon"]]},
  "/team/dennis/":{player:"Dennis",chars:[["Telgrim","blackhand"]]},
  "/team/dima/":{player:"Dima / Dimi",chars:[["Bohunt","blackhand"],["Bokireg","blackhand"],["Borabo","blackhand"],["Râspûtî","blackhand"]]},
  "/team/dimi/":{player:"Dima / Dimi",chars:[["Bohunt","blackhand"],["Bokireg","blackhand"],["Borabo","blackhand"],["Râspûtî","blackhand"]]},
  "/team/fabian-shootmex/":{player:"Fabian / Shootmex",chars:[["Shootmex","blackhand"]]},
  "/team/florian/":{player:"Florian",chars:[["Mystikmonk","blackrock"]]},
  "/team/junstin-bragol/":{player:"Justin / Bragol",chars:[["Bragol","blackmoore"]]},
  "/team/kalilito-kalle/":{player:"Kalilito / Kalle",chars:[["Frontlfranz","thrall"],["Sturmgeweiht","thrall"],["Kallitto","thrall"],["Shubidu","thrall"]]},
  "/team/kevin/":{player:"Kevin",chars:[["Afm","anetheron"]]},
  "/team/marcel-juzoh/":{player:"Marcel / Juzoh",chars:[["Alisha","antonidas"],["Juzoh","blackhand"],["Neralla","antonidas"]]},
  "/team/patrik/":{player:"Patrik",chars:[["Bonefall","malganis"]]},
  "/team/rene-frosti/":{player:"René / Frosti",chars:[["Zêcks","nethersturm"],["Rôcket","nethersturm"]]},
  "/team/sahra-boesesmaedchen/":{player:"Sara / Bösesmädchen",chars:[["Mylady","durotan"],["Bösesmädchen","shattrath"],["Talalafee","amanthul"],["Profi","shattrath"]]},
  "/team/steffan-evel-bullet/":{player:"Stefan / Evil-Bullet",chars:[["Acron","nethersturm"],["Vry","nethersturm"],["Trake","nethersturm"],["Ghostzone","nethersturm"],["Kythor","nethersturm"],["Majéstý","nethersturm"]]},
  "/team/steven/":{player:"Steven",chars:[["Küschen","kelthuzad"],["Krümelkuchen","blackhand"]]},
  "/team/tanner/":{player:"Tanner",chars:[["Tanerdras","blackmoore"],["Tanerath","blackmoore"],["Taneragan","blackmoore"]]},
  "/team/tatjana-chathalon/":{player:"Tatjana / Câthalon",chars:[["Câthalon","eredar"],["Ásunâ","eredar"],["Nasjátàr","nozdormu"],["Kirarà","eredar"],["Cathâlón","eredar"],["Câthalon","nozdormu"]]},
  "/team/tim/":{player:"Tim",chars:[["Xelthuzar","blackhand"],["Velyara","antonidas"],["Aváelle","antonidas"],["Xerjin","blackhand"]]},
  "/team/tobi/":{player:"Tobi",chars:[["Garnof","blackhand"],["Lafonio","blackhand"],["Lackdosejary","blackhand"],["Iranja","blackhand"]]}
};
function waschiNormTeamPath(){
  let p=location.pathname;
  if(!p.endsWith("/"))p+="/";
  return p;
}
function waschiCharacterCard(name,realm){
  const detail="/charakter/?realm="+encodeURIComponent(realm)+"&name="+encodeURIComponent(name);
  const rio="https://raider.io/characters/eu/"+encodeURIComponent(realm)+"/"+encodeURIComponent(name);
  const safeName=name.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  const safeRealm=realm.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  return '<article class="character-entry" data-character="'+safeName+'" data-realm="'+safeRealm+'" data-detail="'+detail+'" role="link" tabindex="0" aria-label="'+safeName+' Charakterdetails öffnen">'+
    '<div class="character-card-art"><img data-char-image alt="'+safeName+' – Charakterbild" hidden><div class="character-card-fallback" data-char-fallback aria-hidden="true"></div></div>'+
    '<div class="character-entry-body"><div class="character-entry-head"><div class="character-monogram">'+safeName.charAt(0).toUpperCase()+'</div><div><h3>'+safeName+'</h3><span class="character-realm">'+safeRealm.charAt(0).toUpperCase()+safeRealm.slice(1)+'</span></div></div>'+
    '<div class="character-live-facts"><div><span>Klasse</span><strong data-char-class>—</strong></div><div><span>Skillung</span><strong data-char-spec>—</strong></div><div><span>M+ Wertung</span><strong data-char-score>—</strong></div></div>'+
    '<div class="character-links"><a class="character-source-link raider" target="_blank" rel="noopener noreferrer" href="'+rio+'" aria-label="'+safeName+' auf Raider.IO öffnen"><img src="https://cdn.raiderio.net/images/brand/Logo_2ColorWhite.svg" alt="Raider.IO"></a></div>'+
    '<div class="character-open-hint">Kachel anklicken für Charakterdetails</div></div></article>';
}
function waschiRenderAuthoritativeProfile(){
  const cfg=waschiGuildAssignments[waschiNormTeamPath()];
  if(!cfg)return;
  const page=document.querySelector(".member-profile-page");
  const dir=page&&page.querySelector(".character-directory");
  if(!dir)return;
  const signature=cfg.chars.map(x=>x[0]+"@"+x[1]).join("|");
  if(dir.dataset.waschiAssignmentSignature===signature)return;
  dir.dataset.waschiAssignmentSignature=signature;
  dir.innerHTML=cfg.chars.map(x=>waschiCharacterCard(x[0],x[1])).join("");
  const count=page.querySelector(".character-count strong,[data-character-count]");
  if(count)count.textContent=String(cfg.chars.length);
  if(waschiNormTeamPath()==="/team/dimi/"||waschiNormTeamPath()==="/team/dima/"){
    const h1=page.querySelector(".profile-heading h1");if(h1)h1.innerHTML='Dima <span>/ Dimi</span>';
    const bc=page.querySelector(".breadcrumbs strong");if(bc)bc.textContent="Dima / Dimi";
  }
  if(waschiNormTeamPath()==="/team/sahra-boesesmaedchen/"){
    const h1=page.querySelector(".profile-heading h1");if(h1)h1.innerHTML='Sara <span>/ Bösesmädchen</span>';
    const bc=page.querySelector(".breadcrumbs strong");if(bc)bc.textContent="Sara / Bösesmädchen";
  }
  dir.querySelectorAll(".character-entry").forEach(function(card){
    card.addEventListener("click",function(e){if(!e.target.closest("a"))location.href=card.dataset.detail});
    card.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&!e.target.closest("a")){e.preventDefault();location.href=card.dataset.detail}});
    load(card);
  });
}
const waschiExtraPlayers=[
  {href:"/team/dennis/",name:"Dennis",sub:"World of Warcraft · Blackhand"},
  {href:"/team/florian/",name:"Florian",sub:"World of Warcraft · Blackrock"},
  {href:"/team/patrik/",name:"Patrik",sub:"World of Warcraft · Mal'Ganis"},
  {href:"/team/tanner/",name:"Tanner",sub:"World of Warcraft · Blackmoore"}
];
function waschiMemberCard(def){
  const initial=def.name.charAt(0).toUpperCase();
  const a=document.createElement("a");
  a.className="member-card";a.href=def.href;a.dataset.waschiAuthoritativePlayer="1";
  a.innerHTML='<div class="member-art"><div class="member-monogram">'+initial+'</div></div><div class="member-copy"><span class="member-kicker">Waschi Gilde</span><h2>'+def.name+'</h2><p>'+def.sub+'</p><p><strong style="color:#e7b445">Gildenrang:</strong> Gildenmitglied</p><span class="member-link">Profil &amp; Charaktere ansehen →</span></div>';
  return a;
}
function waschiApplyTeamOverviewAssignments(){
  if(waschiNormTeamPath()!=="/team/")return;
  const grid=document.querySelector(".member-grid");if(!grid)return;
  ["/team/kurt/","/team/patrick-paddy/","/team/dima/"].forEach(function(h){const el=grid.querySelector('a[href="'+h+'"]');if(el)el.remove()});
  const sara=grid.querySelector('a[href="/team/sahra-boesesmaedchen/"] h2');
  if(sara&&sara.innerHTML!=='Sara <small>/ Bösesmädchen</small>')sara.innerHTML='Sara <small>/ Bösesmädchen</small>';
  const dimi=grid.querySelector('a[href="/team/dimi/"] h2');
  if(dimi&&dimi.innerHTML!=='Dima <small>/ Dimi</small>')dimi.innerHTML='Dima <small>/ Dimi</small>';
  const anchor=grid.querySelector(".unassigned-character-directory,.unassigned-divider");
  waschiExtraPlayers.forEach(function(def){if(!grid.querySelector('a[href="'+def.href+'"]'))grid.insertBefore(waschiMemberCard(def),anchor||null)});
  const assigned=new Set();
  Object.values(waschiGuildAssignments).forEach(function(cfg){cfg.chars.forEach(function(ch){assigned.add(ch[0].normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase())})});
  grid.querySelectorAll(".unassigned-live-card").forEach(function(card){
    const n=(card.dataset.character||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    if(assigned.has(n))card.remove();
  });
  const left=grid.querySelectorAll(".unassigned-live-card").length;
  grid.querySelectorAll(".unassigned-divider small").forEach(function(el){const next="("+left+")";if(el.textContent!==next)el.textContent=next});
}
function applyGuildAssignments(){
  waschiApplyTeamOverviewAssignments();
  waschiRenderAuthoritativeProfile();
}

function boot(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();applyGuildAssignments();scan();applyHalloweenTheme()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
new MutationObserver(function(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();applyGuildAssignments();scan();applyHalloweenTheme()}).observe(document.documentElement,{childList:true,subtree:true});
const s=document.createElement("script");s.src=upstream;s.async=true;document.head.appendChild(s);
})();