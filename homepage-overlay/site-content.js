(function(){
'use strict';
const S={auth:null,content:{calendar:[],news:[]},month:new Date(),calendarFilter:'all'};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtDate(v){if(!v)return'';const d=new Date(v+'T12:00:00');return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(d)}
function safeLink(v){try{const u=new URL(v,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:''}catch(e){return''}}
async function api(url,opt){const r=await fetch(url,{credentials:'same-origin',...(opt||{})});let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j}
function injectStyles(){if(document.getElementById('site-content-style'))return;const st=document.createElement('style');st.id='site-content-style';st.textContent='.site-login-btn{border:1px solid #725523;background:#0d141c;color:#eacb77;padding:7px 10px;border-radius:4px;cursor:pointer;white-space:nowrap}.site-admin-panel label{display:block;color:#d6cbb9;margin:10px 0;font-size:13px}.site-admin-panel input,.site-admin-panel textarea,.site-admin-panel select{width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #4b5660;border-radius:4px;background:#0a1017;color:#eee}.site-admin-panel .check{display:flex;gap:8px;align-items:center}.site-admin-panel .check input{width:auto;margin:0}.site-form-status{color:#e4c575}';document.head.appendChild(st)}
function addNav(){
 document.querySelectorAll('.nav').forEach(n=>{if(!n.querySelector('a[href="/calendar/"]')){const a=document.createElement('a');a.href='/calendar/';a.innerHTML='<span class="ico">▦</span><span>Kalender</span>';n.appendChild(a)}});
 const rn=document.querySelector('.rightnav');if(rn&&!rn.querySelector('[data-site-login]')){const b=document.createElement('button');b.type='button';b.dataset.siteLogin='1';b.className='site-login-btn';rn.appendChild(b);b.addEventListener('click',async()=>{if(S.auth&&S.auth.user){await api('/api/site-auth/logout',{method:'POST'});location.reload()}else{location.href='/api/site-auth/login?next='+encodeURIComponent(location.pathname+location.search)}})}
}
function updateLogin(){
 const b=document.querySelector('[data-site-login]');if(!b)return;
 if(S.auth&&S.auth.user){b.textContent='Discord: '+(S.auth.user.globalName||S.auth.user.username)+' · Abmelden'}else b.textContent='Mit Discord anmelden';
}
async function renderDiscordOnline(){
 const box=document.querySelector('[data-discord-online]'),count=document.querySelector('[data-discord-count]');
 if(!box)return;
 try{
   const data=await api('/api/discord-online');
   if(!data.ok){
     box.innerHTML='<span class="hero-discord-empty">Discord-Status derzeit nicht verfügbar.</span>';
     if(count)count.textContent='Verbindung nicht verfügbar';
     return;
   }

   const online=data.online==null?null:Number(data.online||0),total=data.total==null?null:Number(data.total||0),voice=Number(data.voiceMembers||0);
   if(count){
     if(online!==null)count.textContent=online+' Mitglied'+(online===1?'':'er')+' online'+(total!==null?' · '+total+' insgesamt':'');
     else count.textContent=voice+' Mitglied'+(voice===1?'':'er')+' gerade im Voice';
   }

   const channels=(data.voiceChannels||[]).filter(c=>Array.isArray(c.members)&&c.members.length);
   if(data.voiceAvailable&&channels.length){
     box.innerHTML=channels.slice(0,4).map(c=>{
       const members=c.members.slice(0,8).map(m=>{
         const avatar=safeLink(m.avatar);
         const img=avatar?'<img class="hero-discord-avatar" src="'+esc(avatar)+'" alt="">':'<span class="hero-discord-avatar hero-discord-fallback">'+esc((m.name||'?').slice(0,1).toUpperCase())+'</span>';
         return '<div class="hero-discord-member">'+img+'<span class="hero-discord-member-name">'+esc(m.name||m.username||'Discord-Mitglied')+'</span><span class="hero-discord-voice-dot" title="Im Sprachkanal">🎙</span></div>';
       }).join('');
       const extra=c.members.length>8?'<div class="hero-discord-more">+'+esc(c.members.length-8)+' weitere</div>':'';
       return '<section class="hero-discord-channel"><div class="hero-discord-channel-name">🔊 '+esc(c.name)+'</div>'+members+extra+'</section>';
     }).join('')+(voice?'<div class="hero-discord-more">'+esc(voice)+' Mitglied'+(voice===1?'':'er')+' gerade im Voice</div>':'');
     return;
   }

   if(data.voiceAvailable){
     box.innerHTML='<span class="hero-discord-empty">Aktuell ist niemand in einem Sprachkanal.</span>';
     return;
   }

   box.innerHTML='<span class="hero-discord-empty">Online-Zahl verfügbar. Der Voice-Status des Waschi-Bots ist gerade nicht erreichbar.</span>';
 }catch(e){
   box.innerHTML='<span class="hero-discord-empty">Discord-Status derzeit nicht verfügbar.</span>';
   if(count)count.textContent='Verbindung nicht verfügbar';
 }
}
function renderHomeNews(){
 const list=document.querySelector('.news-list');if(!list)return;
 const rows=(S.content.news||[]).slice(0,4);
 list.innerHTML=rows.map(n=>'<a class="news" href="/news/?id='+encodeURIComponent(n.id)+'" style="text-decoration:none;color:inherit"><div class="news-thumb"></div><div><span class="date">'+esc(fmtDate(n.date))+'</span><strong>'+esc(n.title)+'</strong></div><div class="arrow">›</div></a>').join('');
 const head=list.closest('.panel')?.querySelector('.panel-head');if(head&&S.auth?.canNews&&!head.querySelector('[data-news-manage]')){const a=document.createElement('a');a.href='/news/?admin=1';a.dataset.newsManage='1';a.className='panel-link';a.textContent='News verwalten →';head.appendChild(a)}
}
function renderHomeCalendarPreview(){
 const box=document.querySelector('[data-home-calendar-preview]');if(!box)return;
 const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const rows=(S.content.calendar||[]).filter(e=>(e.endDate||e.date)>=today).sort((a,b)=>(String(a.date||'')+String(a.time||'')).localeCompare(String(b.date||'')+String(b.time||''))).slice(0,4);
 if(!rows.length){box.innerHTML='<p class="home-calendar-empty">Aktuell sind keine kommenden Termine eingetragen.</p>';return}
 box.innerHTML=rows.map(e=>{const d=new Date((e.date||'')+'T12:00:00');const date=isNaN(d)?'':new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit'}).format(d);return '<a class="home-calendar-item" href="/calendar/"><span class="home-calendar-date">'+esc(date)+'</span><span class="home-calendar-copy"><strong>'+esc(e.title||'Termin')+'</strong><small>'+esc(catLabel(e.category))+(e.time?' · '+esc(e.time):'')+'</small></span></a>'}).join('');
}
function newsForm(existing){
 const n=existing||{};const box=document.createElement('section');box.className='article-panel site-admin-panel';
 box.innerHTML='<h2>'+(n.id?'News bearbeiten':'Neue News erstellen')+'</h2><form data-news-form><input type="hidden" name="id" value="'+esc(n.id||'')+'"><label>Titel<input name="title" required maxlength="180" value="'+esc(n.title||'')+'"></label><label>Datum<input name="date" type="date" required value="'+esc(n.date||new Date().toISOString().slice(0,10))+'"></label><label>Kurztext<textarea name="summary" rows="3" maxlength="700">'+esc(n.summary||'')+'</textarea></label><label>Vollständiger Text<textarea name="body" rows="8" maxlength="8000">'+esc(n.body||'')+'</textarea></label><label class="check"><input name="published" type="checkbox" '+(n.published===false?'':'checked')+'> Veröffentlichen</label><div class="article-actions"><button class="btn gold" type="submit">Speichern</button>'+(n.id?'<button class="btn dark" type="button" data-delete-news>Löschen</button>':'')+'</div><p class="site-form-status" data-status></p></form>';
 const form=box.querySelector('form');form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form),data=Object.fromEntries(fd.entries());data.published=fd.get('published')==='on';const st=form.querySelector('[data-status]');try{st.textContent='Speichere…';await api('/api/site-news',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});location.href='/news/'}catch(err){st.textContent=err.message}});
 box.querySelector('[data-delete-news]')?.addEventListener('click',async()=>{if(!confirm('Diese News wirklich löschen?'))return;await api('/api/site-news?id='+encodeURIComponent(n.id),{method:'DELETE'});location.href='/news/'});
 return box
}
function renderNews(){
 const grid=document.querySelector('.news-index-grid');if(!grid)return;
 const id=new URLSearchParams(location.search).get('id');
 if(id){const n=(S.content.news||[]).find(x=>x.id===id);if(n){grid.style.display='block';grid.innerHTML='<article class="article-panel"><span class="article-date">'+esc(fmtDate(n.date))+'</span><h2>'+esc(n.title)+'</h2><p>'+esc(n.body||n.summary||'')+'</p></article>';if(S.auth?.canNews)grid.appendChild(newsForm(n))}return}
 grid.innerHTML=(S.content.news||[]).map(n=>'<a class="news-index-card" href="/news/?id='+encodeURIComponent(n.id)+'"><span class="date">'+esc(fmtDate(n.date))+'</span><h2>'+esc(n.title)+'</h2><p>'+esc(n.summary||n.body||'')+'</p></a>').join('');
 if(S.auth?.canNews&&(new URLSearchParams(location.search).get('admin')==='1'||true)){const main=document.querySelector('.news-page');if(main&&!main.querySelector('[data-news-form]')){main.insertBefore(newsForm(),main.querySelector('.news-back'))}}
}
function catLabel(c){return({holiday:'Feiertag',wow:'WoW',waschi:'Waschi','patch-season':'Patch & Saison'})[c]||'Waschi'}
function catIcon(c){return({holiday:'▣',wow:'W',waschi:'🐾','patch-season':'⚒'})[c]||'•'}
function eventCard(e){return '<button class="cal-event cat-'+esc(e.category||'waschi')+'" data-event-id="'+esc(e.id)+'"><strong>'+esc(catIcon(e.category))+' '+esc(e.time?e.time+' ':'')+esc(e.title)+'</strong></button>'}
function daysInMonth(y,m){return new Date(y,m+1,0).getDate()}
function renderCalendar(){
 const root=document.querySelector('[data-calendar-root]');if(!root)return;
 const y=S.month.getFullYear(),m=S.month.getMonth();document.querySelector('[data-calendar-title]').textContent=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(S.month);
 const first=(new Date(y,m,1).getDay()+6)%7;const total=daysInMonth(y,m);let cells='';
 for(let i=0;i<42;i++){const d=i-first+1;const inMonth=d>=1&&d<=total;let date='';let events=[];if(inMonth){date=[y,String(m+1).padStart(2,'0'),String(d).padStart(2,'0')].join('-');events=(S.content.calendar||[]).filter(e=>e.date===date&&(S.calendarFilter==='all'||e.category===S.calendarFilter))}cells+='<div class="cal-day '+(inMonth?'':'muted')+'" '+(inMonth?'data-date="'+date+'"':'')+'><span class="cal-num">'+(inMonth?d:'')+'</span>'+events.map(eventCard).join('')+'</div>'}
 root.innerHTML=cells;
 root.querySelectorAll('.cal-day[data-date]').forEach(c=>c.addEventListener('dblclick',()=>{if(S.auth?.canCalendar)openEventForm({date:c.dataset.date})}));
 root.querySelectorAll('[data-event-id]').forEach(b=>b.addEventListener('click',()=>{const e=S.content.calendar.find(x=>x.id===b.dataset.eventId);showEvent(e)}));
 renderUpcoming();
}
function renderUpcoming(){const box=document.querySelector('[data-upcoming]');if(!box)return;const today=new Date().toISOString().slice(0,10);const rows=(S.content.calendar||[]).filter(e=>e.date>=today&&(S.calendarFilter==='all'||e.category===S.calendarFilter)).sort((a,b)=>(String(a.date||'')+String(a.time||'')).localeCompare(String(b.date||'')+String(b.time||''))).slice(0,4);box.innerHTML=rows.length?rows.map(e=>'<button data-event-id="'+esc(e.id)+'"><span>'+esc((e.date||'').slice(8,10)+'.'+(e.date||'').slice(5,7)+'.')+'</span><strong>'+esc(catIcon(e.category))+' '+esc(e.title)+'</strong></button>').join(''):'<p>Keine kommenden Termine für diesen Filter.</p>';box.querySelectorAll('[data-event-id]').forEach(b=>b.onclick=()=>showEvent(S.content.calendar.find(x=>x.id===b.dataset.eventId)))}
function showEvent(e){if(!e)return;const box=document.querySelector('[data-event-detail]');if(!box)return;box.innerHTML='<h3>'+esc(e.title)+'</h3><p><strong>'+esc(fmtDate(e.date))+(e.time?' · '+esc(e.time):'')+'</strong></p><p>'+esc(e.description||'')+'</p>'+(safeLink(e.link)?'<p><a class="btn dark" target="_blank" rel="noopener" href="'+esc(safeLink(e.link))+'">Link öffnen</a></p>':'')+(S.auth?.canCalendar?'<div class="article-actions"><button class="btn gold" data-edit>Bearbeiten</button><button class="btn dark" data-delete>Löschen</button></div>':'');box.querySelector('[data-edit]')?.addEventListener('click',()=>openEventForm(e));box.querySelector('[data-delete]')?.addEventListener('click',()=>deleteEvent(e.id))}
function openEventForm(e){if(!S.auth?.canCalendar)return;const dlg=document.querySelector('[data-event-dialog]');const f=dlg.querySelector('form');['id','title','date','endDate','time','endTime','category','description','link'].forEach(k=>{if(f.elements[k])f.elements[k].value=e?.[k]||''});dlg.showModal()}
async function deleteEvent(id){if(!confirm('Termin wirklich löschen?'))return;await api('/api/site-calendar?id='+encodeURIComponent(id),{method:'DELETE'});await loadContent();renderCalendar();document.querySelector('[data-event-detail]').innerHTML=''}
function initCalendarAdmin(){
 const dlg=document.querySelector('[data-event-dialog]');if(!dlg)return;
 document.querySelector('[data-add-event]')?.addEventListener('click',()=>openEventForm({date:new Date().toISOString().slice(0,10)}));dlg.querySelector('[data-close]')?.addEventListener('click',()=>dlg.close());
 dlg.querySelector('form').addEventListener('submit',async ev=>{ev.preventDefault();const f=ev.currentTarget,data=Object.fromEntries(new FormData(f).entries());try{await api('/api/site-calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});dlg.close();await loadContent();renderCalendar()}catch(err){f.querySelector('[data-status]').textContent=err.message}});
 const p=document.querySelector('[data-calendar-perms]');if(p&&S.auth?.canNews){p.hidden=false;const input=p.querySelector('input');input.value=(S.auth.calendarAdmins||[]).join(', ');p.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const admins=input.value.split(',').map(x=>x.trim()).filter(Boolean);const r=await api('/api/site-calendar-admins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({admins})});input.value=r.calendarAdmins.join(', ');p.querySelector('[data-status]').textContent='Gespeichert.'}}
 if(S.auth?.canCalendar)document.querySelector('[data-add-event]')?.removeAttribute('hidden')
}
async function loadContent(){try{S.content=await api('/api/site-content')}catch(e){console.warn(e)}}
async function boot(){
 injectStyles();addNav();renderDiscordOnline();
 try{S.auth=await api('/api/site-auth/status')}catch(e){S.auth={configured:false,user:null}}updateLogin();
 await loadContent();renderHomeNews();renderHomeCalendarPreview();renderNews();
 if(document.querySelector('[data-calendar-root]')){S.month=new Date();S.month.setDate(1);renderCalendar();initCalendarAdmin();document.querySelector('[data-prev]')?.addEventListener('click',()=>{S.month.setMonth(S.month.getMonth()-1);renderCalendar()});document.querySelector('[data-next]')?.addEventListener('click',()=>{S.month.setMonth(S.month.getMonth()+1);renderCalendar()});document.querySelectorAll('[data-calendar-filters] [data-filter]').forEach(btn=>btn.addEventListener('click',()=>{S.calendarFilter=btn.dataset.filter||'all';document.querySelectorAll('[data-calendar-filters] [data-filter]').forEach(x=>x.classList.toggle('active',x===btn));renderCalendar()}))}
 if(document.querySelector('[data-discord-online]'))setInterval(renderDiscordOnline,60000);
 const q=new URLSearchParams(location.search);if(q.get('auth')==='setup'){const m=document.querySelector('[data-auth-message]');if(m){m.hidden=false;m.textContent='Discord-Login ist technisch vorbereitet. Es fehlen noch Discord Client-ID und Client-Secret in Vercel.'}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();