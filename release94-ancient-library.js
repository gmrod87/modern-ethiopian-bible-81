(() => {
'use strict';

const LIB_VERSION='94';
const LIB_URL=`/ancient-library.json?v=${LIB_VERSION}`;
const state={manifest:null,loading:null,tab:'scripture',scriptureFilter:'all',ancientPart:'all',query:''};
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>r?.querySelectorAll?[...r.querySelectorAll(s)]:[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const categoryLabel={ot:'Old Testament',eth:'Ethiopian Canon',nt:'New Testament'};
const partShort=p=>String(p||'').replace(/^(?:I|II|III|IV|V)\.\s*/,'');
const bookRoute=(slug,c=1)=>`#read/${slug}/${c}`;

async function loadManifest(){
  if(state.manifest)return state.manifest;
  if(state.loading)return state.loading;
  state.loading=fetch(LIB_URL,{cache:'force-cache'}).then(async r=>{
    if(!r.ok)throw Error(`Ancient Library unavailable (${r.status})`);
    const data=await r.json();
    if(!data||!Array.isArray(data.sections)||!data.sections.length)throw Error('Ancient Library index is empty');
    data.sections=data.sections.map((s,i)=>({...s,_i:i}));
    state.manifest=data;return data;
  }).catch(e=>{state.loading=null;throw e});
  return state.loading;
}

function closeDrawer(){
  $('#drawer')?.classList.remove('open');$('#backdrop')?.classList.remove('open');document.body.classList.remove('locked');
}
function openDrawer(){
  $('#drawer')?.classList.add('open');$('#backdrop')?.classList.add('open');document.body.classList.add('locked');$('#bottomBooks')?.classList.add('active');
}

function decorateDrawer(){
  const drawer=$('#drawer');if(!drawer||drawer.dataset.ancientLibrary==='1')return;
  drawer.dataset.ancientLibrary='1';drawer.classList.add('booksHubDrawer');
  drawer.innerHTML=`
    <div class="drawerHead booksHubHead"><div><span class="eyebrow">HOBAH LIBRARY</span><h2>Books</h2><p>Scripture and historical texts, clearly separated.</p></div><button class="round" id="closeDrawer" type="button" aria-label="Close books">×</button></div>
    <div class="booksHubTabs" role="tablist" aria-label="Library shelves"><button type="button" data-books-tab="scripture" class="active" role="tab" aria-selected="true"><b>Scripture</b><span>81 Books</span></button><button type="button" data-books-tab="ancient" role="tab" aria-selected="false"><b>Ancient Library</b><span id="ancientTabCount">Historical texts</span></button></div>
    <div class="booksHubSearch"><span>⌕</span><input id="booksHubSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search the 81 books…" aria-label="Search books"><button id="booksHubClear" type="button" aria-label="Clear search">×</button></div>
    <div id="booksHubChips" class="booksHubChips" aria-label="Book filters"></div><div id="booksHubStatus" class="booksHubStatus" aria-live="polite"></div><div id="booksHubContent" class="booksHubContent"></div>
    <div id="drawerFilters" hidden></div><div id="drawerBooks" hidden></div>`;

  $('#closeDrawer',drawer).addEventListener('click',closeDrawer);
  $$('[data-books-tab]',drawer).forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.booksTab)));
  let timer=null;const input=$('#booksHubSearchInput',drawer);
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.query=clean(input.value);renderActiveShelf()},120)});
  $('#booksHubClear',drawer).addEventListener('click',()=>{input.value='';state.query='';input.focus();renderActiveShelf()});
  $('#booksHubChips',drawer).addEventListener('click',e=>{
    const b=e.target.closest('button[data-scripture-filter],button[data-ancient-part]');if(!b)return;
    if(b.dataset.scriptureFilter!==undefined){state.scriptureFilter=b.dataset.scriptureFilter;renderScripture()}
    if(b.dataset.ancientPart!==undefined){state.ancientPart=b.dataset.ancientPart;paintAncient(state.manifest)}
  });
  $('#booksHubContent',drawer).addEventListener('click',e=>{
    const ancient=e.target.closest('[data-ancient-index]');if(ancient){e.preventDefault();openAncientReader(+ancient.dataset.ancientIndex);return}
    if(e.target.closest('a[href^="#read/"]'))closeDrawer();
  });
}

function openBooksHub(tab='scripture',filter='all'){
  decorateDrawer();state.tab=tab;if(tab==='scripture')state.scriptureFilter=filter||'all';state.query='';
  const input=$('#booksHubSearchInput');if(input)input.value='';openDrawer();setTab(tab,false);
}
function setTab(tab,focus=true){
  state.tab=tab;$$('[data-books-tab]').forEach(b=>{const on=b.dataset.booksTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});
  const input=$('#booksHubSearchInput');if(input){input.placeholder=tab==='ancient'?'Search titles, authors, sources or full text…':'Search the 81 books…';if(focus)setTimeout(()=>input.focus(),30)}
  renderActiveShelf();
}
function renderActiveShelf(){state.tab==='ancient'?renderAncient():renderScripture()}

function renderScripture(){
  const books=Array.isArray(window.MEB_BOOKS)?window.MEB_BOOKS:[],q=state.query.toLowerCase();
  const list=books.filter(b=>(state.scriptureFilter==='all'||b.category===state.scriptureFilter)&&(!q||`${b.title} ${categoryLabel[b.category]||''}`.toLowerCase().includes(q)));
  $('#booksHubChips').innerHTML=[['all','All 81'],['ot','Old Testament'],['eth','Ethiopian'],['nt','New Testament']].map(([id,label])=>`<button type="button" data-scripture-filter="${id}" class="${state.scriptureFilter===id?'active':''}">${label}</button>`).join('');
  $('#booksHubStatus').innerHTML=`<span>${list.length} book${list.length===1?'':'s'}</span><small>Primary 81-book Scripture collection</small>`;
  $('#booksHubContent').innerHTML=list.length?`<div class="scriptureShelf">${list.map(b=>`<a href="${bookRoute(b.slug,1)}" class="scriptureBookCard"><span class="bookNo">${String(b.order||books.indexOf(b)+1).padStart(2,'0')}</span><span class="bookMeta"><b>${esc(b.title)}</b><small>${esc(categoryLabel[b.category]||'Scripture')} · ${Array.isArray(b.chapters)?b.chapters.length:'—'} ${b.title==='Psalms'?'psalms':'chapters'}</small></span><i>›</i></a>`).join('')}</div>`:`<div class="booksEmpty"><b>No Scripture books found</b><span>Try another title or shelf.</span></div>`;
}

function matchesAncient(s,q){
  if(!q)return true;const n=q.toLowerCase();
  return `${s.title||''} ${s.part||''} ${s.status||''} ${s.provenance||''} ${s.source||''} ${s.notes||''}`.toLowerCase().includes(n)||(n.length>=3&&String(s.text||'').toLowerCase().includes(n));
}
function snippetFor(s,q){
  if(!q)return clean(s.notes||s.provenance||s.text||'').slice(0,180);
  const text=String(s.text||''),at=text.toLowerCase().indexOf(q.toLowerCase());if(at<0)return clean(s.notes||s.provenance||text).slice(0,180);
  const start=Math.max(0,at-72),end=Math.min(text.length,at+q.length+128);return `${start?'…':''}${clean(text.slice(start,end))}${end<text.length?'…':''}`;
}
function paintAncient(m){
  if(!m||!Array.isArray(m.sections))return;
  const parts=[...new Set(m.sections.map(s=>s.part).filter(Boolean))];
  $('#ancientTabCount').textContent=`${m.section_count||m.sections.length} texts / sections`;
  $('#booksHubChips').innerHTML=[`<button type="button" data-ancient-part="all" class="${state.ancientPart==='all'?'active':''}">All</button>`,...parts.map((p,i)=>`<button type="button" data-ancient-part="${i}" class="${state.ancientPart===String(i)?'active':''}">${esc(partShort(p))}</button>`)].join('');
  const selected=state.ancientPart==='all'?null:parts[+state.ancientPart],q=state.query;
  const matches=m.sections.filter(s=>(!selected||s.part===selected)&&matchesAncient(s,q)),shown=matches.slice(0,q?120:250);
  $('#booksHubStatus').innerHTML=`<span>${matches.length} ${matches.length===1?'result':'texts / sections'}</span><small>${q?'Full-text search across the Ancient Library':'Historical reading witnesses · separate from Scripture'}</small>`;
  $('#booksHubContent').innerHTML=shown.length?`<div class="ancientShelf">${shown.map(s=>`<button type="button" class="ancientTextCard" data-ancient-index="${s._i}"><span class="ancientCardTop"><em>${esc(partShort(s.part))}</em><i>›</i></span><b>${esc(clean(s.title)||`Ancient text ${s._i+1}`)}</b><small class="ancientStatus">${esc(s.status||'Historical text')}</small><p>${esc(snippetFor(s,q))}</p><span class="ancientSource">${esc(clean(s.provenance||s.source||''))}</span></button>`).join('')}</div>`:`<div class="booksEmpty"><b>No Ancient Library results</b><span>Try a title, writer, topic, or phrase from the text.</span></div>`;
}
async function renderAncient(){
  if(state.manifest){paintAncient(state.manifest);return}
  const chips=$('#booksHubChips'),status=$('#booksHubStatus'),content=$('#booksHubContent');if(!chips||!status||!content)return;
  chips.innerHTML='';status.innerHTML='<span>Opening Ancient Library…</span><small>Loading only when requested</small>';content.innerHTML='<div class="booksLoading"><div class="spinner"></div><b>Preparing historical texts</b><span>Full text stays separate from Scripture.</span></div>';
  try{paintAncient(await loadManifest())}catch(e){
    console.error('Ancient Library',e);status.innerHTML='<span>Ancient Library could not open</span><small>The Scripture shelf is still available.</small>';content.innerHTML=`<div class="booksEmpty"><b>Historical texts unavailable</b><span>${esc(e.message||'Please try again.')}</span><button type="button" id="retryAncient">Try again</button></div>`;$('#retryAncient')?.addEventListener('click',()=>{state.loading=null;state.manifest=null;renderAncient()});
  }
}

function paragraphHTML(text,query=''){
  const blocks=String(text||'').replace(/\r/g,'').trim().split(/\n\s*\n|\n(?=(?:CHAPTER|Chapter|BOOK|Book|[IVXLCDM]+\.?\s|\d+\.\s))/).filter(Boolean),q=query.trim();
  return blocks.map(block=>{
    const compact=block.trim(),isHead=compact.length<180&&/^(CHAPTER|Chapter|BOOK|Book|[IVXLCDM]+\.?\s|\d+\.\s)/.test(compact);let safe=esc(compact).replace(/\n/g,'<br>');
    if(q){const re=new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi');safe=safe.replace(re,'<mark>$1</mark>')}
    return isHead?`<h3>${safe}</h3>`:`<p>${safe}</p>`;
  }).join('');
}

async function openAncientReader(index){
  try{
    const m=await loadManifest(),s=m.sections[index];if(!s)return;closeDrawer();
    const d=$('#sheet'),card=$('.sheetCard',d),body=$('#sheetBody',d),title=$('#sheetTitle',d);if(!d||!body||!title)return;
    card?.classList.add('wide','ancientReaderSheet');title.textContent='Ancient Library';
    body.innerHTML=`<article class="ancientReader"><header class="ancientReaderHero"><span class="eyebrow">${esc(partShort(s.part))}</span><h1>${esc(clean(s.title)||'Ancient text')}</h1><p>${esc(s.status||'Historical reading witness')}</p></header><section class="ancientAbout"><div><b>About this text</b><span>${esc(s.notes||'This historical reading witness is kept distinct from the primary 81-book Scripture collection.')}</span></div><dl><dt>Status</dt><dd>${esc(s.status||'Historical text')}</dd><dt>Provenance</dt><dd>${esc(s.provenance||'Source-controlled Ancient Library corpus')}</dd><dt>Source</dt><dd>${esc(s.source||'See corpus record')}</dd></dl></section><div class="ancientReaderFind"><span>⌕</span><input id="ancientReaderSearch" type="search" placeholder="Find in this text…" aria-label="Find in this text"><button type="button" id="ancientReaderFindBtn">Find</button><button type="button" id="ancientReaderClearBtn">Clear</button></div><div id="ancientReaderMatchStatus" class="ancientReaderMatchStatus"></div><section id="ancientReaderText" class="ancientReaderText">${paragraphHTML(s.text)}</section><footer class="ancientReaderNav"><button type="button" id="ancientPrev" ${index<=0?'disabled':''}>‹ Previous text</button><button type="button" id="ancientBackToShelf">Ancient Library</button><button type="button" id="ancientNext" ${index>=m.sections.length-1?'disabled':''}>Next text ›</button></footer></article>`;
    if(!d.open)d.showModal();
    if(d.dataset.ancientCleanup!=='1'){
      d.dataset.ancientCleanup='1';
      d.addEventListener('close',()=>{card?.classList.remove('ancientReaderSheet');d.dataset.ancientCleanup='0'},{once:true});
    }
    const find=()=>applyReaderSearch(s);
    $('#ancientReaderFindBtn')?.addEventListener('click',find);$('#ancientReaderSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find()}});
    $('#ancientReaderClearBtn')?.addEventListener('click',()=>{const i=$('#ancientReaderSearch');if(i)i.value='';$('#ancientReaderText').innerHTML=paragraphHTML(s.text);$('#ancientReaderMatchStatus').textContent=''});
    $('#ancientPrev')?.addEventListener('click',()=>openAncientReader(index-1));$('#ancientNext')?.addEventListener('click',()=>openAncientReader(index+1));$('#ancientBackToShelf')?.addEventListener('click',()=>{d.close();openBooksHub('ancient')});
    setTimeout(()=>$('.sheetWrap',d)?.scrollTo?.({top:0,behavior:'instant'}),0);
  }catch(e){console.error(e);const t=$('#toast');if(t){t.textContent='Could not open that historical text';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}}
}
function applyReaderSearch(s){
  const q=clean($('#ancientReaderSearch')?.value),box=$('#ancientReaderText'),status=$('#ancientReaderMatchStatus');if(!box||!status)return;
  box.innerHTML=paragraphHTML(s.text,q);if(!q){status.textContent='';return}const marks=$$('mark',box);status.textContent=marks.length?`${marks.length} match${marks.length===1?'':'es'} in this text`:'No matches in this text';marks[0]?.scrollIntoView({behavior:'smooth',block:'center'});
}

function installCaptureNavigation(){
  if(document.documentElement.dataset.ancientLibraryCapture==='1')return;document.documentElement.dataset.ancientLibraryCapture='1';
  document.addEventListener('click',e=>{const t=e.target.closest?.('#bottomBooks,#menuBtn,#allBooksBtn,[data-canon]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();openBooksHub('scripture',t.dataset?.canon||'all')},true);
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&$('#drawer')?.classList.contains('open')){const i=$('#booksHubSearchInput');if(i&&document.activeElement!==i){e.preventDefault();i.focus()}}});
}
function boot(){
  installCaptureNavigation();let tries=0;const timer=setInterval(()=>{tries++;if($('#drawer')&&Array.isArray(window.MEB_BOOKS)&&window.MEB_BOOKS.length){clearInterval(timer);decorateDrawer();renderScripture()}else if(tries>120)clearInterval(timer)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
