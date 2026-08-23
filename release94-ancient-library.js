(() => {
'use strict';

const LIB_VERSION='95';
const LIB_URL=`/ancient-library.json?v=${LIB_VERSION}`;
const state={manifest:null,loading:null,tab:'scripture',scriptureFilter:'all',ancientPart:'all',query:'',ancientIndex:null};
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>r?.querySelectorAll?[...r.querySelectorAll(s)]:[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const categoryLabel={ot:'Old Testament',eth:'Ethiopian Canon',nt:'New Testament'};
const partShort=p=>String(p||'').replace(/^(?:I|II|III|IV|V)\.\s*/,'');
const bookRoute=(slug,c=1)=>`#read/${slug}/${c}`;

const navNoise=/^(?:sacred texts?|bible|apocrypha|index|previous|next|contents?|home|buy this book(?: at amazon\.com)?|buy this book at amazon\.com)$/i;
const sourceNoise=/(?:sacred-texts\.com|amazon\.com|public[- ]domain|public domain historical translation|rutherford h\. platt.*1926.*sacred|the forgotten books of eden\s*,?\s*by\s+rutherford h\. platt)/i;
const nonReadingTitle=/^(?:illustrations?|index|table of contents|title page|frontispiece)$/i;

function prettyTitle(v){
  let t=clean(v).replace(/\s+collection$/i,'').replace(/\s+/g,' ');
  if(!t)return'Ancient text';
  const letters=t.replace(/[^A-Za-z]/g,'');
  if(letters&&t===t.toUpperCase()&&t.length<110){
    t=t.toLowerCase().replace(/\b([a-z])/g,m=>m.toUpperCase())
      .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii|Xiii|Xiv|Xv|Xvi|Xvii|Xviii|Xix|Xx)\b/g,m=>m.toUpperCase());
  }
  return t;
}
function cleanAncientText(raw){
  const lines=String(raw||'').replace(/\r/g,'').split('\n');
  const kept=[];
  for(let i=0;i<lines.length;i++){
    const original=lines[i],s=clean(original);
    if(!s){kept.push('');continue}
    if(navNoise.test(s))continue;
    if((i<55||s.length<180)&&sourceNoise.test(s))continue;
    if(/^copyright\b/i.test(s)&&s.length<180)continue;
    if(/^this (?:text|book).*(?:public domain|copyright)/i.test(s)&&s.length<220)continue;
    kept.push(original.trimEnd());
  }
  return kept.join('\n').replace(/\n{3,}/g,'\n\n').replace(/^\s+|\s+$/g,'');
}
function sectionHeadingFromText(raw){
  const lines=cleanAncientText(raw).split('\n').map(clean).filter(Boolean);
  for(let i=0;i<Math.min(lines.length,18);i++){
    const line=lines[i];
    const m=line.match(/^(?:CHAP(?:TER)?\.?|BOOK)\s*([IVXLCDM]+|\d+)\.?\s*$/i);
    if(m){
      const label=/^book/i.test(line)?`Book ${m[1].toUpperCase()}`:`Chapter ${m[1].toUpperCase()}`;
      const next=lines.slice(i+1,i+4).find(x=>x.length>4&&x.length<150&&!navNoise.test(x)&&!sourceNoise.test(x));
      return next?`${label} — ${prettyTitle(next)}`:label;
    }
  }
  return'';
}
function displayAncientTitle(s){
  const base=prettyTitle(s?.title),heading=sectionHeadingFromText(s?.text);
  if(heading&&(/forgotten books of eden/i.test(base)||base==='Ancient Text'||base.length>70))return heading;
  return base||heading||'Ancient text';
}
function isReadingSection(s){return !nonReadingTitle.test(clean(s?.title))}
function textPreview(s,q=''){
  const text=cleanAncientText(s?.text);
  if(!text)return'';
  const flat=clean(text),needle=clean(q).toLowerCase();
  if(!needle)return flat.slice(0,185);
  const at=flat.toLowerCase().indexOf(needle);
  if(at<0)return flat.slice(0,185);
  const start=Math.max(0,at-65),end=Math.min(flat.length,at+needle.length+125);
  return `${start?'…':''}${flat.slice(start,end)}${end<flat.length?'…':''}`;
}

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

function closeDrawer(){$('#drawer')?.classList.remove('open');$('#backdrop')?.classList.remove('open');document.body.classList.remove('locked')}
function openDrawer(){$('#drawer')?.classList.add('open');$('#backdrop')?.classList.add('open');document.body.classList.add('locked');$('#bottomBooks')?.classList.add('active')}

function decorateDrawer(){
  const drawer=$('#drawer');if(!drawer||drawer.dataset.ancientLibrary==='1')return;
  drawer.dataset.ancientLibrary='1';drawer.classList.add('booksHubDrawer');
  drawer.innerHTML=`
    <div class="drawerHead booksHubHead"><div><span class="eyebrow">HOBAH LIBRARY</span><h2>Books</h2></div><button class="round" id="closeDrawer" type="button" aria-label="Close books">×</button></div>
    <div class="booksHubTabs" role="tablist" aria-label="Library shelves"><button type="button" data-books-tab="scripture" class="active" role="tab" aria-selected="true"><b>Scripture</b><span>81 Books</span></button><button type="button" data-books-tab="ancient" role="tab" aria-selected="false"><b>Ancient Library</b><span id="ancientTabCount">Historical texts</span></button></div>
    <div class="booksHubSearch"><span>⌕</span><input id="booksHubSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search the 81 books…" aria-label="Search books"><button id="booksHubClear" type="button" aria-label="Clear search">×</button></div>
    <div id="booksHubChips" class="booksHubChips" aria-label="Book filters"></div><div id="booksHubStatus" class="booksHubStatus" aria-live="polite"></div><div id="booksHubContent" class="booksHubContent"></div>
    <div id="drawerFilters" hidden></div><div id="drawerBooks" hidden></div>`;
  $('#closeDrawer',drawer).addEventListener('click',closeDrawer);
  $$('[data-books-tab]',drawer).forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.booksTab)));
  let timer=null;const input=$('#booksHubSearchInput',drawer);
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.query=clean(input.value);renderActiveShelf()},110)});
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
  const input=$('#booksHubSearchInput');if(input){input.placeholder=tab==='ancient'?'Search the Ancient Library…':'Search the 81 books…';if(focus)setTimeout(()=>input.focus(),30)}
  renderActiveShelf();
}
function renderActiveShelf(){state.tab==='ancient'?renderAncient():renderScripture()}

function renderScripture(){
  const books=Array.isArray(window.MEB_BOOKS)?window.MEB_BOOKS:[],q=state.query.toLowerCase();
  const list=books.filter(b=>(state.scriptureFilter==='all'||b.category===state.scriptureFilter)&&(!q||`${b.title} ${categoryLabel[b.category]||''}`.toLowerCase().includes(q)));
  $('#booksHubChips').innerHTML=[['all','All 81'],['ot','Old Testament'],['eth','Ethiopian'],['nt','New Testament']].map(([id,label])=>`<button type="button" data-scripture-filter="${id}" class="${state.scriptureFilter===id?'active':''}">${label}</button>`).join('');
  $('#booksHubStatus').innerHTML=`<span>${list.length} book${list.length===1?'':'s'}</span><small>81-book Scripture collection</small>`;
  $('#booksHubContent').innerHTML=list.length?`<div class="scriptureShelf">${list.map(b=>`<a href="${bookRoute(b.slug,1)}" class="scriptureBookCard"><span class="bookNo">${String(b.order||books.indexOf(b)+1).padStart(2,'0')}</span><span class="bookMeta"><b>${esc(b.title)}</b><small>${esc(categoryLabel[b.category]||'Scripture')} · ${Array.isArray(b.chapters)?b.chapters.length:'—'} ${b.title==='Psalms'?'psalms':'chapters'}</small></span><i>›</i></a>`).join('')}</div>`:`<div class="booksEmpty"><b>No Scripture books found</b><span>Try another title or section.</span></div>`;
}
function matchesAncient(s,q){
  if(!q)return true;const n=q.toLowerCase();
  return `${displayAncientTitle(s)} ${s.part||''} ${s.title||''}`.toLowerCase().includes(n)||(n.length>=3&&cleanAncientText(s.text).toLowerCase().includes(n));
}
function paintAncient(m){
  if(!m||!Array.isArray(m.sections))return;
  const readable=m.sections.filter(isReadingSection),parts=[...new Set(readable.map(s=>s.part).filter(Boolean))];
  $('#ancientTabCount').textContent=`${readable.length} texts / sections`;
  $('#booksHubChips').innerHTML=[`<button type="button" data-ancient-part="all" class="${state.ancientPart==='all'?'active':''}">All</button>`,...parts.map((p,i)=>`<button type="button" data-ancient-part="${i}" class="${state.ancientPart===String(i)?'active':''}">${esc(partShort(p))}</button>`)].join('');
  const selected=state.ancientPart==='all'?null:parts[+state.ancientPart],q=state.query;
  const matches=readable.filter(s=>(!selected||s.part===selected)&&matchesAncient(s,q)),shown=matches.slice(0,q?120:250);
  $('#booksHubStatus').innerHTML=`<span>${matches.length} ${matches.length===1?'result':'texts / sections'}</span><small>${q?'Search results':'Ancient Library'}</small>`;
  $('#booksHubContent').innerHTML=shown.length?`<div class="ancientShelf">${shown.map(s=>`<button type="button" class="ancientTextCard" data-ancient-index="${s._i}"><span class="ancientCardTop"><em>${esc(partShort(s.part)||'Ancient Library')}</em><i>›</i></span><b>${esc(displayAncientTitle(s))}</b><p>${esc(textPreview(s,q))}</p></button>`).join('')}</div>`:`<div class="booksEmpty"><b>No Ancient Library results</b><span>Try a title, topic, or phrase from the text.</span></div>`;
}
async function renderAncient(){
  if(state.manifest){paintAncient(state.manifest);return}
  const chips=$('#booksHubChips'),status=$('#booksHubStatus'),content=$('#booksHubContent');if(!chips||!status||!content)return;
  chips.innerHTML='';status.innerHTML='<span>Opening Ancient Library…</span><small>Loading texts</small>';content.innerHTML='<div class="booksLoading"><div class="spinner"></div><b>Preparing the Ancient Library</b></div>';
  try{paintAncient(await loadManifest())}catch(e){
    console.error('Ancient Library',e);status.innerHTML='<span>Ancient Library could not open</span>';content.innerHTML=`<div class="booksEmpty"><b>Historical texts unavailable</b><span>${esc(e.message||'Please try again.')}</span><button type="button" id="retryAncient">Try again</button></div>`;$('#retryAncient')?.addEventListener('click',()=>{state.loading=null;state.manifest=null;renderAncient()});
  }
}
function paragraphHTML(text,query=''){
  const cleaned=cleanAncientText(text),blocks=cleaned.replace(/\r/g,'').trim().split(/\n\s*\n|\n(?=(?:CHAPTER|Chapter|CHAP\.|BOOK|Book|[IVXLCDM]+\.?\s|\d+\.\s))/).filter(Boolean),q=query.trim();
  return blocks.map(block=>{
    const compact=block.trim(),isHead=compact.length<180&&/^(?:CHAPTER|Chapter|CHAP\.|BOOK|Book|[IVXLCDM]+\.?\s|\d+\.\s)/.test(compact);let safe=esc(compact).replace(/\n/g,'<br>');
    if(q){const re=new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi');safe=safe.replace(re,'<mark>$1</mark>')}
    return isHead?`<h3>${safe}</h3>`:`<p>${safe}</p>`;
  }).join('');
}
function ancientReaderSizeCycle(){
  const vals=[18,20,22,24],cur=+(localStorage.getItem('hobah:readerSize')||'20'),i=vals.indexOf(cur),n=vals[(i+1)%vals.length];
  try{localStorage.setItem('hobah:readerSize',String(n))}catch{}document.documentElement.style.setProperty('--reader',n+'px');
}
function readerSectionOptions(m,index){return m.sections.filter(isReadingSection).map(s=>`<option value="${s._i}" ${s._i===index?'selected':''}>${esc(displayAncientTitle(s))}</option>`).join('')}
async function openAncientReader(index,{push=true}={}){
  try{
    const m=await loadManifest(),s=m.sections[index];if(!s||!isReadingSection(s))return;closeDrawer();state.ancientIndex=index;
    if(push&&location.hash!==`#ancient/${index}`)history.pushState({hobahAncient:index},'',`#ancient/${index}`);
    const app=$('#app');if(!app)return;
    const title=displayAncientTitle(s),part=partShort(s.part)||'Ancient Library',readable=m.sections.filter(isReadingSection),pos=readable.findIndex(x=>x._i===index),prev=readable[pos-1],next=readable[pos+1];
    app.innerHTML=`<section class="reader ancientNativeReader"><header class="readerHead"><span class="eyebrow">ANCIENT LIBRARY</span><h1>${esc(title)}</h1><p>${esc(part)}</p></header><div class="readerTools glass ancientReaderTools"><button type="button" id="ancientBackShelf" class="ancientLibraryBack">‹ Library</button><select id="ancientSectionSelect" aria-label="Ancient Library text">${readerSectionOptions(m,index)}</select><div class="ancientFindField"><span>⌕</span><input id="ancientReaderSearch" type="search" placeholder="Find in text…" aria-label="Find in this text"></div><button type="button" id="ancientReaderFindBtn">Find</button><button type="button" id="ancientReaderClearBtn">Clear</button></div><div id="ancientReaderMatchStatus" class="ancientReaderMatchStatus"></div><article id="ancientReaderText" class="chapterText ancientChapterText">${paragraphHTML(s.text)}</article><nav class="readerPager ancientReaderPager">${prev?`<button type="button" id="ancientPrev">← Previous</button>`:'<span></span>'}<button type="button" id="ancientFontButton">Aa</button>${next?`<button type="button" id="ancientNext">Next →</button>`:'<span></span>'}</nav></section>`;
    $('#ancientBackShelf')?.addEventListener('click',()=>openBooksHub('ancient'));$('#ancientSectionSelect')?.addEventListener('change',e=>openAncientReader(+e.target.value));$('#ancientReaderFindBtn')?.addEventListener('click',()=>applyReaderSearch(s));$('#ancientReaderSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyReaderSearch(s)}});
    $('#ancientReaderClearBtn')?.addEventListener('click',()=>{const input=$('#ancientReaderSearch');if(input)input.value='';$('#ancientReaderText').innerHTML=paragraphHTML(s.text);$('#ancientReaderMatchStatus').textContent=''});$('#ancientPrev')?.addEventListener('click',()=>openAncientReader(prev._i));$('#ancientNext')?.addEventListener('click',()=>openAncientReader(next._i));$('#ancientFontButton')?.addEventListener('click',ancientReaderSizeCycle);scrollTo({top:0,behavior:'instant'});
  }catch(e){console.error(e);const t=$('#toast');if(t){t.textContent='Could not open that historical text';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}}
}
function applyReaderSearch(s){
  const q=clean($('#ancientReaderSearch')?.value),box=$('#ancientReaderText'),status=$('#ancientReaderMatchStatus');if(!box||!status)return;
  box.innerHTML=paragraphHTML(s.text,q);if(!q){status.textContent='';return}const marks=$$('mark',box);status.textContent=marks.length?`${marks.length} match${marks.length===1?'':'es'}`:'No matches';marks[0]?.scrollIntoView({behavior:'smooth',block:'center'});
}
function installCaptureNavigation(){
  if(document.documentElement.dataset.ancientLibraryCapture==='1')return;document.documentElement.dataset.ancientLibraryCapture='1';
  document.addEventListener('click',e=>{const t=e.target.closest?.('#bottomBooks,#menuBtn,#allBooksBtn,[data-canon]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();openBooksHub('scripture',t.dataset?.canon||'all')},true);
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&$('#drawer')?.classList.contains('open')){const i=$('#booksHubSearchInput');if(i&&document.activeElement!==i){e.preventDefault();i.focus()}}});
  addEventListener('popstate',()=>{const m=location.hash.match(/^#ancient\/(\d+)$/);if(m)openAncientReader(+m[1],{push:false})});
}
function boot(){
  installCaptureNavigation();let tries=0;const timer=setInterval(()=>{tries++;if($('#drawer')&&Array.isArray(window.MEB_BOOKS)&&window.MEB_BOOKS.length){clearInterval(timer);decorateDrawer();renderScripture();const m=location.hash.match(/^#ancient\/(\d+)$/);if(m)openAncientReader(+m[1],{push:false})}else if(tries>120)clearInterval(timer)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();