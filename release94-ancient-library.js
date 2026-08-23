(() => {
'use strict';

const LIB_VERSION='94';
const LIB_URL=`/ancient-library.json?v=${LIB_VERSION}`;
const state={manifest:null,loading:null,tab:'scripture',scriptureFilter:'all',ancientPart:'all',query:'',readerIndex:-1,readerQuery:'',readerMatch:0};
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>r?.querySelectorAll?[...r.querySelectorAll(s)]:[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const categoryLabel={ot:'Old Testament',eth:'Ethiopian Canon',nt:'New Testament'};
const partShort=p=>String(p||'').replace(/^I{1,3}V?\.\s*|^V\.\s*/,'');
const bookRoute=(slug,c=1)=>`#read/${slug}/${c}`;

function toast(msg){
  const el=$('#toast'); if(!el)return;
  el.textContent=msg;el.classList.add('show');clearTimeout(el._alTimer);el._alTimer=setTimeout(()=>el.classList.remove('show'),2200);
}

async function loadManifest(){
  if(state.manifest)return state.manifest;
  if(state.loading)return state.loading;
  state.loading=fetch(LIB_URL,{cache:'force-cache'}).then(async r=>{
    if(!r.ok)throw Error(`Ancient Library unavailable (${r.status})`);
    const data=await r.json();
    if(!data||!Array.isArray(data.sections))throw Error('Ancient Library index is invalid');
    data.sections=data.sections.map((s,i)=>({...s,_i:i,_id:`ancient-${i+1}`}));
    state.manifest=data;return data;
  }).catch(e=>{state.loading=null;throw e});
  return state.loading;
}

function openDrawerShell(){
  $('#drawer')?.classList.add('open');
  $('#backdrop')?.classList.add('open');
  document.body.classList.add('locked');
  $('#bottomBooks')?.classList.add('active');
}
function closeDrawerShell(){
  $('#drawer')?.classList.remove('open');
  $('#backdrop')?.classList.remove('open');
  document.body.classList.remove('locked');
}

function decorateDrawer(){
  const drawer=$('#drawer'); if(!drawer||drawer.dataset.ancientLibrary==='1')return;
  drawer.dataset.ancientLibrary='1';
  drawer.classList.add('booksHubDrawer');
  drawer.innerHTML=`
    <div class="drawerHead booksHubHead">
      <div><span class="eyebrow">HOBAH LIBRARY</span><h2>Books</h2><p>Scripture and historical texts, clearly separated.</p></div>
      <button class="round" id="closeDrawer" type="button" aria-label="Close books">×</button>
    </div>
    <div class="booksHubTabs" role="tablist" aria-label="Library shelves">
      <button type="button" data-books-tab="scripture" class="active" role="tab" aria-selected="true"><b>Scripture</b><span>81 Books</span></button>
      <button type="button" data-books-tab="ancient" role="tab" aria-selected="false"><b>Ancient Library</b><span id="ancientTabCount">Historical texts</span></button>
    </div>
    <div class="booksHubSearch"><span>⌕</span><input id="booksHubSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search the 81 books…" aria-label="Search books"><button id="booksHubClear" type="button" aria-label="Clear search">×</button></div>
    <div id="booksHubChips" class="booksHubChips" aria-label="Book filters"></div>
    <div id="booksHubStatus" class="booksHubStatus" aria-live="polite"></div>
    <div id="booksHubContent" class="booksHubContent"></div>
    <div id="drawerFilters" hidden></div><div id="drawerBooks" hidden></div>`;

  $('#closeDrawer',drawer).addEventListener('click',closeDrawerShell);
  $('[data-books-tab="scripture"]',drawer).addEventListener('click',()=>setTab('scripture'));
  $('[data-books-tab="ancient"]',drawer).addEventListener('click',()=>setTab('ancient'));
  const input=$('#booksHubSearchInput',drawer);
  let timer=null;
  input.addEventListener('input',()=>{
    clearTimeout(timer);timer=setTimeout(()=>{state.query=clean(input.value);renderActiveShelf();},110);
  });
  $('#booksHubClear',drawer).addEventListener('click',()=>{input.value='';state.query='';input.focus();renderActiveShelf();});
  $('#booksHubChips',drawer).addEventListener('click',e=>{
    const b=e.target.closest('button[data-scripture-filter],button[data-ancient-part]');if(!b)return;
    if(b.dataset.scriptureFilter){state.scriptureFilter=b.dataset.scriptureFilter;renderScripture()}
    if(b.dataset.ancientPart){state.ancientPart=b.dataset.ancientPart;renderAncient()}
  });
  $('#booksHubContent',drawer).addEventListener('click',e=>{
    const a=e.target.closest('[data-ancient-index]');if(a){e.preventDefault();openAncientReader(+a.dataset.ancientIndex);return}
    if(e.target.closest('a[href^="#read/"]'))closeDrawerShell();
  });
}

function openBooksHub(tab='scripture',filter='all'){
  decorateDrawer();
  if(tab==='scripture'&&filter)state.scriptureFilter=filter;
  state.tab=tab;
  state.query='';
  const input=$('#booksHubSearchInput');if(input)input.value='';
  openDrawerShell();
  setTab(tab,false);
}

function setTab(tab,focus=true){
  state.tab=tab;
  $$('[data-books-tab]').forEach(b=>{const on=b.dataset.booksTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});
  const input=$('#booksHubSearchInput');
  if(input){input.placeholder=tab==='ancient'?'Search titles, authors, source notes or full text…':'Search the 81 books…';if(focus)setTimeout(()=>input.focus(),30)}
  renderActiveShelf();
}

function renderActiveShelf(){state.tab==='ancient'?renderAncient():renderScripture()}

function renderScripture(){
  const books=Array.isArray(window.MEB_BOOKS)?window.MEB_BOOKS:[];
  const q=state.query.toLowerCase();
  const filtered=books.filter(b=>(state.scriptureFilter==='all'||b.category===state.scriptureFilter)&&(!q||`${b.title} ${categoryLabel[b.category]||''}`.toLowerCase().includes(q)));
  $('#booksHubChips').innerHTML=[['all','All 81'],['ot','Old Testament'],['eth','Ethiopian'],['nt','New Testament']].map(([id,label])=>`<button type="button" data-scripture-filter="${id}" class="${state.scriptureFilter===id?'active':''}">${label}</button>`).join('');
  $('#booksHubStatus').innerHTML=`<span>${filtered.length} book${filtered.length===1?'':'s'}</span><small>Primary 81-book Scripture collection</small>`;
  $('#booksHubContent').innerHTML=filtered.length?`<div class="scriptureShelf">${filtered.map(b=>`<a href="${bookRoute(b.slug,1)}" class="scriptureBookCard"><span class="bookNo">${String((b.order||books.indexOf(b)+1)).padStart(2,'0')}</span><span class="bookMeta"><b>${esc(b.title)}</b><small>${esc(categoryLabel[b.category]||'Scripture')} · ${Array.isArray(b.chapters)?b.chapters.length:'—'} ${b.title==='Psalms'?'psalms':'chapters'}</small></span><i>›</i></a>`).join('')}</div>`:`<div class="booksEmpty"><b>No Scripture books found</b><span>Try another title or shelf.</span></div>`;
}

function snippetFor(s,q){
  if(!q)return clean(s.notes||s.provenance||s.text||'').slice(0,180);
  const text=String(s.text||'');const low=text.toLowerCase();const at=low.indexOf(q.toLowerCase());
  if(at<0)return clean(s.notes||s.provenance||text).slice(0,180);
  const start=Math.max(0,at-72),end=Math.min(text.length,at+q.length+128);
  return `${start?'…':''}${clean(text.slice(start,end))}${end<text.length?'…':''}`;
}
function matchesAncient(s,q){
  if(!q)return true;
  const n=q.toLowerCase();
  if(`${s.title||''} ${s.part||''} ${s.status||''} ${s.provenance||''} ${s.source||''} ${s.notes||''}`.toLowerCase().includes(n))return true;
  return n.length>=3&&String(s.text||'').toLowerCase().includes(n);
}

async function renderAncient(){
  const chips=$('#booksHubChips'),status=$('#booksHubStatus'),content=$('#booksHubContent');if(!chips||!status||!content)return;
  chips.innerHTML='<button class="active" type="button">Loading categories…</button>';
  status.innerHTML='<span>Opening Ancient Library…</span><small>Loading the audited historical reading corpus</small>';
  content.innerHTML='<div class="booksLoading"><div class="spinner"></div><b>Preparing historical texts</b><span>Full text stays separate from Scripture.</span></div>';
  try{
    const m=await loadManifest();
    $('#ancientTabCount').textContent=`${m.section_count||m.sections.length} texts / sections`;
    const parts=[...new Set(m.sections.map(s=>s.part).filter(Boolean))];
    chips.innerHTML=[`<button type="button" data-ancient-part="all" class="${state.ancientPart==='all'?'active':''}">All</button>`,...parts.map((p,i)=>`<button type="button" data-ancient-part="${i}" class="${state.ancientPart===String(i)?'active':''}">${esc(partShort(p))}</button>`)].join('');
    const q=state.query;
    const selectedPart=state.ancientPart==='all'?null:parts[+state.ancientPart];
    const matches=m.sections.filter(s=>(!selectedPart||s.part===selectedPart)&&matchesAncient(s,q));
    const shown=matches.slice(0,q?120:250);
    status.innerHTML=`<span>${matches.length} ${matches.length===1?'result':'texts / sections'}</span><small>${q?'Full-text search across the Ancient Library':'Historical reading witnesses · not presented as additional biblical books'}</small>`;
    content.innerHTML=shown.length?`<div class="ancientShelf">${shown.map(s=>`<button type="button" class="ancientTextCard" data-ancient-index="${s._i}"><span class="ancientCardTop"><em>${esc(partShort(s.part))}</em><i>›</i></span><b>${esc(clean(s.title)||`Ancient text ${s._i+1}`)}</b><small class="ancientStatus">${esc(s.status||'Historical text')}</small><p>${esc(snippetFor(s,q))}</p><span class="ancientSource">${esc(clean(s.provenance||s.source||''))}</span></button>`).join('')}</div>`:`<div class="booksEmpty"><b>No Ancient Library results</b><span>Try a title, writer, topic, or phrase from the text.</span></div>`;
  }catch(e){
    console.error('Ancient Library',e);chips.innerHTML='';status.innerHTML='<span>Ancient Library could not open</span><small>The Scripture shelf is still available.</small>';content.innerHTML=`<div class="booksEmpty"><b>Historical texts unavailable</b><span>${esc(e.message||'Please try again.')}</span><button type="button" id="retryAncient">Try again</button></div>`;$('#retryAncient')?.addEventListener('click',()=>{state.loading=null;state.manifest=null;renderAncient()});
  }
}

function paragraphHTML(text,query=''){
  const raw=String(text||'').replace(/\r/g,'').trim();
  const blocks=raw.split(/\n\s*\n|\n(?=(?:CHAPTER|Chapter|BOOK|Book|[IVXLCDM]+\.?\s|\d+\.\s))/).filter(Boolean);
  const q=query.trim();
  return blocks.map(block=>{
    const compact=block.trim();
    const isHead=compact.length<180&&/^(CHAPTER|Chapter|BOOK|Book|[IVXLCDM]+\.?\s|\d+\.\s)/.test(compact);
    let safe=esc(compact).replace(/\n/g,'<br>');
    if(q){
      const re=new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi');safe=safe.replace(re,'<mark>$1</mark>');
    }
    return isHead?`<h3>${safe}</h3>`:`<p>${safe}</p>`;
  }).join('');
}

async function openAncientReader(index){
  try{
    const m=await loadManifest(),s=m.sections[index];if(!s)return;
    state.readerIndex=index;state.readerQuery='';state.readerMatch=0;closeDrawerShell();
    const d=$('#sheet'),card=$('.sheetCard',d),body=$('#sheetBody',d),title=$('#sheetTitle',d);if(!d||!body||!title)return;
    card?.classList.add('wide','ancientReaderSheet');title.textContent='Ancient Library';
    body.innerHTML=`<article class="ancientReader" data-reader-index="${index}">
      <header class="ancientReaderHero"><span class="eyebrow">${esc(partShort(s.part))}</span><h1>${esc(clean(s.title)||'Ancient text')}</h1><p>${esc(s.status||'Historical reading witness')}</p></header>
      <section class="ancientAbout"><div><b>About this text</b><span>${esc(s.notes||'This historical reading witness is kept distinct from the primary 81-book Scripture collection.')}</span></div><dl><dt>Status</dt><dd>${esc(s.status||'Historical text')}</dd><dt>Provenance</dt><dd>${esc(s.provenance||'Source-controlled Ancient Library corpus')}</dd><dt>Source</dt><dd>${esc(s.source||'See corpus record')}</dd></dl></section>
      <div class="ancientReaderFind"><span>⌕</span><input id="ancientReaderSearch" type="search" placeholder="Find in this text…" aria-label="Find in this text"><button type="button" id="ancientReaderFindBtn">Find</button><button type="button" id="ancientReaderClearBtn">Clear</button></div>
      <div id="ancientReaderMatchStatus" class="ancientReaderMatchStatus"></div>
      <section id="ancientReaderText" class="ancientReaderText">${paragraphHTML(s.text)}</section>
      <footer class="ancientReaderNav"><button type="button" id="ancientPrev" ${index<=0?'disabled':''}>‹ Previous text</button><button type="button" id="ancientBackToShelf">Ancient Library</button><button type="button" id="ancientNext" ${index>=m.sections.length-1?'disabled':''}>Next text ›</button></footer>
    </article>`;
    d.showModal();
    const find=()=>applyReaderSearch(s);
    $('#ancientReaderFindBtn')?.addEventListener('click',find);
    $('#ancientReaderSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find()}});
    $('#ancientReaderClearBtn')?.addEventListener('click',()=>{const i=$('#ancientReaderSearch');if(i)i.value='';state.readerQuery='';state.readerMatch=0;$('#ancientReaderText').innerHTML=paragraphHTML(s.text);$('#ancientReaderMatchStatus').textContent='';});
    $('#ancientPrev')?.addEventListener('click',()=>openAncientReader(index-1));
    $('#ancientNext')?.addEventListener('click',()=>openAncientReader(index+1));
    $('#ancientBackToShelf')?.addEventListener('click',()=>{d.close();openBooksHub('ancient')});
    setTimeout(()=>{$('.sheetWrap',d)?.scrollTo?.({top:0,behavior:'instant'})},0);
  }catch(e){console.error(e);toast('Could not open that historical text')}
}

function applyReaderSearch(s){
  const input=$('#ancientReaderSearch'),q=clean(input?.value);state.readerQuery=q;state.readerMatch=0;
  const box=$('#ancientReaderText'),status=$('#ancientReaderMatchStatus');if(!box||!status)return;
  box.innerHTML=paragraphHTML(s.text,q);
  if(!q){status.textContent='';return}
  const marks=$$('mark',box);status.textContent=marks.length?`${marks.length} match${marks.length===1?'':'es'} in this text`:'No matches in this text';
  marks[0]?.scrollIntoView({behavior:'smooth',block:'center'});
}

function installCaptureNavigation(){
  if(document.documentElement.dataset.ancientLibraryCapture==='1')return;
  document.documentElement.dataset.ancientLibraryCapture='1';
  document.addEventListener('click',e=>{
    const t=e.target.closest?.('#bottomBooks,#menuBtn,#allBooksBtn,[data-canon]');if(!t)return;
    e.preventDefault();e.stopImmediatePropagation();
    const filter=t.dataset?.canon||'all';openBooksHub('scripture',filter);
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&$('#drawer')?.classList.contains('open')){const i=$('#booksHubSearchInput');if(i&&document.activeElement!==i){e.preventDefault();i.focus()}}
  });
}

function boot(){
  installCaptureNavigation();
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if($('#drawer')&&Array.isArray(window.MEB_BOOKS)&&window.MEB_BOOKS.length){clearInterval(timer);decorateDrawer();renderScripture();loadManifest().then(m=>{const c=$('#ancientTabCount');if(c)c.textContent=`${m.section_count||m.sections.length} texts / sections`}).catch(()=>{})}
    else if(tries>120)clearInterval(timer);
  },100);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
