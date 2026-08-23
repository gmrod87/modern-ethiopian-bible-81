(() => {
'use strict';

const LIB_VERSION='96';
const LIB_URL=`/ancient-library.json?v=${LIB_VERSION}`;
const state={manifest:null,loading:null,tab:'scripture',scriptureFilter:'all',ancientPart:'all',query:'',fontStep:1};
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>r?.querySelectorAll?[...r.querySelectorAll(s)]:[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const categoryLabel={ot:'Old Testament',eth:'Ethiopian Canon',nt:'New Testament'};
const bookRoute=(slug,c=1)=>`#read/${slug}/${c}`;
const chapterHeading=/^(?:CHAP(?:TER)?\.?\s+[IVXLCDM0-9]+\.?|BOOK(?:\s+[IVXLCDM0-9]+)?\.?|PART(?:\s+[IVXLCDM0-9]+)?\.?)/i;
const genericTitle=/^(?:the\s+)?forgotten books of eden(?: collection)?$|^sacred texts?$|^apocrypha$|^index$|^ancient library$|^untitled$|^illustrations$/i;

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

function partShort(p){
  return clean(String(p||'').replace(/^(?:I|II|III|IV|V)\.\s*/,'').replace(/\s+collection$/i,''))||'Ancient Library';
}
function closeDrawer(){
  const d=$('#drawer'),b=$('#backdrop');d?.classList.remove('open');b?.classList.remove('open');document.body.classList.remove('locked');
}
function openDrawer(){
  const d=$('#drawer'),b=$('#backdrop');d?.classList.add('open');b?.classList.add('open');document.body.classList.add('locked');$('#bottomBooks')?.classList.add('active');
  requestAnimationFrame(()=>$('#books96Scroll')?.scrollTo?.({top:0,left:0,behavior:'instant'}));
}
function closeSheet(){const sheet=$('#sheet');if(sheet?.open)sheet.close()}

function cleanAncientText(raw){
  let lines=String(raw||'').replace(/\r/g,'').split('\n');
  const trim=x=>clean(x);
  const boilerplate=t=>{
    if(!t)return false;
    if(/^(?:sacred texts?|bible|apocrypha|index|previous|next|home|contents?|illustrations?)$/i.test(t))return true;
    if(/buy\s+(?:this\s+)?book.*amazon|amazon\.com/i.test(t))return true;
    if(/sacred[- ]texts\.com|internet sacred text archive|www\.sacred[- ]texts/i.test(t))return true;
    if(/^https?:\/\//i.test(t)||/^www\./i.test(t))return true;
    if(/^public[- ]domain(?:\s+historical)?\s+translation\.?$/i.test(t))return true;
    if(/^the forgotten books of eden\s*,?\s*by\b/i.test(t))return true;
    if(/^rutherford h\.?\s*platt(?:,?\s*jr\.?)?.*(?:1926|sacred)/i.test(t))return true;
    if(/^\[?1926\]?\s*,?\s*at\s+sacred/i.test(t))return true;
    if(/^copyright\b|^all rights reserved/i.test(t))return true;
    return false;
  };
  const firstHeading=lines.findIndex(line=>chapterHeading.test(trim(line)));
  if(firstHeading>0){
    const lead=lines.slice(0,firstHeading).map(trim).join(' ');
    if(/sacred texts?|amazon|forgotten books of eden|rutherford h\.?\s*platt|apocrypha|\bindex\b/i.test(lead))lines=lines.slice(firstHeading);
  }
  lines=lines.filter(line=>!boilerplate(trim(line)));
  return lines.join('\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

function ancientRecord(s){
  const text=cleanAncientText(s?.text||'');
  const lines=text.split('\n').map(v=>v.trim());
  const nonEmpty=lines.map((v,i)=>[v,i]).filter(([v])=>v);
  let title=clean(s?.title||'')
    .replace(/\s*[-|:]\s*sacred[- ]texts?.*$/i,'')
    .replace(/\s*[-|:]\s*internet sacred text archive.*$/i,'')
    .replace(/\s*\(sacred[- ]texts?\).*$/i,'')
    .replace(/^the forgotten books of eden\s*[-—:]\s*/i,'')
    .trim();
  let bodyLines=[...lines];
  const headingEntry=nonEmpty.find(([v])=>chapterHeading.test(v));
  if((!title||genericTitle.test(title))&&headingEntry){
    const [heading,headingIndex]=headingEntry;
    const next=lines.slice(headingIndex+1).find(v=>v&&v.length<=150&&!chapterHeading.test(v));
    const prettyHeading=heading.replace(/^CHAP\.\s*/i,'Chapter ').replace(/^CHAPTER\s*/i,'Chapter ');
    title=next?`${prettyHeading} — ${next}`:prettyHeading;
    if(headingIndex===0){
      bodyLines.shift();while(bodyLines[0]==='')bodyLines.shift();
      if(next&&bodyLines[0]?.trim()===next){bodyLines.shift();while(bodyLines[0]==='')bodyLines.shift()}
    }
  }
  if(!title||genericTitle.test(title)){
    const first=nonEmpty.find(([v])=>v.length>3&&v.length<=140&&!/^(?:sacred texts?|bible|apocrypha|index)$/i.test(v))?.[0];
    if(first)title=first;
  }
  title=clean(title)||'Ancient text';
  const body=bodyLines.join('\n').replace(/\n{3,}/g,'\n\n').trim()||text;
  return {title,body,text,part:partShort(s?.part)};
}

function decorateDrawer(){
  const drawer=$('#drawer');if(!drawer)return;
  if(drawer.dataset.booksNavVersion==='96')return;
  drawer.dataset.booksNavVersion='96';drawer.dataset.ancientLibrary='1';drawer.classList.add('booksHubDrawer');
  drawer.innerHTML=`
    <div class="books96Top">
      <header class="books96Header">
        <div><span class="eyebrow">HOBAH LIBRARY</span><h2>Books</h2></div>
        <button class="books96Close" id="closeDrawer" type="button" aria-label="Close books">×</button>
      </header>
      <nav class="books96Shelves" role="tablist" aria-label="Library shelves">
        <button type="button" data-books-tab="scripture" class="active" role="tab" aria-selected="true"><b>Scripture</b><span>81 books</span></button>
        <button type="button" data-books-tab="ancient" role="tab" aria-selected="false"><b>Ancient Library</b><span id="ancientTabCount">Historical readings</span></button>
      </nav>
      <label class="books96Search" for="booksHubSearchInput">
        <span aria-hidden="true">⌕</span>
        <input id="booksHubSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search Scripture…" aria-label="Search books">
        <button id="booksHubClear" type="button" aria-label="Clear search">×</button>
      </label>
    </div>
    <div id="books96Scroll" class="books96Scroll" tabindex="0">
      <div id="booksHubChips" class="books96Filters" aria-label="Book filters"></div>
      <div id="booksHubStatus" class="books96Status" aria-live="polite"></div>
      <div id="booksHubContent" class="books96Content"></div>
    </div>
    <div id="drawerFilters" hidden></div><div id="drawerBooks" hidden></div>`;

  $('#closeDrawer',drawer)?.addEventListener('click',closeDrawer);
  $$('[data-books-tab]',drawer).forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.booksTab)));
  let timer=null;const input=$('#booksHubSearchInput',drawer);
  input?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.query=clean(input.value);renderActiveShelf()},100)});
  $('#booksHubClear',drawer)?.addEventListener('click',e=>{e.preventDefault();if(input)input.value='';state.query='';renderActiveShelf();input?.focus()});
  $('#booksHubChips',drawer)?.addEventListener('click',e=>{
    const b=e.target.closest('button[data-scripture-filter]');if(!b)return;
    state.scriptureFilter=b.dataset.scriptureFilter;renderScripture();
  });
  $('#booksHubChips',drawer)?.addEventListener('change',e=>{
    const s=e.target.closest('select[data-ancient-collection]');if(!s)return;
    state.ancientPart=s.value;paintAncient(state.manifest);
  });
  $('#booksHubContent',drawer)?.addEventListener('click',e=>{
    const ancient=e.target.closest('[data-ancient-index]');if(ancient){e.preventDefault();openAncientReader(+ancient.dataset.ancientIndex);return}
    if(e.target.closest('a[href^="#read/"]'))closeDrawer();
  });
}

function openBooksHub(tab='scripture',filter='all'){
  decorateDrawer();state.tab=tab;if(tab==='scripture')state.scriptureFilter=filter||'all';state.query='';
  const input=$('#booksHubSearchInput');if(input)input.value='';setTab(tab,false);openDrawer();
}
function setTab(tab,focus=true){
  state.tab=tab==='ancient'?'ancient':'scripture';
  $$('[data-books-tab]',$('#drawer')).forEach(b=>{const on=b.dataset.booksTab===state.tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});
  const input=$('#booksHubSearchInput');if(input){input.placeholder=state.tab==='ancient'?'Search Ancient Library…':'Search Scripture…';if(focus)setTimeout(()=>input.focus(),30)}
  renderActiveShelf();requestAnimationFrame(()=>$('#books96Scroll')?.scrollTo?.({top:0,left:0,behavior:'instant'}));
}
function renderActiveShelf(){state.tab==='ancient'?renderAncient():renderScripture()}

function renderScripture(){
  const books=Array.isArray(window.MEB_BOOKS)?window.MEB_BOOKS:[],q=state.query.toLowerCase();
  const list=books.filter(b=>(state.scriptureFilter==='all'||b.category===state.scriptureFilter)&&(!q||`${b.title} ${categoryLabel[b.category]||''}`.toLowerCase().includes(q)));
  const filters=[['all','All 81'],['ot','Old Testament'],['eth','Ethiopian'],['nt','New Testament']];
  $('#booksHubChips').innerHTML=`<div class="books96FilterGrid">${filters.map(([id,label])=>`<button type="button" data-scripture-filter="${id}" class="${state.scriptureFilter===id?'active':''}">${label}</button>`).join('')}</div>`;
  $('#booksHubStatus').innerHTML=`<b>${list.length} book${list.length===1?'':'s'}</b><span>${state.scriptureFilter==='all'?'Complete 81-book Scripture collection':categoryLabel[state.scriptureFilter]||'Scripture'}</span>`;
  $('#booksHubContent').innerHTML=list.length?`<div class="scriptureShelf">${list.map(b=>`<a href="${bookRoute(b.slug,1)}" class="scriptureBookCard"><span class="bookNo">${String(b.order||books.indexOf(b)+1).padStart(2,'0')}</span><span class="bookMeta"><b>${esc(b.title)}</b><small>${esc(categoryLabel[b.category]||'Scripture')} · ${Array.isArray(b.chapters)?b.chapters.length:'—'} ${b.title==='Psalms'?'psalms':'chapters'}</small></span><i>›</i></a>`).join('')}</div>`:`<div class="booksEmpty"><b>No books found</b><span>Try another title or section.</span></div>`;
}

function matchesAncient(s,q){if(!q)return true;const r=ancientRecord(s),n=q.toLowerCase();return `${r.title} ${r.part} ${r.text}`.toLowerCase().includes(n)}
function snippetFor(s,q){
  const r=ancientRecord(s),text=r.body||r.text;if(!text)return '';
  if(!q)return clean(text).slice(0,165);
  const at=text.toLowerCase().indexOf(q.toLowerCase());if(at<0)return clean(text).slice(0,165);
  const start=Math.max(0,at-55),end=Math.min(text.length,at+q.length+110);return `${start?'…':''}${clean(text.slice(start,end))}${end<text.length?'…':''}`;
}
function paintAncient(m){
  if(!m||!Array.isArray(m.sections))return;
  const parts=[...new Set(m.sections.map(s=>partShort(s.part)).filter(Boolean))];
  $('#ancientTabCount').textContent=`${m.section_count||m.sections.length} readings`;
  const options=[`<option value="all">All Ancient Library</option>`,...parts.map((p,i)=>`<option value="${i}" ${state.ancientPart===String(i)?'selected':''}>${esc(p)}</option>`)].join('');
  $('#booksHubChips').innerHTML=`<label class="books96Collection"><span>Collection</span><select data-ancient-collection aria-label="Ancient Library collection">${options}</select></label>`;
  const selected=state.ancientPart==='all'?null:parts[+state.ancientPart],q=state.query;
  const matches=m.sections.filter(s=>(!selected||partShort(s.part)===selected)&&matchesAncient(s,q)),shown=matches.slice(0,q?140:260);
  $('#booksHubStatus').innerHTML=`<b>${matches.length} ${matches.length===1?'reading':'readings'}</b><span>${q?'Matching titles and text':'Historical texts · separate from Scripture'}</span>`;
  $('#booksHubContent').innerHTML=shown.length?`<div class="ancientShelf">${shown.map(s=>{const r=ancientRecord(s);return `<button type="button" class="ancientTextCard" data-ancient-index="${s._i}"><span class="ancientCardTop"><em>${esc(r.part)}</em><i>›</i></span><b>${esc(r.title)}</b><p>${esc(snippetFor(s,q))}</p></button>`}).join('')}</div>`:`<div class="booksEmpty"><b>No Ancient Library results</b><span>Try another title, topic, or phrase.</span></div>`;
}
async function renderAncient(){
  if(state.manifest){paintAncient(state.manifest);return}
  $('#booksHubChips').innerHTML='';$('#booksHubStatus').innerHTML='<b>Opening Ancient Library…</b><span>Preparing historical readings</span>';$('#booksHubContent').innerHTML='<div class="booksLoading"><div class="spinner"></div><b>Loading Ancient Library</b><span>This only loads when you open this shelf.</span></div>';
  try{paintAncient(await loadManifest())}catch(e){console.error('Ancient Library',e);$('#booksHubStatus').innerHTML='<b>Ancient Library unavailable</b><span>Scripture is still available.</span>';$('#booksHubContent').innerHTML=`<div class="booksEmpty"><b>Could not open historical texts</b><span>${esc(e.message||'Please try again.')}</span><button type="button" id="retryAncient">Try again</button></div>`;$('#retryAncient')?.addEventListener('click',()=>{state.loading=null;state.manifest=null;renderAncient()})}
}

function paragraphHTML(text,query=''){
  const blocks=String(text||'').replace(/\r/g,'').trim().split(/\n\s*\n|\n(?=(?:CHAPTER|Chapter|CHAP\.|Book|BOOK|PART|Part|[IVXLCDM]+\.?\s|\d+\.\s))/).filter(Boolean),q=query.trim();
  return blocks.map(block=>{const compact=block.trim(),isHead=compact.length<180&&/^(?:CHAPTER|Chapter|CHAP\.|BOOK|Book|PART|Part|[IVXLCDM]+\.?\s|\d+\.\s)/.test(compact);let safe=esc(compact).replace(/\n/g,'<br>');if(q){const re=new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi');safe=safe.replace(re,'<mark>$1</mark>')}return isHead?`<h3>${safe}</h3>`:`<p>${safe}</p>`}).join('');
}

async function openAncientReader(index){
  try{
    const m=await loadManifest(),s=m.sections[index];if(!s)return;closeDrawer();closeSheet();
    const app=$('#app');if(!app)return;const r=ancientRecord(s),total=m.sections.length;state.fontStep=1;
    const readingOptions=m.sections.map((x,i)=>{const rr=ancientRecord(x);return `<option value="${i}" ${i===index?'selected':''}>${esc(rr.title)}</option>`}).join('');
    app.innerHTML=`<section class="reader ancientPageReader" data-ancient-font="1">
      <header class="readerHead ancientPageHead"><span class="eyebrow">ANCIENT LIBRARY · READING ${index+1} OF ${total}</span><h1>${esc(r.title)}</h1><p>${esc(r.part)}</p></header>
      <div class="readerTools glass ancientReaderTools">
        <select id="ancientReadingSelect" aria-label="Ancient Library reading">${readingOptions}</select>
        <button id="ancientFindToggle" type="button">⌕ Find</button>
        <button id="ancientFontBtn" type="button">Aa</button>
        <button id="ancientShelfBtn" type="button">Books</button>
      </div>
      <div id="ancientInlineFind" class="ancientInlineFind" hidden><span>⌕</span><input id="ancientReaderSearch" type="search" placeholder="Find in this text…" aria-label="Find in this text"><button id="ancientReaderFindBtn" type="button">Find</button><button id="ancientReaderClearBtn" type="button" aria-label="Close find">×</button></div>
      <div id="ancientReaderMatchStatus" class="ancientReaderMatchStatus"></div>
      <article id="ancientReaderText" class="chapterText ancientChapterText">${paragraphHTML(r.body)}</article>
      <nav class="readerPager ancientReaderPager"><button id="ancientPrev" type="button" ${index<=0?'disabled':''}>← Previous</button><button id="ancientNext" type="button" ${index>=total-1?'disabled':''}>Next →</button></nav>
    </section>`;
    $('#ancientReadingSelect')?.addEventListener('change',e=>openAncientReader(+e.target.value));
    $('#ancientShelfBtn')?.addEventListener('click',()=>openBooksHub('ancient'));
    $('#ancientPrev')?.addEventListener('click',()=>openAncientReader(index-1));$('#ancientNext')?.addEventListener('click',()=>openAncientReader(index+1));
    $('#ancientFontBtn')?.addEventListener('click',()=>{state.fontStep=(state.fontStep+1)%4;$('.ancientPageReader')?.setAttribute('data-ancient-font',String(state.fontStep))});
    $('#ancientFindToggle')?.addEventListener('click',()=>{const bar=$('#ancientInlineFind');if(!bar)return;bar.hidden=!bar.hidden;if(!bar.hidden)setTimeout(()=>$('#ancientReaderSearch')?.focus(),20)});
    const find=()=>applyReaderSearch(r.body);$('#ancientReaderFindBtn')?.addEventListener('click',find);$('#ancientReaderSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find()}});
    $('#ancientReaderClearBtn')?.addEventListener('click',()=>{const i=$('#ancientReaderSearch');if(i)i.value='';$('#ancientReaderText').innerHTML=paragraphHTML(r.body);$('#ancientReaderMatchStatus').textContent='';$('#ancientInlineFind').hidden=true});
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }catch(e){console.error(e);const t=$('#toast');if(t){t.textContent='Could not open that historical text';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}}
}
function applyReaderSearch(text){
  const q=clean($('#ancientReaderSearch')?.value),box=$('#ancientReaderText'),status=$('#ancientReaderMatchStatus');if(!box||!status)return;
  box.innerHTML=paragraphHTML(text,q);if(!q){status.textContent='';return}const marks=$$('mark',box);status.textContent=marks.length?`${marks.length} match${marks.length===1?'':'es'} in this text`:'No matches in this text';marks[0]?.scrollIntoView({behavior:'smooth',block:'center'});
}

function installCaptureNavigation(){
  if(document.documentElement.dataset.books96Capture==='1')return;document.documentElement.dataset.books96Capture='1';
  document.addEventListener('click',e=>{const t=e.target.closest?.('#bottomBooks,#menuBtn,#allBooksBtn,[data-canon]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();openBooksHub('scripture',t.dataset?.canon||'all')},true);
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&$('#drawer')?.classList.contains('open')){const i=$('#booksHubSearchInput');if(i&&document.activeElement!==i){e.preventDefault();i.focus()}}});
}
function boot(){
  installCaptureNavigation();let tries=0;const timer=setInterval(()=>{tries++;if($('#drawer')&&Array.isArray(window.MEB_BOOKS)&&window.MEB_BOOKS.length){clearInterval(timer);decorateDrawer();renderScripture()}else if(tries>120)clearInterval(timer)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();