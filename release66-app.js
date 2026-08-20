(() => {
'use strict';

const V='66';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$('#app');

const state={
  books:[], map:new Map(), bookCache:new Map(), corpora:{}, currentBook:null,currentChapter:null,
  selectedVerse:null, studyLoaded:false, studyHistory:[], studyMode:'study',
  audio:{audio:null,studyAudio:null,items:[],index:0,current:null,playing:false,paused:false,stopped:true,objectUrl:null,resumeAfterStudy:false},
  recognition:null, listening:false, ambient:null
};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const divine=s=>esc(s).replace(/\b(YHWH|Jesus)\b/g,'<span class="divine">$1</span>');
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const route=(slug,c=1,v='')=>`#read/${slug}/${c}${v?'/'+v:''}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeParse=(v,d)=>{try{const x=JSON.parse(v);return x??d}catch{return d}};
const categoryLabel={ot:'Old Testament',eth:'Ethiopian Canon',nt:'New Testament'};
const emit=(name,detail={})=>document.dispatchEvent(new CustomEvent(name,{detail}));

function localGet(k,d=null){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}}
function localSet(k,v){try{localStorage.setItem(k,v)}catch{}}
function profile(){
  const raw=safeParse(localGet('hobah:user','{}'),{});
  return {
    saved:Array.isArray(raw.saved)?raw.saved:[],
    notes:raw.notes&&typeof raw.notes==='object'&&!Array.isArray(raw.notes)?raw.notes:{},
    study:Array.isArray(raw.study)?raw.study:[]
  };
}
function saveProfile(p){localSet('hobah:user',JSON.stringify(p));updateHeart()}
function toast(msg){
  const el=$('#toast'); if(!el)return;
  el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1900);
}
function openSheet(title,html,{wide=false}={}){
  const d=$('#sheet'),card=$('.sheetCard',d),body=$('#sheetBody',d),h=$('#sheetTitle',d);
  h.textContent=title;body.innerHTML=html;card.classList.toggle('wide',wide);d.showModal();
  return body;
}
function closeSheet(){try{$('#sheet')?.close()}catch{}}
function setBusy(text='Loading…'){app.innerHTML=`<section class="loadState"><div class="spinner"></div><b>${esc(text)}</b><small>Please wait a moment.</small></section>`}
function friendlyError(title,detail=''){
  app.innerHTML=`<section class="errorState"><span>H</span><h1>${esc(title)}</h1><p>${esc(detail||'Something interrupted loading.')}</p><button class="primaryBtn" id="retryBtn">Try again</button></section>`;
  $('#retryBtn').onclick=()=>bootstrap(true);
}
async function fetchJSON(url,timeout=9000){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout);
  try{
    const r=await fetch(url,{cache:'no-store',signal:ctl.signal});
    if(!r.ok)throw Error(`${r.status} ${r.statusText}`);
    return await r.json();
  }finally{clearTimeout(t)}
}
async function bootstrap(force=false){
  if(!force && state.books.length){router();return}
  setBusy('Opening Hobah');
  try{
    const books=await fetchJSON(`/books.json?v=${V}`,9000);
    if(!Array.isArray(books)||!books.length)throw Error('Bible index was empty');
    state.books=books.map((b,i)=>({...b,order:i+1}));
    state.map=new Map(state.books.map(b=>[b.slug,b]));
    window.MEB_BOOKS=state.books;
    updateHeart(); renderDrawer(); bindGlobalOnce(); router();
  }catch(e){console.error(e);friendlyError('Hobah could not open','The Bible index did not arrive. Tap Try again — the app will not stay on a blank screen.')}
}

function bindGlobalOnce(){
  if(document.body.dataset.bound==='1')return;document.body.dataset.bound='1';

  $('#menuBtn').onclick=()=>openDrawer('all');
  $('#homeBtn').onclick=e=>{e.preventDefault();location.hash='#home'};
  $('#savedBtn').onclick=openLibrary;
  $('#studyAiHeaderBtn').onclick=()=>openStudy('study');
  $('#closeDrawer').onclick=closeDrawer;
  $('#backdrop').onclick=closeDrawer;
  $('#sheetClose').onclick=closeSheet;
  $('#bottomHome').onclick=()=>location.hash='#home';
  $('#bottomBooks').onclick=()=>openDrawer('all');
  $('#bottomStudy').onclick=()=>openStudy('study');
  $('#bottomLibrary').onclick=openLibrary;
  $('#searchForm').onsubmit=e=>{
    e.preventDefault();const q=clean($('#searchInput').value);if(q)location.hash='#search/'+encodeURIComponent(q);
  };
  $('#drawerFilters').addEventListener('click',e=>{
    const b=e.target.closest('[data-filter]');if(b)setDrawerFilter(b.dataset.filter);
  });
  $('#drawerBooks').addEventListener('click',e=>{if(e.target.closest('a'))closeDrawer()});
  $('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet'))closeSheet()});
  addEventListener('hashchange',router,{passive:true});
  addEventListener('pagehide',persistAudio,{passive:true});
}

function updateHeart(){
  const p=profile(),b=$('#savedBtn'); if(b)b.textContent=p.saved.length?'♥':'♡';
  const badge=$('#bottomLibraryCount');if(badge){badge.textContent=p.saved.length?String(Math.min(p.saved.length,99)):'';badge.hidden=!p.saved.length}
}
function renderDrawer(filter='all'){
  const box=$('#drawerBooks');if(!box)return;
  const list=state.books.filter(b=>filter==='all'||b.category===filter);
  box.innerHTML=list.map(b=>`<a href="${route(b.slug,1)}" class="drawerBook"><span class="bookNo">${String(b.order).padStart(2,'0')}</span><span><b>${esc(b.title)}</b><small>${b.chapters.length} ${b.title==='Psalms'?'psalms':'chapters'}</small></span><i>›</i></a>`).join('');
}
function openDrawer(filter='all'){setDrawerFilter(filter);$('#drawer').classList.add('open');$('#backdrop').classList.add('open');document.body.classList.add('locked')}
function closeDrawer(){$('#drawer').classList.remove('open');$('#backdrop').classList.remove('open');document.body.classList.remove('locked')}
function setDrawerFilter(filter){$$('[data-filter]',$('#drawerFilters')).forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));renderDrawer(filter)}

function router(){
  closeDrawer();closeSheet();
  const h=location.hash||'#home';
  $$('.bottomNav button').forEach(b=>b.classList.remove('active'));
  if(h==='#home'||h===''){ $('#bottomHome')?.classList.add('active');renderHome();return}
  if(h.startsWith('#read/')){const p=h.slice(6).split('/');renderChapter(p[0],+(p[1]||1),p[2]?+p[2]:null);return}
  if(h.startsWith('#search/')){renderSearch(decodeURIComponent(h.slice(8)));return}
  renderHome();
}
function lastRead(){return safeParse(localGet('hobah:last','null'),null)}
function dailyPassage(){
  const choices=[['psalms',23],['matthew',5],['john',1],['romans',8],['proverbs',3],['isaiah',40],['1-enoch',1],['jubilees',1]];
  const n=Math.floor(Date.now()/86400000)%choices.length;return choices[n];
}
const feelings=[
  {id:'anxious',label:'Anxious',sub:'I need calm',slug:'psalms',chapter:46,icon:'≈'},
  {id:'grateful',label:'Grateful',sub:'I want to give thanks',slug:'psalms',chapter:100,icon:'✦'},
  {id:'lost',label:'Lost',sub:'I need direction',slug:'proverbs',chapter:3,icon:'⌁'},
  {id:'grieving',label:'Grieving',sub:'I need comfort',slug:'psalms',chapter:34,icon:'◌'},
  {id:'hopeful',label:'Hopeful',sub:'I want courage',slug:'isaiah',chapter:40,icon:'↑'},
  {id:'peace',label:'Need peace',sub:'I need stillness',slug:'john',chapter:14,icon:'○'}
];
function renderHome(){
  const last=lastRead(),[ds,dc]=dailyPassage(),p=profile();
  const cont=last&&state.map.has(last.slug)?last:{slug:'genesis',title:'Genesis',chapter:1};
  app.innerHTML=`
  <section class="homeHero glass">
    <span class="eyebrow">THE ETHIOPIAN CANON • 81 BOOKS</span>
    <h1>Hobah</h1>
    <p>Read. Listen. Search. Study.</p>
    <div class="heroActions">
      <a class="primaryBtn" href="${route(cont.slug,cont.chapter)}">${last?'Continue reading':'Begin reading'}</a>
      <button class="ghostBtn" id="heroStudy">Study AI</button>
    </div>
  </section>

  <section class="homeSection">
    <div class="sectionTitle"><div><span class="eyebrow">YOUR READING</span><h2>Continue</h2></div><button class="textBtn" id="openLibraryHome">${p.saved.length} saved</button></div>
    <div class="continueGrid">
      <a class="continueCard glass" href="${route(cont.slug,cont.chapter)}"><span>CONTINUE</span><b>${esc(cont.title||state.map.get(cont.slug)?.title||'Genesis')} ${cont.chapter}</b><small>Your place is saved automatically.</small><i>→</i></a>
      <a class="continueCard soft" href="${route(ds,dc)}"><span>TODAY</span><b>${esc(state.map.get(ds)?.title||ds)} ${dc}</b><small>A quiet place to begin.</small><i>→</i></a>
    </div>
  </section>

  <section class="homeSection">
    <div class="sectionTitle"><div><span class="eyebrow">HOW ARE YOU FEELING?</span><h2>Find a place to read</h2></div></div>
    <div class="feelingGrid">${feelings.map(f=>`<a class="feelingCard" href="${route(f.slug,f.chapter)}"><i>${f.icon}</i><span><b>${f.label}</b><small>${f.sub}</small></span></a>`).join('')}</div>
  </section>

  <section class="homeSection">
    <div class="sectionTitle"><div><span class="eyebrow">EXPLORE</span><h2>The 81-book canon</h2></div><button class="textBtn" id="allBooksBtn">All books</button></div>
    <div class="canonGrid">
      <button data-canon="ot" class="canonCard"><span>01</span><b>Old Testament</b><small>Torah, histories, wisdom & prophets</small></button>
      <button data-canon="eth" class="canonCard"><span>02</span><b>Ethiopian Books</b><small>Enoch, Jubilees, Meqabyan & more</small></button>
      <button data-canon="nt" class="canonCard"><span>03</span><b>New Testament</b><small>Gospels through Revelation</small></button>
    </div>
  </section>

  <section class="homeSection">
    <div class="sectionTitle"><div><span class="eyebrow">STUDY</span><h2>Go deeper without leaving the text</h2></div></div>
    <div class="studyHomeGrid">
      <button class="studyHomeCard glass" data-home-study="study"><span>✦</span><b>Study AI</b><small>Ask about the passage you are reading.</small></button>
      <button class="studyHomeCard glass" data-home-study="context"><span>⌕</span><b>Research</b><small>History, manuscripts, authorship and context.</small></button>
      <button class="studyHomeCard glass" id="studyLibraryHome"><span>♡</span><b>Study Library</b><small>Saved verses, notes and study notes.</small></button>
    </div>
  </section>

  <section class="homeSection compact">
    <div class="sectionTitle"><div><span class="eyebrow">QUICK OPEN</span><h2>Books to explore</h2></div></div>
    <div class="bookStrip">
      ${[['genesis',1],['psalms',23],['1-enoch',1],['jubilees',1],['matthew',1],['revelation',1]].map(([s,c])=>{const b=state.map.get(s);return `<a href="${route(s,c)}"><span>${esc(categoryLabel[b?.category]||'Bible')}</span><b>${esc(b?.title||s)}</b><small>Chapter ${c}</small></a>`}).join('')}
    </div>
  </section>`;
  $('#heroStudy').onclick=()=>openStudy('study');
  $('#openLibraryHome').onclick=openLibrary;$('#studyLibraryHome').onclick=openLibrary;
  $('#allBooksBtn').onclick=()=>openDrawer('all');
  $$('[data-canon]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.canon));
  $$('[data-home-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.homeStudy));
  scrollTo({top:0,behavior:'instant'});
}
async function getBook(slug){
  if(state.bookCache.has(slug))return state.bookCache.get(slug);
  if(!state.map.has(slug))throw Error('Unknown book');
  const p=fetchJSON(`/data/${encodeURIComponent(slug)}.json?v=${V}`,10000);
  state.bookCache.set(slug,p);
  try{const b=await p;state.bookCache.set(slug,b);return b}catch(e){state.bookCache.delete(slug);throw e}
}
async function renderChapter(slug,cnum,verseJump=null){
  $('#bottomHome')?.classList.remove('active');
  const meta=state.map.get(slug);if(!meta){renderHome();return}
  setBusy(`Opening ${meta.title} ${cnum}`);
  try{
    const b=await getBook(slug);state.currentBook=b;
    const c=b.chapters.find(x=>x.n===cnum)||b.chapters[0];state.currentChapter=c;
    localSet('hobah:last',JSON.stringify({slug:b.slug,title:b.title,chapter:c.n,verse:verseJump||null}));
    const ci=b.chapters.findIndex(x=>x.n===c.n),prev=b.chapters[ci-1],next=b.chapters[ci+1],ps=b.title==='Psalms';
    const saved=profile().saved.some(x=>x.type==='chapter'&&x.slug===slug&&x.chapter===c.n);
    app.innerHTML=`
    <section class="reader">
      <header class="readerHead">
        <span class="eyebrow">${esc(categoryLabel[b.category]||'Bible')} • BOOK ${String(meta.order).padStart(2,'0')}</span>
        <h1>${esc(b.title)}</h1>
        <p>${ps?'Psalm':'Chapter'} ${c.n}${c.label&&c.label!==`${b.title} ${c.n}`?` • ${esc(c.label)}`:''}</p>
      </header>
      <div class="readerTools glass">
        <select id="bookSelect" aria-label="Book">${state.books.map(x=>`<option value="${x.slug}" ${x.slug===slug?'selected':''}>${esc(x.title)}</option>`).join('')}</select>
        <select id="chapterSelect" aria-label="Chapter">${b.chapters.map(x=>`<option value="${x.n}" ${x.n===c.n?'selected':''}>${ps?'Psalm':'Chapter'} ${x.n}</option>`).join('')}</select>
        <select id="verseSelect" aria-label="Verse"><option value="">Verse</option>${c.verses.map(v=>`<option value="${v.v}">${v.v}</option>`).join('')}</select>
        <button id="listenChapter" class="toolStrong">▶ Listen</button>
        <button id="studyChapter">✦ Study</button>
        <button id="saveChapter">${saved?'♥':'♡'}</button>
      </div>
      <article id="chapterText" class="chapterText">
        ${c.verses.length?c.verses.map(v=>`<p class="verse" id="v${v.v}" data-v="${v.v}"><button class="vnum" aria-label="Verse ${v.v}">${v.v}</button><span>${divine(v.t)}</span></p>`).join(''):`<p class="chapterNote">${divine(c.note||'No parsed verse text is available for this chapter.')}</p>`}
      </article>
      <nav class="readerPager">
        ${prev?`<a href="${route(slug,prev.n)}">← ${ps?'Psalm':'Chapter'} ${prev.n}</a>`:'<span></span>'}
        <button id="fontButton">Aa</button>
        ${next?`<a href="${route(slug,next.n)}">${ps?'Psalm':'Chapter'} ${next.n} →</a>`:'<span></span>'}
      </nav>
      <section class="chapterNav"><span class="eyebrow">CHAPTERS</span><div>${b.chapters.map(x=>`<a href="${route(slug,x.n)}" class="${x.n===c.n?'active':''}">${x.n}</a>`).join('')}</div></section>
    </section>`;
    $('#bookSelect').onchange=e=>location.hash=route(e.target.value,1);
    $('#chapterSelect').onchange=e=>location.hash=route(slug,+e.target.value);
    $('#verseSelect').onchange=e=>jumpVerse(+e.target.value);
    $('#listenChapter').onclick=()=>startNarrationFromChapter(b,c);
    $('#studyChapter').onclick=()=>openStudy('study');
    $('#saveChapter').onclick=()=>toggleChapterSave(b,c);
    $('#fontButton').onclick=cycleReaderSize;
    $$('.verse').forEach(v=>v.addEventListener('click',e=>{if(e.target.closest('.vnum')||e.target.closest('.verse')===v)openVerse(b,c,+v.dataset.v)}));
    if(verseJump)setTimeout(()=>jumpVerse(verseJump),100);else scrollTo({top:0,behavior:'instant'});
    emit('hobah:chapter',{book:b,chapter:c});
  }catch(e){console.error(e);friendlyError(`Could not open ${meta.title}`,'The chapter file did not load. Tap Try again.')}
}
function jumpVerse(v){
  if(!v)return;const el=$('#v'+v);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1500);
}
function cycleReaderSize(){
  const vals=[18,20,22,24],cur=+(localGet('hobah:readerSize','20')),i=vals.indexOf(cur),n=vals[(i+1)%vals.length];localSet('hobah:readerSize',String(n));document.documentElement.style.setProperty('--reader',n+'px');toast(`Text size ${n}px`);
}
const initialReader=+(localGet('hobah:readerSize','20'));document.documentElement.style.setProperty('--reader',initialReader+'px');
function toggleChapterSave(b,c){
  const p=profile(),i=p.saved.findIndex(x=>x.type==='chapter'&&x.slug===b.slug&&x.chapter===c.n);
  if(i>=0){p.saved.splice(i,1);toast('Chapter removed')}else{p.saved.unshift({type:'chapter',slug:b.slug,chapter:c.n,ref:`${b.title} ${c.n}`});toast('Chapter saved')}
  saveProfile(p);$('#saveChapter').textContent=i>=0?'♡':'♥';
}
function openVerse(b,c,vnum){
  const v=c.verses.find(x=>x.v===vnum);if(!v)return;state.selectedVerse={book:b,chapter:c,verse:v};
  const ref=`${b.title} ${c.n}:${v.v}`,p=profile(),saved=p.saved.some(x=>x.type==='verse'&&x.ref===ref);
  const noteKey=`${b.slug}:${c.n}:${v.v}`,curated=window.MEB_CURATED_NOTES?.[noteKey]||'';
  const body=openSheet(ref,`
    <div class="verseSheet">
      <p class="verseQuote">${divine(v.t)}</p>
      <div class="sheetActions">
        <button id="copyVerse">Copy</button><button id="shareVerse">Share</button><button id="saveVerse">${saved?'♥ Saved':'♡ Save'}</button><button id="listenVerse">▶ Listen</button><button id="studyVerse">✦ Explain</button>
      </div>
      ${curated?`<div class="curatedCard"><span class="eyebrow">CURATED STUDY NOTE</span><p>${esc(curated)}</p><button id="saveStudyNote">Save study note</button></div>`:''}
      <label class="noteBox"><span>Personal note</span><textarea id="personalNote" rows="5" placeholder="Write a note…">${esc(p.notes[ref]||'')}</textarea></label>
      <button class="primaryBtn full" id="savePersonalNote">Save note</button>
    </div>`);
  $('#copyVerse',body).onclick=async()=>{try{await navigator.clipboard.writeText(`${ref} — ${v.t}`);toast('Copied')}catch{toast('Copy unavailable')}};
  $('#shareVerse',body).onclick=async()=>{const text=`${ref} — ${v.t}`;try{if(navigator.share)await navigator.share({title:ref,text,url:location.href});else await navigator.clipboard.writeText(text)}catch{}};
  $('#saveVerse',body).onclick=()=>toggleVerseSave(b,c,v,$('#saveVerse',body));
  $('#listenVerse',body).onclick=()=>{closeSheet();startNarrationItems(b,c,buildVerseItems([v]),0)};
  $('#studyVerse',body).onclick=()=>{closeSheet();openStudy('study',`Explain ${ref} in more detail.`)};
  $('#savePersonalNote',body).onclick=()=>{const p2=profile(),text=clean($('#personalNote',body).value);if(text)p2.notes[ref]=text;else delete p2.notes[ref];saveProfile(p2);toast(text?'Note saved':'Note cleared')};
  if(curated)$('#saveStudyNote',body).onclick=()=>{const p2=profile(),i=p2.study.findIndex(x=>x.key===noteKey);if(i<0)p2.study.unshift({key:noteKey,ref,text:curated,slug:b.slug,chapter:c.n,verse:v.v});saveProfile(p2);toast(i<0?'Study note saved':'Already saved')};
}
function toggleVerseSave(b,c,v,btn){
  const ref=`${b.title} ${c.n}:${v.v}`,p=profile(),i=p.saved.findIndex(x=>x.type==='verse'&&x.ref===ref);
  if(i>=0){p.saved.splice(i,1);btn.textContent='♡ Save';toast('Verse removed')}else{p.saved.unshift({type:'verse',ref,slug:b.slug,chapter:c.n,verse:v.v,text:v.t});btn.textContent='♥ Saved';toast('Verse saved')}
  saveProfile(p);
}

async function loadCorpus(cat){
  if(state.corpora[cat])return state.corpora[cat];
  if(!('DecompressionStream'in window))throw Error('Search requires a newer Safari version');
  const r=await fetch(`/${cat}.b64?v=${V}`,{cache:'force-cache'});if(!r.ok)throw Error('Search corpus unavailable');
  const b64=(await r.text()).trim(),raw=atob(b64),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const ds=new DecompressionStream('gzip'),text=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
  state.corpora[cat]=JSON.parse(text);return state.corpora[cat];
}
async function renderSearch(q){
  q=clean(q);if(!q){renderHome();return}
  setBusy(`Searching for “${q}”`);
  try{
    const data=await Promise.all(['ot','eth','nt'].map(loadCorpus)),terms=q.toLowerCase().split(/\s+/).filter(Boolean),exact=q.toLowerCase(),hits=[];
    outer:for(const corpus of data)for(const b of Object.values(corpus))for(const c of b.chapters)for(const v of c.verses){
      const text=v.t.toLowerCase();if(terms.every(t=>text.includes(t))){hits.push({title:b.title,slug:b.slug,c:c.n,v:v.v,t:v.t,score:(text.includes(exact)?3:1)+(text.startsWith(exact)?2:0)});if(hits.length>=500)break outer}
    }
    hits.sort((a,b)=>b.score-a.score);const show=hits.slice(0,150);
    app.innerHTML=`<section class="searchPage"><span class="eyebrow">WHOLE-BIBLE SEARCH</span><h1>“${esc(q)}”</h1><p>${hits.length}${hits.length>=500?'+':''} matches</p><div class="searchList">${show.map(x=>`<a href="${route(x.slug,x.c,x.v)}"><b>${esc(x.title)} ${x.c}:${x.v}</b><span>${highlight(x.t,terms)}</span></a>`).join('')||'<div class="emptyCard">No matching verses found.</div>'}</div></section>`;
    scrollTo({top:0,behavior:'instant'});
  }catch(e){console.error(e);app.innerHTML=`<section class="errorState"><span>⌕</span><h1>Search could not open</h1><p>${esc(e.message)}</p><button class="primaryBtn" id="searchRetry">Try again</button></section>`;$('#searchRetry').onclick=()=>renderSearch(q)}
}
function highlight(text,terms){let out=esc(text);for(const t of terms){const re=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');out=out.replace(re,'<mark>$1</mark>')}return out}

async function loadStudyData(){
  if(state.studyLoaded)return;
  const files=[...Array.from({length:10},(_,i)=>`study-data-${String(i).padStart(2,'0')}.js`),'curated-notes.js'];
  for(const f of files){
    if(document.querySelector(`script[data-hobah-src="${f}"]`))continue;
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`/${f}?v=${V}`;s.dataset.hobahSrc=f;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  }
  state.studyLoaded=true;
}
function currentContext(){
  const m=location.hash.match(/^#read\/([^/]+)\/(\d+)/),b=m?state.map.get(m[1]):null,c=state.currentChapter;
  if(!m||!b||!c)return{currentReference:'Study Library',scripture:'',bookBackground:'',sectionContext:'',studyNotes:[]};
  const a=window.MEB_STUDY_DATA?.[b.slug],sec=a?.sections?.find(s=>c.n>=s.start&&c.n<=s.end),notes=[];
  for(const v of c.verses){const key=`${b.slug}:${c.n}:${v.v}`,n=window.MEB_CURATED_NOTES?.[key];if(n)notes.push({reference:`${b.title} ${c.n}:${v.v}`,type:'Curated note',text:n})}
  return{
    currentReference:`${b.title} ${c.n}`,
    scripture:c.verses.map(v=>`${v.v}. ${v.t}`).join('\n').slice(0,9000),
    bookBackground:a?[a.overview,a.period,a.genre,a.scholarship].filter(Boolean).join('\n'):'',
    sectionContext:sec?`${sec.title}: ${sec.note}`:'',
    studyNotes:notes.slice(0,6)
  };
}
async function openStudy(mode='study',preset=''){
  await loadStudyData().catch(()=>{});
  state.studyMode=['study','context','theory'].includes(mode)?mode:'study';
  const ctx=currentContext(),body=openSheet('Study AI',`
  <div class="studyPanel">
    <div class="studyTabs">
      <button data-mode="study">Study AI</button><button data-mode="context">Research</button><button data-mode="theory">Theories</button>
    </div>
    <div class="studyContextCard">
      <span class="eyebrow">${esc(ctx.currentReference)}</span>
      <b id="studyModeTitle">${state.studyMode==='study'?'Explain the text':state.studyMode==='context'?'Historical & textual research':'Test a theory'}</b>
      <small id="studyModeSub">${state.studyMode==='study'?'Literary context, theology and cross-references.':state.studyMode==='context'?'Authorship, history, manuscripts, canon and archaeology.':'Claims weighed against supporting and counter-evidence.'}</small>
    </div>
    <div id="studyMessages" class="studyMessages">${state.studyHistory.map(m=>`<div class="studyMsg ${m.role}"><p>${esc(m.text)}</p></div>`).join('')}</div>
    <form id="studyForm" class="studyForm"><textarea id="studyQuestion" rows="3" placeholder="Ask about this passage…">${esc(preset)}</textarea><button class="primaryBtn">Ask</button></form>
  </div>`,{wide:true});
  syncStudyTabs(body);
  $$('[data-mode]',body).forEach(b=>b.onclick=()=>{state.studyMode=b.dataset.mode;syncStudyTabs(body)});
  $('#studyForm',body).onsubmit=e=>{e.preventDefault();const q=clean($('#studyQuestion',body).value);if(q)askStudy(q,{speak:false,body})};
  if(preset)setTimeout(()=>$('#studyQuestion',body)?.focus(),80);
}
function syncStudyTabs(root){
  $$('[data-mode]',root).forEach(b=>b.classList.toggle('active',b.dataset.mode===state.studyMode));
  const t=$('#studyModeTitle',root),s=$('#studyModeSub',root);
  if(t)t.textContent=state.studyMode==='study'?'Explain the text':state.studyMode==='context'?'Historical & textual research':'Test a theory';
  if(s)s.textContent=state.studyMode==='study'?'Literary context, theology and cross-references.':state.studyMode==='context'?'Authorship, history, manuscripts, canon and archaeology.':'Claims weighed against supporting and counter-evidence.';
}
async function askStudy(question,{speak=false,body=null,autoResume=false}={}){
  await loadStudyData().catch(()=>{});
  const ctx=currentContext(),history=state.studyHistory.slice(-4),mode=state.studyMode;
  if(body){
    state.studyHistory.push({role:'user',text:question});const msgs=$('#studyMessages',body);msgs.insertAdjacentHTML('beforeend',`<div class="studyMsg user"><p>${esc(question)}</p></div><div class="studyMsg assistant pending"><p>Thinking…</p></div>`);msgs.scrollTop=msgs.scrollHeight;
  }
  let answer='',pending=body?$$('.studyMsg.assistant.pending',body).at(-1):null;
  try{
    const r=await fetch('/api/study-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,mode,context:ctx,history})});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Study AI unavailable')}
    const reader=r.body?.getReader(),decoder=new TextDecoder();let buffer='';
    if(!reader)throw Error('Streaming unavailable');
    while(true){
      const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
      const lines=buffer.split('\n');buffer=lines.pop()||'';
      for(const line of lines){
        if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;
        try{const ev=JSON.parse(raw);if(ev.type==='response.output_text.delta'&&ev.delta){answer+=ev.delta;if(pending)pending.querySelector('p').textContent=answer}}catch{}
      }
    }
    answer=clean(answer)||'I could not produce an explanation for that request.';
    state.studyHistory.push({role:'assistant',text:answer});if(pending){pending.classList.remove('pending');pending.querySelector('p').textContent=answer}
    if(speak)await narrateStudyAnswer(answer,autoResume);
    return answer;
  }catch(e){
    console.warn(e);answer=e.message||'Study AI unavailable';if(pending){pending.classList.remove('pending');pending.classList.add('error');pending.querySelector('p').textContent=answer}
    if(autoResume)resumeScriptureAfterStudy();return answer;
  }
}
function openLibrary(){
  const p=profile(),saved=p.saved,notes=Object.entries(p.notes),study=p.study;
  const body=openSheet('Study Library',`
  <div class="libraryPanel">
    <div class="libraryStats"><div><b>${saved.length}</b><small>Saved</small></div><div><b>${notes.length}</b><small>Notes</small></div><div><b>${study.length}</b><small>Study notes</small></div></div>
    ${!saved.length&&!notes.length&&!study.length?'<div class="emptyCard"><b>Your library is empty.</b><p>Save a verse, chapter or study note while reading.</p></div>':''}
    ${saved.length?`<h3>Saved Scripture</h3><div class="libraryList">${saved.map((x,i)=>`<div class="libraryItem"><a href="${route(x.slug,x.chapter,x.verse||'')}"><b>${esc(x.ref)}</b>${x.text?`<small>${esc(x.text.slice(0,180))}</small>`:''}</a><button data-remove-saved="${i}">×</button></div>`).join('')}</div>`:''}
    ${notes.length?`<h3>Personal notes</h3><div class="libraryList">${notes.map(([ref,text])=>`<div class="libraryItem note"><div><b>${esc(ref)}</b><small>${esc(text)}</small></div></div>`).join('')}</div>`:''}
    ${study.length?`<h3>Study notes</h3><div class="libraryList">${study.map((x,i)=>`<div class="libraryItem note"><a href="${route(x.slug,x.chapter,x.verse||'')}"><b>${esc(x.ref)}</b><small>${esc(x.text)}</small></a><button data-remove-study="${i}">×</button></div>`).join('')}</div>`:''}
  </div>`,{wide:true});
  $$('[data-remove-saved]',body).forEach(b=>b.onclick=()=>{const p2=profile();p2.saved.splice(+b.dataset.removeSaved,1);saveProfile(p2);openLibrary()});
  $$('[data-remove-study]',body).forEach(b=>b.onclick=()=>{const p2=profile();p2.study.splice(+b.dataset.removeStudy,1);saveProfile(p2);openLibrary()});
}

function splitForTTS(text,limit=900){
  const sentences=clean(text).split(/(?<=[.!?])\s+/),out=[];let cur='';
  for(const s of sentences){if((cur+' '+s).length>limit&&cur){out.push(cur);cur=s}else cur+=(cur?' ':'')+s}
  if(cur)out.push(cur);return out;
}
function buildVerseItems(verses){
  const items=[];let text='',start=null,end=null;
  for(const v of verses){
    const t=clean(v.t);if(start===null)start=v.v;
    if((text+' '+t).length>900&&text){items.push({text,startVerse:start,endVerse:end});text=t;start=v.v}else text+=(text?' ':'')+t;
    end=v.v;
  }
  if(text)items.push({text,startVerse:start,endVerse:end});return items;
}
function contextIntro(b,c){
  const mode=localGet('hobah:audioMode','normal');if(mode==='normal')return'';
  const a=window.MEB_STUDY_DATA?.[b.slug],sec=a?.sections?.find(s=>c.n>=s.start&&c.n<=s.end);
  const bits=[`${b.title} ${c.n}.`];
  if(mode==='context'){if(a?.overview)bits.push(a.overview);if(sec?.note)bits.push(sec.note)}
  else{if(a?.overview)bits.push(a.overview);if(a?.period)bits.push(`Historical setting: ${a.period}.`);if(a?.scholarship)bits.push(`Scholarship: ${a.scholarship}`);if(sec?.note)bits.push(`Section context: ${sec.note}`)}
  bits.push('Now, the text.');return clean(bits.join(' '));
}
async function startNarrationFromChapter(b,c){
  await loadStudyData().catch(()=>{});
  const items=buildVerseItems(c.verses),intro=contextIntro(b,c);if(intro)items.unshift({text:intro,startVerse:null,endVerse:null,context:true});
  startNarrationItems(b,c,items,0);
}
function ensureScriptureAudio(){
  if(state.audio.audio)return state.audio.audio;
  const a=document.createElement('audio');a.preload='auto';a.setAttribute('playsinline','');a.className='scriptureAudio';a.hidden=true;document.body.appendChild(a);state.audio.audio=a;
  a.onended=()=>advanceNarration();
  a.onplay=()=>{state.audio.playing=true;state.audio.paused=false;state.audio.stopped=false;syncAudioUI()};
  a.onpause=()=>{if(!a.ended){state.audio.paused=true;state.audio.playing=false;syncAudioUI()}};
  a.ontimeupdate=()=>{if(Math.floor(a.currentTime)%4===0)persistAudio()};
  return a;
}
function startNarrationItems(b,c,items,index=0){
  state.audio.current={slug:b.slug,title:b.title,chapter:c.n};state.audio.items=items;state.audio.index=Math.max(0,Math.min(index,items.length-1));state.audio.stopped=false;
  showAudioBar();playNarrationItem();
}
async function getSpeechBlob(text,mode=null){
  const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:mode||localGet('hobah:audioMode','normal')})});
  if(!r.ok)throw Error('Natural voice unavailable');return r.blob();
}
async function playNarrationItem(){
  const item=state.audio.items[state.audio.index];if(!item||state.audio.stopped)return finishNarration();
  const a=ensureScriptureAudio();setAudioStatus('Preparing natural voice…');setAudioPlay('…');
  try{
    const blob=await getSpeechBlob(item.text),url=URL.createObjectURL(blob);
    if(state.audio.stopped){URL.revokeObjectURL(url);return}
    if(state.audio.objectUrl)try{URL.revokeObjectURL(state.audio.objectUrl)}catch{}
    state.audio.objectUrl=url;a.src=url;a.load();a.playbackRate=+(localGet('hobah:audioRate','1'));highlightAudioItem(item);
    await a.play();
    setAudioStatus(item.context?'Context':item.startVerse?`Verses ${item.startVerse}${item.endVerse!==item.startVerse?'–'+item.endVerse:''}`:'Scripture');
    prefetchNext();
  }catch(e){console.warn(e);setAudioStatus('Natural voice unavailable');setAudioPlay('▶')}
}
function prefetchNext(){
  const n=state.audio.items[state.audio.index+1];if(!n)return;
  if('requestIdleCallback'in window)requestIdleCallback(()=>fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:n.text,voice:'marin',mode:localGet('hobah:audioMode','normal')})}).then(()=>{}).catch(()=>{}),{timeout:1000});
}
async function advanceNarration(){
  if(state.audio.stopped)return;
  if(state.audio.index<state.audio.items.length-1){state.audio.index++;await playNarrationItem();return}
  const cur=state.audio.current,b=state.map.get(cur.slug),ci=b?.chapters?.findIndex(x=>x.n===cur.chapter)??-1;let nb=b,nc=b?.chapters?.[ci+1];
  if(!nc){const bi=state.books.findIndex(x=>x.slug===cur.slug);nb=state.books[bi+1];nc=nb?.chapters?.[0]}
  if(!nb||!nc){finishNarration();return}
  setAudioStatus(`Continuing to ${nb.title} ${nc.n}…`);location.hash=route(nb.slug,nc.n);
  for(let i=0;i<80;i++){await sleep(100);if(state.currentBook?.slug===nb.slug&&state.currentChapter?.n===nc.n)break}
  if(state.currentBook?.slug===nb.slug&&state.currentChapter?.n===nc.n)startNarrationFromChapter(state.currentBook,state.currentChapter);else finishNarration();
}
function highlightAudioItem(item){
  $$('.verse.speaking').forEach(x=>x.classList.remove('speaking'));
  if(item.startVerse){for(let v=item.startVerse;v<=item.endVerse;v++)$('#v'+v)?.classList.add('speaking');$('#v'+item.startVerse)?.scrollIntoView({behavior:'smooth',block:'center'})}
}
function pauseNarration(){const a=ensureScriptureAudio();if(!a.paused)a.pause();setAudioStatus('Paused');setAudioPlay('▶');persistAudio()}
function resumeNarration(){const a=ensureScriptureAudio();if(a.src)a.play().catch(()=>{});else playNarrationItem()}
function stopNarration(){
  state.audio.stopped=true;const a=ensureScriptureAudio();a.pause();a.removeAttribute('src');a.load();if(state.audio.objectUrl)try{URL.revokeObjectURL(state.audio.objectUrl)}catch{}state.audio.objectUrl=null;state.audio.items=[];state.audio.index=0;state.audio.current=null;state.audio.playing=false;state.audio.paused=false;$('.audioDock').classList.add('hidden');stopAmbient();stopVoiceCommands();$$('.verse.speaking').forEach(x=>x.classList.remove('speaking'));localSet('hobah:audioProgress','');
}
function finishNarration(){setAudioStatus('Finished');setAudioPlay('▶');state.audio.playing=false;state.audio.paused=false;persistAudio()}
function toggleNarration(){const a=ensureScriptureAudio();if(a.src&&!a.ended){a.paused?resumeNarration():pauseNarration()}else if(state.currentBook&&state.currentChapter)startNarrationFromChapter(state.currentBook,state.currentChapter)}
function jumpNarration(d){
  if(!state.audio.items.length)return;const a=ensureScriptureAudio();a.pause();state.audio.index=Math.max(0,Math.min(state.audio.items.length-1,state.audio.index+d));playNarrationItem();
}
function persistAudio(){
  const a=state.audio.audio,cur=state.audio.current;if(!cur||!state.audio.items.length)return;
  localSet('hobah:audioProgress',JSON.stringify({current:cur,index:state.audio.index,time:a?.currentTime||0,mode:localGet('hobah:audioMode','normal'),rate:localGet('hobah:audioRate','1'),updated:Date.now()}));
}
function showAudioBar(){
  const dock=$('.audioDock');dock.classList.remove('hidden');$('#audioRef').textContent=state.audio.current?`${state.audio.current.title} ${state.audio.current.chapter}`:'Read aloud';syncAudioUI();syncAudioSettings();
}
function setAudioStatus(t){const e=$('#audioState');if(e)e.textContent=t}
function setAudioPlay(t){const e=$('#audioPlay');if(e)e.textContent=t}
function syncAudioUI(){
  setAudioPlay(state.audio.playing?'❚❚':'▶');const a=$('#audioVoiceToggle');if(a)a.classList.toggle('active',state.listening);
}
function syncAudioSettings(){
  const mode=localGet('hobah:audioMode','normal');$$('[data-audio-mode]').forEach(b=>b.classList.toggle('active',b.dataset.audioMode===mode));
  const rate=$('#audioRate');if(rate)rate.value=localGet('hobah:audioRate','1');
  $('#audioAmbient').classList.toggle('active',localGet('hobah:ambient','0')==='1');
}
function bindAudio(){
  if(document.body.dataset.audioBound==='1')return;document.body.dataset.audioBound='1';
  $('#audioPlay').onclick=toggleNarration;$('#audioPrev').onclick=()=>jumpNarration(-1);$('#audioNext').onclick=()=>jumpNarration(1);$('#audioClose').onclick=stopNarration;
  $$('[data-audio-mode]').forEach(b=>b.onclick=()=>{localSet('hobah:audioMode',b.dataset.audioMode);syncAudioSettings();toast(`${b.textContent} context`)});
  $('#audioRate').onchange=e=>{localSet('hobah:audioRate',e.target.value);if(state.audio.audio)state.audio.audio.playbackRate=+e.target.value};
  $('#audioVoiceToggle').onclick=toggleVoiceCommands;$('#audioAmbient').onclick=toggleAmbient;
}
function currentAudioVerse(){
  const item=state.audio.items[state.audio.index];return item?.startVerse||state.selectedVerse?.verse?.v||1;
}
async function explainCurrent(){
  if(!state.currentBook||!state.currentChapter){toast('Open a chapter first');return}
  const a=ensureScriptureAudio();if(!a.paused)a.pause();state.audio.resumeAfterStudy=true;
  const v=currentAudioVerse(),ref=`${state.currentBook.title} ${state.currentChapter.n}:${v}`;
  setAudioStatus(`Explaining ${ref}…`);state.studyMode='study';
  const ans=await askStudy(`Explain ${ref} in more detail. Focus on what is happening in this verse and why it matters in its immediate context.`,{speak:true,autoResume:true});
  return ans;
}
async function narrateStudyAnswer(text,autoResume=false){
  const parts=splitForTTS(text,850);if(!parts.length){if(autoResume)resumeScriptureAfterStudy();return}
  let sa=state.audio.studyAudio;if(!sa){sa=document.createElement('audio');sa.hidden=true;sa.className='studyAudio';sa.setAttribute('playsinline','');document.body.appendChild(sa);state.audio.studyAudio=sa}
  setAudioStatus('Study AI explanation');$('#audioRef').textContent='Study AI';
  for(let i=0;i<parts.length;i++){
    try{
      const blob=await getSpeechBlob(parts[i],'normal'),url=URL.createObjectURL(blob);sa.src=url;sa.load();await new Promise((resolve,reject)=>{sa.onended=resolve;sa.onerror=reject;sa.play().catch(reject)});URL.revokeObjectURL(url);
    }catch(e){console.warn(e);break}
  }
  if(autoResume)resumeScriptureAfterStudy();
}
function resumeScriptureAfterStudy(){
  if(!state.audio.resumeAfterStudy)return;state.audio.resumeAfterStudy=false;$('#audioRef').textContent=state.audio.current?`${state.audio.current.title} ${state.audio.current.chapter}`:'Read aloud';setAudioStatus('Returning to Scripture…');setTimeout(()=>resumeNarration(),220);
}

function toggleVoiceCommands(){state.listening?stopVoiceCommands():startVoiceCommands()}
function startVoiceCommands(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('Voice commands are not supported by this Safari version');return}
  if(!state.recognition){
    const r=new SR();r.continuous=true;r.interimResults=true;r.lang='en-AU';r.maxAlternatives=3;
    r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const text=clean(e.results[i][0]?.transcript).toLowerCase();if(text)handleVoice(text,e.results[i].isFinal)}};
    r.onend=()=>{if(state.listening)setTimeout(()=>{try{r.start()}catch{}},120)};
    r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){state.listening=false;syncAudioUI();setAudioStatus('Microphone permission needed')}};
    state.recognition=r;
  }
  state.listening=true;try{state.recognition.start()}catch{}syncAudioUI();setAudioStatus('Listening • say stop, play, continue, or explain that');
}
function stopVoiceCommands(){state.listening=false;try{state.recognition?.stop()}catch{}syncAudioUI()}
let lastVoice='',lastVoiceAt=0;
function handleVoice(text,final){
  const now=Date.now();if(text===lastVoice&&now-lastVoiceAt<1200)return;
  const hit=(...xs)=>xs.some(x=>text.includes(x));
  if(hit('explain that','explain this','what does that mean','go deeper')){lastVoice=text;lastVoiceAt=now;explainCurrent();return}
  if(hit('stop','pause')){lastVoice=text;lastVoiceAt=now;pauseNarration();return}
  if(hit('continue','resume','play')){lastVoice=text;lastVoiceAt=now;resumeNarration();return}
  if(hit('next')){lastVoice=text;lastVoiceAt=now;jumpNarration(1);return}
  if(hit('previous','back')){lastVoice=text;lastVoiceAt=now;jumpNarration(-1);return}
  if(final)setAudioStatus('Listening • say stop, play, continue, or explain that');
}

function ensureAmbient(){
  if(state.ambient)return state.ambient;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  const ctx=new AC(),master=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;filter.connect(master);master.connect(ctx.destination);master.gain.value=0;
  state.ambient={ctx,master,filter,timer:null,voices:[],step:0};return state.ambient;
}
const ambientProfiles={
  calm:[[53,57,60,65],[58,62,65,70],[48,55,60,64],[53,57,60,65]],
  hope:[[50,54,57,62],[55,59,62,67],[47,50,54,59],[45,49,52,57]],
  reflective:[[45,48,52,57],[41,45,48,53],[48,52,55,60],[43,47,50,55]]
};
function ambientProfile(){
  const s=state.currentBook?.slug,c=state.currentChapter?.n||1;if(s==='lamentations'||s==='job'||s==='ecclesiastes'||(s==='psalms'&&[6,13,22,31,42,51,69,88,130,137].includes(c)))return'reflective';
  if(s==='romans'||s==='john'||(s==='psalms'&&[23,100,103,136,145,150].includes(c)))return'hope';return'calm';
}
function playAmbientChord(notes){
  const a=ensureAmbient();if(!a)return;const now=a.ctx.currentTime;notes.forEach((m,i)=>{const o=a.ctx.createOscillator(),g=a.ctx.createGain();o.type=i?'sine':'triangle';o.frequency.value=440*Math.pow(2,(m-69)/12);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(i?0.0045:0.0055,now+2.8);g.gain.linearRampToValueAtTime(0,now+13);o.connect(g);g.connect(a.filter);o.start();o.stop(now+13.2);a.voices.push(o)});
}
async function startAmbient(){
  const a=ensureAmbient();if(!a)return;localSet('hobah:ambient','1');try{await a.ctx.resume()}catch{}a.master.gain.cancelScheduledValues(a.ctx.currentTime);a.master.gain.linearRampToValueAtTime(.7,a.ctx.currentTime+2);const chords=ambientProfiles[ambientProfile()];if(!a.timer){playAmbientChord(chords[0]);a.step=1;a.timer=setInterval(()=>{playAmbientChord(chords[a.step%chords.length]);a.step++},11000)}syncAudioSettings()
}
function stopAmbient(){
  const a=state.ambient;localSet('hobah:ambient','0');if(!a){syncAudioSettings();return}if(a.timer){clearInterval(a.timer);a.timer=null}a.master.gain.cancelScheduledValues(a.ctx.currentTime);a.master.gain.linearRampToValueAtTime(0,a.ctx.currentTime+1.2);setTimeout(()=>{a.voices.splice(0).forEach(o=>{try{o.stop()}catch{}})},1300);syncAudioSettings()
}
function toggleAmbient(){localGet('hobah:ambient','0')==='1'?stopAmbient():startAmbient()}

bindAudio();
bootstrap();
})();