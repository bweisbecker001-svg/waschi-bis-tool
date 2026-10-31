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
  document.documentElement.classList.add('waschi-halloween','waschi-halloween-extreme');
  if(!document.getElementById('waschi-halloween-style')){
    const style=document.createElement('style');
    style.id='waschi-halloween-style';
    style.textContent=`
html.waschi-halloween{--hw-orange:#ff6a00;--hw-blood:#8d0000;--hw-green:#8be85f;--hw-violet:#8d39d8;--hw-void:#09030d}
html.waschi-halloween body{background:#030104!important;color:#ddd0c9!important}
html.waschi-halloween body:before{content:"";position:fixed;inset:0;z-index:2147481000;pointer-events:none;background:
radial-gradient(circle at 50% -10%,rgba(160,18,8,.24),transparent 36%),
radial-gradient(circle at 10% 18%,rgba(112,20,150,.22),transparent 28%),
radial-gradient(circle at 90% 14%,rgba(255,92,0,.19),transparent 26%),
linear-gradient(180deg,rgba(4,0,8,.2),rgba(10,0,0,.54));mix-blend-mode:screen}
html.waschi-halloween body:after{content:"";position:fixed;inset:0;z-index:2147481100;pointer-events:none;background:
repeating-linear-gradient(90deg,transparent 0 96px,rgba(255,72,0,.016) 97px 98px),
repeating-linear-gradient(0deg,transparent 0 78px,rgba(130,15,160,.014) 79px 80px);
box-shadow:inset 0 0 160px 52px rgba(0,0,0,.76),inset 0 0 52px 12px rgba(100,0,0,.28)}
html.waschi-halloween .site-bg{filter:saturate(.68) brightness(.46) contrast(1.3) hue-rotate(325deg)!important}
html.waschi-halloween .header{background:linear-gradient(180deg,rgba(5,0,8,.985),rgba(30,2,8,.955))!important;border-bottom:1px solid rgba(255,88,0,.68)!important;box-shadow:0 14px 44px rgba(0,0,0,.88),0 0 34px rgba(150,0,0,.28),0 0 70px rgba(104,24,150,.13)!important}
html.waschi-halloween .header:after{content:"";position:absolute;left:0;right:0;bottom:-9px;height:10px;background:linear-gradient(90deg,transparent 1%,#620000 10%,#b01400 22%,#430000 35%,#a21b00 51%,#480000 67%,#a00d00 83%,transparent 99%);filter:blur(3px);opacity:.75;pointer-events:none}
html.waschi-halloween .brand-logo{filter:drop-shadow(0 0 13px rgba(255,72,0,.55)) drop-shadow(0 0 27px rgba(125,0,0,.4))!important}
html.waschi-halloween .brand strong{color:#ff963b!important;text-shadow:0 0 8px #8b1600,0 0 24px rgba(255,60,0,.55)!important}
html.waschi-halloween h1,html.waschi-halloween h2,html.waschi-halloween h3{color:#f0a757!important;text-shadow:0 2px 0 #3a0000,0 0 12px rgba(255,70,0,.28),0 0 28px rgba(110,0,0,.28)!important}
html.waschi-halloween .nav a{transition:.2s ease;text-shadow:0 0 8px rgba(0,0,0,.8)}
html.waschi-halloween .nav a:hover,html.waschi-halloween .nav a.active{color:#ff8b37!important;text-shadow:0 0 8px #e53b00,0 0 20px rgba(255,73,0,.6)!important}
html.waschi-halloween .btn.gold{background:linear-gradient(180deg,#ff7b16,#7b1700)!important;border-color:#ff9a47!important;color:#fff2df!important;box-shadow:0 0 10px rgba(255,85,0,.42),inset 0 0 12px rgba(255,185,90,.16)!important}
html.waschi-halloween .btn.dark{background:linear-gradient(180deg,#1b071d,#09040b)!important;border-color:rgba(140,48,171,.58)!important}
html.waschi-halloween .quick,html.waschi-halloween .panel,html.waschi-halloween .card,html.waschi-halloween .download-card,html.waschi-halloween .addon-card,html.waschi-halloween .addons-hero,html.waschi-halloween .addons-notice{border-color:rgba(130,38,18,.72)!important;background-color:rgba(8,3,8,.9)!important;box-shadow:0 18px 40px rgba(0,0,0,.84),0 0 22px rgba(121,0,0,.17),inset 0 0 30px rgba(70,0,65,.08)!important}
html.waschi-halloween .quick:hover,html.waschi-halloween .download-card:hover,html.waschi-halloween .addon-card:hover{transform:translateY(-2px) scale(1.006);box-shadow:0 22px 48px rgba(0,0,0,.9),0 0 26px rgba(255,67,0,.24),0 0 60px rgba(112,22,152,.12)!important}
html.waschi-halloween img{filter:saturate(.82) contrast(1.05)}
html.waschi-halloween .footer{border-top-color:rgba(120,0,0,.52)!important}
#waschi-halloween-fx{position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden}
#waschi-halloween-fx .hw-banner{position:fixed;top:116px;left:50%;transform:translateX(-50%);width:min(92vw,860px);padding:10px 22px;border:1px solid rgba(255,85,0,.72);border-radius:999px;background:linear-gradient(90deg,rgba(10,0,12,.92),rgba(42,2,5,.94),rgba(10,0,12,.92));color:#ffd0a1;font:800 12px/1.25 Georgia,serif;letter-spacing:.1em;text-transform:uppercase;text-align:center;box-shadow:0 0 20px rgba(255,70,0,.18),0 0 42px rgba(122,0,0,.18);backdrop-filter:blur(9px)}
#waschi-halloween-fx .hw-moon{position:absolute;right:4vw;top:14vh;width:170px;height:170px;border-radius:50%;background:
radial-gradient(circle at 33% 31%,#f1f0c8 0 6%,#b9c680 11%,transparent 12%),
radial-gradient(circle at 58% 58%,rgba(48,57,44,.45) 0 13%,transparent 14%),
radial-gradient(circle at 44% 48%,#b6c177 0 28%,#63704d 54%,rgba(31,40,31,.72) 67%,transparent 69%);
opacity:.66;filter:drop-shadow(0 0 20px rgba(161,205,93,.36)) drop-shadow(0 0 55px rgba(124,255,76,.12))}
#waschi-halloween-fx .hw-moon:after{content:"";position:absolute;inset:-25%;border-radius:50%;border:1px solid rgba(157,230,106,.13);box-shadow:0 0 45px rgba(115,212,78,.14)}
#waschi-halloween-fx .hw-fog{position:absolute;left:-25vw;width:150vw;height:30vh;border-radius:50%;background:radial-gradient(ellipse at center,rgba(210,216,224,.18),rgba(116,77,125,.09) 40%,rgba(60,8,36,.07) 56%,transparent 72%);filter:blur(22px);animation:hwFog 15s ease-in-out infinite alternate}
#waschi-halloween-fx .hw-fog.one{bottom:-3vh}#waschi-halloween-fx .hw-fog.two{bottom:20vh;opacity:.66;animation-duration:21s;animation-direction:alternate-reverse}#waschi-halloween-fx .hw-fog.three{top:14vh;opacity:.32;height:22vh;animation-duration:27s}
#waschi-halloween-fx .hw-vignette{position:absolute;inset:0;box-shadow:inset 0 0 180px 58px rgba(0,0,0,.74),inset 0 0 36px 6px rgba(90,0,0,.34)}
#waschi-halloween-fx .hw-lightning{position:absolute;inset:0;background:rgba(185,145,255,.0);animation:hwLightning 8.5s infinite}
#waschi-halloween-fx .hw-blood{position:absolute;left:0;right:0;top:0;height:72px;background:
radial-gradient(ellipse at 8% 0,#7d0000 0 9px,transparent 10px),
radial-gradient(ellipse at 22% 0,#940800 0 14px,transparent 15px),
radial-gradient(ellipse at 37% 0,#5f0000 0 8px,transparent 9px),
radial-gradient(ellipse at 59% 0,#8e0900 0 13px,transparent 14px),
radial-gradient(ellipse at 76% 0,#600000 0 9px,transparent 10px),
radial-gradient(ellipse at 92% 0,#930600 0 15px,transparent 16px);
opacity:.7;filter:drop-shadow(0 5px 5px rgba(0,0,0,.8))}
#waschi-halloween-fx .hw-blood:before,#waschi-halloween-fx .hw-blood:after{content:"";position:absolute;top:0;width:7px;border-radius:0 0 60% 60%;background:linear-gradient(#8e0700,#4b0000);box-shadow:0 0 7px rgba(120,0,0,.6)}
#waschi-halloween-fx .hw-blood:before{left:22%;height:54px}#waschi-halloween-fx .hw-blood:after{right:24%;height:38px}
#waschi-halloween-fx .hw-bats{position:absolute;left:2vw;top:21vh;width:55vw;height:26vh}
#waschi-halloween-fx .hw-bat{position:absolute;font-size:26px;color:#07030a;text-shadow:0 0 3px #6b1a78;animation:hwBat 6s ease-in-out infinite alternate}
#waschi-halloween-fx .hw-bat.b1{left:0;top:42%;animation-delay:-1s}.hw-bat.b2{left:17%;top:9%;font-size:19px;animation-delay:-3s}.hw-bat.b3{left:34%;top:52%;font-size:31px;animation-delay:-5s}.hw-bat.b4{left:51%;top:18%;font-size:16px;animation-delay:-2s}.hw-bat.b5{left:72%;top:60%;font-size:22px;animation-delay:-4s}
#waschi-halloween-fx .hw-skulls{position:absolute;left:2vw;bottom:2vh;font-size:32px;letter-spacing:12px;opacity:.72;filter:drop-shadow(0 0 9px rgba(150,30,0,.5));transform:rotate(-4deg)}
#waschi-halloween-fx .hw-pumpkins{position:absolute;right:2vw;bottom:2vh;font-size:38px;letter-spacing:7px;filter:drop-shadow(0 0 14px rgba(255,92,0,.55));opacity:.9}
#waschi-halloween-fx .hw-runes{position:absolute;inset:0;background:
radial-gradient(circle at 7% 63%,transparent 0 30px,rgba(120,30,145,.09) 31px 33px,transparent 34px),
radial-gradient(circle at 93% 70%,transparent 0 42px,rgba(255,60,0,.07) 43px 45px,transparent 46px);
animation:hwRunes 5s ease-in-out infinite alternate}
#waschi-halloween-fx .hw-whisper{position:absolute;left:50%;bottom:3vh;transform:translateX(-50%);color:rgba(255,175,125,.22);font:italic 700 clamp(16px,2vw,28px) Georgia,serif;letter-spacing:.18em;text-transform:uppercase;text-shadow:0 0 10px rgba(120,0,0,.55);white-space:nowrap;animation:hwWhisper 4.5s ease-in-out infinite alternate}
#waschi-halloween-fx .hw-web{position:absolute;width:310px;height:300px;opacity:.9;filter:drop-shadow(0 0 3px rgba(255,255,255,.2));transform-origin:center}
#waschi-halloween-fx .hw-web svg{display:block;width:100%;height:100%;overflow:visible}
#waschi-halloween-fx .hw-web .web-ray{stroke:rgba(242,242,242,.66);stroke-width:1.15;fill:none;vector-effect:non-scaling-stroke}
#waschi-halloween-fx .hw-web .web-ring{stroke:rgba(245,245,245,.58);stroke-width:1;fill:none;vector-effect:non-scaling-stroke}
#waschi-halloween-fx .hw-web .web-ring.soft{stroke:rgba(245,245,245,.38);stroke-width:.8}
#waschi-halloween-fx .hw-web .web-stray{stroke:rgba(245,245,245,.34);stroke-width:.75;fill:none}
#waschi-halloween-fx .hw-web .web-knot{fill:rgba(255,255,255,.72)}
#waschi-halloween-fx .hw-web.tl{left:-18px;top:-12px;transform:rotate(-4deg) scale(1.05)}
#waschi-halloween-fx .hw-web.tr{right:-24px;top:-14px;transform:scaleX(-1) rotate(-3deg)}
#waschi-halloween-fx .hw-web.bl{left:-24px;bottom:-26px;transform:scaleY(-1) rotate(3deg)}
#waschi-halloween-fx .hw-web.br{right:-26px;bottom:-26px;transform:scale(-1) rotate(-2deg)}
#waschi-halloween-fx .hw-spider-line{position:absolute;right:10vw;top:0;width:1px;height:160px;background:linear-gradient(rgba(225,225,225,.55),rgba(225,225,225,.18));animation:hwSpiderLine 6.5s ease-in-out infinite}
#waschi-halloween-fx .hw-spider{position:absolute;right:calc(10vw - 11px);top:138px;width:22px;height:20px;border-radius:50%;background:#08040a;box-shadow:0 0 9px rgba(125,35,145,.45);animation:hwSpider 6.5s ease-in-out infinite}
#waschi-halloween-fx .hw-spider:before,#waschi-halloween-fx .hw-spider:after{content:"";position:absolute;left:-9px;top:5px;width:40px;height:10px;border-top:2px solid #09050a;border-bottom:2px solid #09050a;transform:rotate(18deg)}
#waschi-halloween-fx .hw-spider:after{transform:rotate(-18deg)}
#waschi-halloween-fx .hw-eye{position:absolute;right:3vw;top:3vh;width:120px;height:72px;border-radius:55% 45% 55% 45%/60% 60% 40% 40%;background:radial-gradient(ellipse at center,#f3e2b4 0 35%,#6c2e22 55%,#1b0909 70%,transparent 72%);filter:drop-shadow(0 0 10px rgba(255,80,20,.48)) drop-shadow(0 0 24px rgba(120,0,0,.38));transform:rotate(-7deg)}
#waschi-halloween-fx .hw-eye:before{content:"";position:absolute;inset:-4px;border-radius:inherit;border:2px solid rgba(105,0,0,.6);box-shadow:inset 0 0 12px rgba(60,0,0,.8)}
#waschi-halloween-fx .hw-pupil{position:absolute;left:47px;top:23px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle,#050505 0 45%,#390000 48% 58%,#ff3a00 60% 64%,#100 66%);box-shadow:0 0 8px #ff4a00;animation:hwLook 7s steps(1,end) infinite}
#waschi-halloween-fx .hw-blood-stream{position:absolute;top:0;width:10px;border-radius:0 0 60% 60%;background:linear-gradient(#a20a00,#5d0000 72%,rgba(45,0,0,.18));box-shadow:0 0 6px rgba(120,0,0,.5);animation:hwBloodFlow 4.5s ease-in-out infinite alternate}
#waschi-halloween-fx .hw-blood-stream.s1{left:7%;height:110px;animation-delay:-1.1s}.hw-blood-stream.s2{left:18%;height:75px;animation-delay:-2.7s}.hw-blood-stream.s3{left:43%;height:125px;animation-delay:-.3s}.hw-blood-stream.s4{left:68%;height:92px;animation-delay:-3.2s}.hw-blood-stream.s5{right:9%;height:135px;animation-delay:-1.9s}
#waschi-halloween-fx .hw-bat-flight{position:absolute;left:-18vw;font-size:30px;color:#050207;text-shadow:0 0 5px #42104b;animation:hwFlyAcross linear infinite}
#waschi-halloween-fx .hw-bat-flight.f1{top:18%;animation-duration:12s}.hw-bat-flight.f2{top:33%;font-size:21px;animation-duration:17s;animation-delay:-5s}.hw-bat-flight.f3{top:51%;font-size:34px;animation-duration:21s;animation-delay:-11s}.hw-bat-flight.f4{top:68%;font-size:18px;animation-duration:15s;animation-delay:-8s}
#waschi-halloween-fx .hw-waschi{position:absolute;left:-330px;bottom:6vh;width:300px;height:150px;opacity:.88;filter:drop-shadow(0 0 12px rgba(95,255,135,.22)) drop-shadow(0 0 34px rgba(80,20,120,.25));animation:hwWaschiRide 19s linear infinite}
#waschi-halloween-fx .hw-waschi .hw-greenfire{position:absolute;left:10px;bottom:0;width:250px;height:40px;background:radial-gradient(ellipse at center,rgba(90,255,110,.34),rgba(42,128,58,.14) 45%,transparent 72%);filter:blur(7px);animation:hwGreenFire 1.4s ease-in-out infinite alternate}
#waschi-halloween-fx .hw-raccoon-body{position:absolute;left:78px;bottom:23px;width:124px;height:92px;border-radius:48% 52% 42% 40%;background:linear-gradient(180deg,#4a4a4f,#1f2024 55%,#0a0b0d);box-shadow:inset 0 0 18px rgba(255,255,255,.06)}
#waschi-halloween-fx .hw-raccoon-tail{position:absolute;left:24px;bottom:34px;width:88px;height:34px;border-radius:60% 20% 60% 20%;background:repeating-linear-gradient(90deg,#25262a 0 13px,#6a6b70 14px 25px);transform:rotate(-14deg);transform-origin:right center}
#waschi-halloween-fx .hw-raccoon-head{position:absolute;left:105px;bottom:91px;width:72px;height:62px;border-radius:48% 52% 48% 52%;background:linear-gradient(#777a7f,#393b40);animation:hwRaccoonNod 2.7s ease-in-out infinite}
#waschi-halloween-fx .hw-raccoon-head:before,#waschi-halloween-fx .hw-raccoon-head:after{content:"";position:absolute;top:-10px;width:24px;height:26px;background:#4b4d52;clip-path:polygon(50% 0,100% 100%,0 100%)}
#waschi-halloween-fx .hw-raccoon-head:before{left:4px;transform:rotate(-12deg)}#waschi-halloween-fx .hw-raccoon-head:after{right:4px;transform:rotate(12deg)}
#waschi-halloween-fx .hw-mask{position:absolute;left:10px;top:18px;width:52px;height:20px;border-radius:50%;background:#111216;box-shadow:0 0 6px rgba(0,0,0,.7)}
#waschi-halloween-fx .hw-mask:before,#waschi-halloween-fx .hw-mask:after{content:"";position:absolute;top:5px;width:7px;height:7px;border-radius:50%;background:#b4ff8b;box-shadow:0 0 8px rgba(105,255,100,.75)}
#waschi-halloween-fx .hw-mask:before{left:11px}#waschi-halloween-fx .hw-mask:after{right:11px}
#waschi-halloween-fx .hw-snout{position:absolute;left:23px;top:33px;width:28px;height:19px;border-radius:50%;background:#a5a3a0}
#waschi-halloween-fx .hw-snout:after{content:"";position:absolute;left:9px;top:2px;width:10px;height:8px;border-radius:50%;background:#090909}
#waschi-halloween-fx .hw-hat{position:absolute;left:105px;bottom:139px;width:76px;height:26px;border-radius:50%;background:#0b0c10;border:2px solid rgba(120,255,120,.14);transform-origin:28px 22px;animation:hwHatSalute 4.4s ease-in-out infinite}
#waschi-halloween-fx .hw-hat:before{content:"";position:absolute;left:20px;top:-31px;width:36px;height:38px;background:linear-gradient(90deg,#07080a,#18191d);clip-path:polygon(16% 100%,28% 16%,72% 0,88% 100%)}
#waschi-halloween-fx .hw-paw{position:absolute;left:164px;bottom:74px;width:46px;height:18px;border-radius:40%;background:#33353a;transform-origin:left center;animation:hwPawWave 2.4s ease-in-out infinite}
@keyframes hwFog{from{transform:translate3d(-7vw,0,0) scale(1)}to{transform:translate3d(8vw,-3vh,0) scale(1.11)}}
@keyframes hwBat{from{transform:translate3d(0,0,0) rotate(-8deg) scale(.9)}to{transform:translate3d(16vw,-7vh,0) rotate(10deg) scale(1.2)}}
@keyframes hwRunes{from{opacity:.35;filter:blur(0)}to{opacity:.75;filter:blur(1px)}}
@keyframes hwWhisper{from{opacity:.2;transform:translateX(-50%) scale(.98)}to{opacity:.6;transform:translateX(-50%) scale(1.03)}}
@keyframes hwLightning{0%,7%,9%,35%,37%,100%{background:rgba(210,180,255,0)}8%{background:rgba(210,180,255,.16)}36%{background:rgba(255,95,35,.08)}}
@keyframes hwSpiderLine{0%,100%{height:90px}50%{height:230px}}
@keyframes hwSpider{0%,100%{top:68px}50%{top:208px}}
@keyframes hwLook{0%,18%{transform:translate(0,0)}19%,36%{transform:translate(-18px,6px)}37%,56%{transform:translate(16px,-5px)}57%,75%{transform:translate(6px,10px)}76%,100%{transform:translate(-8px,-7px)}}
@keyframes hwBloodFlow{from{transform:scaleY(.82);opacity:.72}to{transform:scaleY(1.18);opacity:.95}}
@keyframes hwFlyAcross{0%{transform:translateX(0) translateY(0) rotate(-8deg) scale(.85)}20%{transform:translateX(28vw) translateY(-5vh) rotate(7deg) scale(1.05)}45%{transform:translateX(58vw) translateY(3vh) rotate(-4deg) scale(.92)}75%{transform:translateX(92vw) translateY(-7vh) rotate(9deg) scale(1.12)}100%{transform:translateX(135vw) translateY(2vh) rotate(-6deg) scale(.9)}}
@keyframes hwWaschiRide{0%{transform:translateX(0) scale(.86);opacity:0}8%{opacity:.82}48%{transform:translateX(62vw) scale(1);opacity:.94}88%{opacity:.78}100%{transform:translateX(145vw) scale(.9);opacity:0}}
@keyframes hwHatSalute{0%,22%,100%{transform:translate(0,0) rotate(0deg)}34%,46%{transform:translate(18px,-18px) rotate(28deg)}58%{transform:translate(8px,-8px) rotate(12deg)}}
@keyframes hwRaccoonNod{0%,100%{transform:rotate(0deg)}40%{transform:rotate(-4deg)}55%{transform:rotate(5deg)}}
@keyframes hwPawWave{0%,100%{transform:rotate(-8deg)}35%{transform:rotate(-38deg)}60%{transform:rotate(-20deg)}}
@keyframes hwGreenFire{from{opacity:.35;transform:scaleX(.92)}to{opacity:.72;transform:scaleX(1.08)}}
@media(max-width:700px){
 #waschi-halloween-fx .hw-banner{top:92px;font-size:9px;padding:7px 10px}
 #waschi-halloween-fx .hw-moon{width:105px;height:105px;top:16vh;right:-8px}
 #waschi-halloween-fx .hw-skulls{font-size:22px;letter-spacing:5px}
 #waschi-halloween-fx .hw-pumpkins{font-size:26px}
 #waschi-halloween-fx .hw-whisper{font-size:12px;bottom:6vh}
}
@media(prefers-reduced-motion:reduce){#waschi-halloween-fx *{animation:none!important}}
`;
    document.head.appendChild(style);
  }
  if(!document.getElementById('waschi-halloween-fx')&&document.body){
    const fx=document.createElement('div');fx.id='waschi-halloween-fx';fx.setAttribute('aria-hidden','true');
    fx.innerHTML=`<div class="hw-vignette"></div><div class="hw-lightning"></div><div class="hw-blood"></div><span class="hw-blood-stream s1"></span><span class="hw-blood-stream s2"></span><span class="hw-blood-stream s3"></span><span class="hw-blood-stream s4"></span><span class="hw-blood-stream s5"></span><div class="hw-runes"></div><div class="hw-web tl"><svg viewBox="0 0 300 290" aria-hidden="true">
<g>
<path class="web-ray" d="M58 55 L2 3"/><path class="web-ray" d="M58 55 L52 0"/><path class="web-ray" d="M58 55 L98 0"/><path class="web-ray" d="M58 55 L150 0"/><path class="web-ray" d="M58 55 L222 0"/><path class="web-ray" d="M58 55 L300 12"/><path class="web-ray" d="M58 55 L300 70"/><path class="web-ray" d="M58 55 L300 132"/><path class="web-ray" d="M58 55 L300 205"/><path class="web-ray" d="M58 55 L265 290"/><path class="web-ray" d="M58 55 L182 290"/><path class="web-ray" d="M58 55 L104 290"/><path class="web-ray" d="M58 55 L42 290"/><path class="web-ray" d="M58 55 L0 252"/><path class="web-ray" d="M58 55 L0 174"/><path class="web-ray" d="M58 55 L0 104"/>
<path class="web-ring" d="M42 41 C48 35 56 32 64 34 C76 36 83 44 83 55 C83 67 76 75 65 80 C54 84 43 79 37 70 C30 59 33 49 42 41"/>
<path class="web-ring" d="M29 29 C40 19 54 15 69 18 C87 21 101 34 105 50 C110 68 102 87 86 99 C69 111 49 111 31 101 C14 91 5 74 8 56 C10 45 18 37 29 29"/>
<path class="web-ring" d="M17 17 C33 3 55 -2 78 3 C104 8 125 27 132 51 C139 77 130 103 109 121 C88 139 59 144 34 134 C10 124 -4 101 -5 76 C-6 54 2 32 17 17"/>
<path class="web-ring soft" d="M6 5 C29 -14 61 -20 92 -12 C126 -3 154 22 164 54 C174 87 163 121 136 145 C109 169 72 177 38 164 C7 152 -13 126 -18 94 C-22 60 -13 28 6 5"/>
<path class="web-ring soft" d="M-7 -8 C23 -32 64 -39 104 -29 C146 -18 181 13 194 54 C208 96 193 139 159 169 C124 200 77 211 34 194 C-8 178 -34 143 -40 101 C-46 58 -32 18 -7 -8"/>
<path class="web-ring soft" d="M-21 -22 C17 -51 68 -60 116 -47 C166 -34 207 3 223 52 C239 102 222 153 181 189 C140 225 83 237 31 217 C-18 198 -49 156 -55 107 C-62 56 -46 11 -21 -22"/>
<path class="web-stray" d="M12 8 C60 62 115 112 177 159"/><path class="web-stray" d="M30 3 C92 58 160 103 234 142"/><path class="web-stray" d="M4 30 C76 95 139 169 194 254"/>
<circle class="web-knot" cx="58" cy="55" r="1.8"/><circle class="web-knot" cx="83" cy="55" r="1"/><circle class="web-knot" cx="105" cy="50" r=".9"/><circle class="web-knot" cx="132" cy="51" r=".8"/>
</g></svg></div><div class="hw-web tr"><svg viewBox="0 0 300 290" aria-hidden="true">
<g>
<path class="web-ray" d="M58 55 L2 3"/><path class="web-ray" d="M58 55 L52 0"/><path class="web-ray" d="M58 55 L98 0"/><path class="web-ray" d="M58 55 L150 0"/><path class="web-ray" d="M58 55 L222 0"/><path class="web-ray" d="M58 55 L300 12"/><path class="web-ray" d="M58 55 L300 70"/><path class="web-ray" d="M58 55 L300 132"/><path class="web-ray" d="M58 55 L300 205"/><path class="web-ray" d="M58 55 L265 290"/><path class="web-ray" d="M58 55 L182 290"/><path class="web-ray" d="M58 55 L104 290"/><path class="web-ray" d="M58 55 L42 290"/><path class="web-ray" d="M58 55 L0 252"/><path class="web-ray" d="M58 55 L0 174"/><path class="web-ray" d="M58 55 L0 104"/>
<path class="web-ring" d="M42 41 C48 35 56 32 64 34 C76 36 83 44 83 55 C83 67 76 75 65 80 C54 84 43 79 37 70 C30 59 33 49 42 41"/>
<path class="web-ring" d="M29 29 C40 19 54 15 69 18 C87 21 101 34 105 50 C110 68 102 87 86 99 C69 111 49 111 31 101 C14 91 5 74 8 56 C10 45 18 37 29 29"/>
<path class="web-ring" d="M17 17 C33 3 55 -2 78 3 C104 8 125 27 132 51 C139 77 130 103 109 121 C88 139 59 144 34 134 C10 124 -4 101 -5 76 C-6 54 2 32 17 17"/>
<path class="web-ring soft" d="M6 5 C29 -14 61 -20 92 -12 C126 -3 154 22 164 54 C174 87 163 121 136 145 C109 169 72 177 38 164 C7 152 -13 126 -18 94 C-22 60 -13 28 6 5"/>
<path class="web-ring soft" d="M-7 -8 C23 -32 64 -39 104 -29 C146 -18 181 13 194 54 C208 96 193 139 159 169 C124 200 77 211 34 194 C-8 178 -34 143 -40 101 C-46 58 -32 18 -7 -8"/>
<path class="web-ring soft" d="M-21 -22 C17 -51 68 -60 116 -47 C166 -34 207 3 223 52 C239 102 222 153 181 189 C140 225 83 237 31 217 C-18 198 -49 156 -55 107 C-62 56 -46 11 -21 -22"/>
<path class="web-stray" d="M12 8 C60 62 115 112 177 159"/><path class="web-stray" d="M30 3 C92 58 160 103 234 142"/><path class="web-stray" d="M4 30 C76 95 139 169 194 254"/>
<circle class="web-knot" cx="58" cy="55" r="1.8"/><circle class="web-knot" cx="83" cy="55" r="1"/><circle class="web-knot" cx="105" cy="50" r=".9"/><circle class="web-knot" cx="132" cy="51" r=".8"/>
</g></svg></div><div class="hw-web bl"><svg viewBox="0 0 300 290" aria-hidden="true">
<g>
<path class="web-ray" d="M58 55 L2 3"/><path class="web-ray" d="M58 55 L52 0"/><path class="web-ray" d="M58 55 L98 0"/><path class="web-ray" d="M58 55 L150 0"/><path class="web-ray" d="M58 55 L222 0"/><path class="web-ray" d="M58 55 L300 12"/><path class="web-ray" d="M58 55 L300 70"/><path class="web-ray" d="M58 55 L300 132"/><path class="web-ray" d="M58 55 L300 205"/><path class="web-ray" d="M58 55 L265 290"/><path class="web-ray" d="M58 55 L182 290"/><path class="web-ray" d="M58 55 L104 290"/><path class="web-ray" d="M58 55 L42 290"/><path class="web-ray" d="M58 55 L0 252"/><path class="web-ray" d="M58 55 L0 174"/><path class="web-ray" d="M58 55 L0 104"/>
<path class="web-ring" d="M42 41 C48 35 56 32 64 34 C76 36 83 44 83 55 C83 67 76 75 65 80 C54 84 43 79 37 70 C30 59 33 49 42 41"/>
<path class="web-ring" d="M29 29 C40 19 54 15 69 18 C87 21 101 34 105 50 C110 68 102 87 86 99 C69 111 49 111 31 101 C14 91 5 74 8 56 C10 45 18 37 29 29"/>
<path class="web-ring" d="M17 17 C33 3 55 -2 78 3 C104 8 125 27 132 51 C139 77 130 103 109 121 C88 139 59 144 34 134 C10 124 -4 101 -5 76 C-6 54 2 32 17 17"/>
<path class="web-ring soft" d="M6 5 C29 -14 61 -20 92 -12 C126 -3 154 22 164 54 C174 87 163 121 136 145 C109 169 72 177 38 164 C7 152 -13 126 -18 94 C-22 60 -13 28 6 5"/>
<path class="web-ring soft" d="M-7 -8 C23 -32 64 -39 104 -29 C146 -18 181 13 194 54 C208 96 193 139 159 169 C124 200 77 211 34 194 C-8 178 -34 143 -40 101 C-46 58 -32 18 -7 -8"/>
<path class="web-ring soft" d="M-21 -22 C17 -51 68 -60 116 -47 C166 -34 207 3 223 52 C239 102 222 153 181 189 C140 225 83 237 31 217 C-18 198 -49 156 -55 107 C-62 56 -46 11 -21 -22"/>
<path class="web-stray" d="M12 8 C60 62 115 112 177 159"/><path class="web-stray" d="M30 3 C92 58 160 103 234 142"/><path class="web-stray" d="M4 30 C76 95 139 169 194 254"/>
<circle class="web-knot" cx="58" cy="55" r="1.8"/><circle class="web-knot" cx="83" cy="55" r="1"/><circle class="web-knot" cx="105" cy="50" r=".9"/><circle class="web-knot" cx="132" cy="51" r=".8"/>
</g></svg></div><div class="hw-web br"><svg viewBox="0 0 300 290" aria-hidden="true">
<g>
<path class="web-ray" d="M58 55 L2 3"/><path class="web-ray" d="M58 55 L52 0"/><path class="web-ray" d="M58 55 L98 0"/><path class="web-ray" d="M58 55 L150 0"/><path class="web-ray" d="M58 55 L222 0"/><path class="web-ray" d="M58 55 L300 12"/><path class="web-ray" d="M58 55 L300 70"/><path class="web-ray" d="M58 55 L300 132"/><path class="web-ray" d="M58 55 L300 205"/><path class="web-ray" d="M58 55 L265 290"/><path class="web-ray" d="M58 55 L182 290"/><path class="web-ray" d="M58 55 L104 290"/><path class="web-ray" d="M58 55 L42 290"/><path class="web-ray" d="M58 55 L0 252"/><path class="web-ray" d="M58 55 L0 174"/><path class="web-ray" d="M58 55 L0 104"/>
<path class="web-ring" d="M42 41 C48 35 56 32 64 34 C76 36 83 44 83 55 C83 67 76 75 65 80 C54 84 43 79 37 70 C30 59 33 49 42 41"/>
<path class="web-ring" d="M29 29 C40 19 54 15 69 18 C87 21 101 34 105 50 C110 68 102 87 86 99 C69 111 49 111 31 101 C14 91 5 74 8 56 C10 45 18 37 29 29"/>
<path class="web-ring" d="M17 17 C33 3 55 -2 78 3 C104 8 125 27 132 51 C139 77 130 103 109 121 C88 139 59 144 34 134 C10 124 -4 101 -5 76 C-6 54 2 32 17 17"/>
<path class="web-ring soft" d="M6 5 C29 -14 61 -20 92 -12 C126 -3 154 22 164 54 C174 87 163 121 136 145 C109 169 72 177 38 164 C7 152 -13 126 -18 94 C-22 60 -13 28 6 5"/>
<path class="web-ring soft" d="M-7 -8 C23 -32 64 -39 104 -29 C146 -18 181 13 194 54 C208 96 193 139 159 169 C124 200 77 211 34 194 C-8 178 -34 143 -40 101 C-46 58 -32 18 -7 -8"/>
<path class="web-ring soft" d="M-21 -22 C17 -51 68 -60 116 -47 C166 -34 207 3 223 52 C239 102 222 153 181 189 C140 225 83 237 31 217 C-18 198 -49 156 -55 107 C-62 56 -46 11 -21 -22"/>
<path class="web-stray" d="M12 8 C60 62 115 112 177 159"/><path class="web-stray" d="M30 3 C92 58 160 103 234 142"/><path class="web-stray" d="M4 30 C76 95 139 169 194 254"/>
<circle class="web-knot" cx="58" cy="55" r="1.8"/><circle class="web-knot" cx="83" cy="55" r="1"/><circle class="web-knot" cx="105" cy="50" r=".9"/><circle class="web-knot" cx="132" cy="51" r=".8"/>
</g></svg></div><div class="hw-spider-line"></div><div class="hw-spider"></div><div class="hw-eye"><span class="hw-pupil"></span></div><div class="hw-banner">☠ Azeroth ist verflucht · Waschi Halloween 2026 · Betritt die Schatten auf eigene Gefahr ☠</div><div class="hw-moon"></div><div class="hw-fog one"></div><div class="hw-fog two"></div><div class="hw-fog three"></div><div class="hw-bats"><span class="hw-bat b1">⌁</span><span class="hw-bat b2">⌁</span><span class="hw-bat b3">⌁</span><span class="hw-bat b4">⌁</span><span class="hw-bat b5">⌁</span></div><span class="hw-bat-flight f1">⌁</span><span class="hw-bat-flight f2">⌁</span><span class="hw-bat-flight f3">⌁</span><span class="hw-bat-flight f4">⌁</span><div class="hw-waschi"><div class="hw-greenfire"></div><div class="hw-raccoon-tail"></div><div class="hw-raccoon-body"></div><div class="hw-raccoon-head"><span class="hw-mask"></span><span class="hw-snout"></span></div><div class="hw-hat"></div><div class="hw-paw"></div></div><div class="hw-skulls">☠ ☠ ☠</div><div class="hw-pumpkins">🎃 🎃</div><div class="hw-whisper">Die Schatten beobachten dich …</div>`;

    document.body.appendChild(fx);
  }
}
function boot(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();scan();applyHalloweenTheme()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
new MutationObserver(function(){enhanceDownloads();configureExternalLinks();forceHeaderLogoSize();scan();applyHalloweenTheme()}).observe(document.documentElement,{childList:true,subtree:true});
const s=document.createElement("script");s.src=upstream;s.async=true;document.head.appendChild(s);
})();