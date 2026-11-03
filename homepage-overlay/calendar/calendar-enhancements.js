(function(){
'use strict';
const SHORT={
  'Allerheiligen':'Allerheil.','Weihnachten':'Weihnacht.','Heiligabend':'Heiligab.','Silvester':'Silvest.',
  'Karfreitag':'Karfreit.','Ostermontag':'Ostermont.','Pfingstmontag':'Pfingstm.','Christi Himmelfahrt':'Himmelf.',
  'Fronleichnam':'Fronleich.'
};
function shortTitle(value){
  const raw=String(value||'').trim();
  if(SHORT[raw]) return SHORT[raw];
  if(raw.length<=10) return raw;
  const words=raw.split(/\s+/).filter(Boolean);
  if(words.length>1){
    const compact=words.map((w,i)=>i===0?w.slice(0,7):w.slice(0,4)).join(' ');
    if(compact.length<=12) return compact;
  }
  return raw.slice(0,9).replace(/[\s.,;:!?-]+$/,'')+'.';
}
function prepareDay(day){
  if(!day || day.dataset.waschiGrid==='1') return;
  const events=[...day.children].filter(el=>el.classList&&el.classList.contains('cal-event'));
  if(!events.length) return;
  const grid=document.createElement('div');grid.className='cal-event-grid';
  events.forEach(ev=>grid.appendChild(ev));day.appendChild(grid);day.dataset.waschiGrid='1';
}
function prepareEvent(ev){
  if(!ev || ev.dataset.waschiStyled==='1') return;
  const title=ev.querySelector('.event-mini-title');
  if(title){const full=title.textContent.trim();title.dataset.fullTitle=full;title.textContent=shortTitle(full);ev.title=full;}
  const icon=ev.querySelector('.event-mini-icon');if(icon) icon.textContent='';
  ev.dataset.waschiStyled='1';
}
function prepareUpcoming(root){
  root.querySelectorAll('[class^="upcoming-cat-"],[class*=" upcoming-cat-"]').forEach(btn=>{
    const icon=btn.querySelector('.upcoming-icon');if(icon)icon.textContent='';
  });
}
function prepareDetail(root){const icon=root.querySelector('.detail-icon');if(icon)icon.textContent='';}
function styleCalendar(){
  document.querySelectorAll('.cal-day').forEach(day=>{day.removeAttribute('data-waschi-grid');prepareDay(day)});
  document.querySelectorAll('.cal-event').forEach(prepareEvent);
  const up=document.querySelector('[data-upcoming]');if(up)prepareUpcoming(up);
  const detail=document.querySelector('[data-event-detail]');if(detail)prepareDetail(detail);
}
function moveAddButton(){
  const actions=document.querySelector('.calendar-actions');
  const side=document.querySelector('.calendar-side');
  if(actions&&side&&actions.parentElement!==side) side.insertBefore(actions,side.firstChild);
}
function cleanLegend(){
  document.querySelectorAll('.calendar-legend .legend-item').forEach(item=>{
    [...item.childNodes].forEach(n=>{if(n.nodeType===3)n.textContent=''})
  });
}
function observe(){
  const root=document.querySelector('[data-calendar-root]');
  const up=document.querySelector('[data-upcoming]');
  const detail=document.querySelector('[data-event-detail]');
  const opts={childList:true,subtree:true};
  const cb=()=>requestAnimationFrame(styleCalendar);
  if(root)new MutationObserver(cb).observe(root,opts);
  if(up)new MutationObserver(cb).observe(up,opts);
  if(detail)new MutationObserver(cb).observe(detail,opts);
}
function init(){moveAddButton();cleanLegend();styleCalendar();observe()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();