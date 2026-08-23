(() => {
'use strict';

const LIB_VERSION='97';
const LIB_URL=`/ancient-library.json?v=${LIB_VERSION}`;
const state={manifest:null,loading:null,catalog:null,tab:'scripture',scriptureFilter:'all',ancientPart:'all',query:'',fontStep:1};
const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>r?.querySelectorAll?[...r.querySelectorAll(s)]:[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const categoryLabel={ot:'Old Testament',eth:'Ethiopian Canon',nt:'New Testament'};
const bookRoute=(slug,c=1)=>`#read/${slug}/${c}`;
const headingRe=/^(?:CHAP(?:TER)?\.?\s+[IVXLCDM0-9]+\.?|BOOK\s+[IVXLCDM0-9]+\.?|LETTER\s+[IVXLCDM0-9]+\.?|EPISTLE\s+[IVXLCDM0-9]+\.?|VISION\s+[IVXLCDM0-9]+\.?|MANDATE\s+[IVXLCDM0-9]+\.?|SIMILITUDE\s+[IVXLCDM0-9]+\.?)/i;

const fbeWorks=[
  ['First Book of Adam and Eve',/\b(?:the\s+)?first book of adam and eve\b/i],
  ['Second Book of Adam and Eve',/\b(?:the\s+)?second book of adam and eve\b/i],
  ['Secrets of Enoch',/\b(?:the\s+)?secrets? of enoch\b/i],
  ['Psalms of Solomon',/\b(?:the\s+)?psalms? of solomon\b/i],
  ['Odes of Solomon',/\b(?:the\s+)?odes? of solomon\b/i],
  ['Letter of Aristeas',/\b(?:the\s+)?letter of aristeas\b/i],
  ['Fourth Book of Maccabees',/\b(?:the\s+)?fourth book of maccabees\b/i],
  ['Story of Ahikar',/\b(?:the\s+)?story of ahikar\b/i],
  ['Testament of Reuben',/\b(?:the\s+)?testament of reuben\b/i],
  ['Testament of Simeon',/\b(?:the\s+)?testament of simeon\b/i],
  ['Testament of Levi',/\b(?:the\s+)?testament of levi\b/i],
  ['Testament of Judah',/\b(?:the\s+)?testament of judah\b/i],
  ['Testament of Issachar',/\b(?:the\s+)?testament of issachar\b/i],
  ['Testament of Zebulun',/\b(?:the\s+)?testament of zebulun\b/i],
  ['Testament of Dan',/\b(?:the\s+)?testament of dan\b/i],
  ['Testament of Naphtali',/\b(?:the\s+)?testament of naphtali\b/i],
  ['Testament of Gad',/\b(?:the\s+)?testament of gad\b/i],
  ['Testament of Asher',/\b(?:the\s+)?testament of asher\b/i],
  ['Testament of Joseph',/\b(?:the\s+)?testament of joseph\b/i],
  ['Testament of Benjamin',/\b(?:the\s+)?testament of benjamin\b/i]
];

async function loadManifest(){
  if(state.manifest)return state.manifest;
  if(state.loading)return state.loading;
  state.loading=fetch(LIB_URL,{cache:'force-cache'}).then(async r=>{
    if(!r.ok)throw Error(`Ancient Library unavailable (${r.status})`);
    const data=await r.json();
    if(!data||!Array.isArray(data.sections)||!data.sections.length)throw Error('Ancient Library index is empty');
    data.sections=data.sections.map((s,i)=>({...s,_i:i}));state.manifest=data;return data;
  }).catch(e=>{state.loading=null;throw e});
  return state.loading;
}

function partKey(p){
  const s=String(p||'').toLowerCase();
  if(s.includes('forgotten'))return'ancient';
  if(s.includes('apostolic'))return'apostolic';
  if(s.includes('canon'))return'canon';
  return'early';
}
function partLabel(k){return({ancient:'Ancient writings',apostolic:'Apostolic Fathers',early:'Early Church',canon:'Canon history'})[k]||'Ancient Library'}
function closeDrawer(){const d=$('#drawer'),b=$('#backdrop');d?.classList.remove('open');b?.classList.remove('open');document.body.classList.remove('locked')}
function openDrawer(){const d=$('#drawer'),b=$('#backdrop');d?.classList.add('open');b?.classList.add('open');document.body.classList.add('locked');$('#bottomBooks')?.classList.add('active');requestAnimationFrame(()=>$('#books96Scroll')?.scrollTo?.({top:0,left:0,behavior:'instant'}))}
function closeSheet(){const sheet=$('#sheet');if(sheet?.open)sheet.close()}

function romanToNumber(r){
  r=String(r||'').toUpperCase();if(/^\d+$/.test(r))return+r;
  const v={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let n=0,prev=0;
  for(let i=r.length-1;i>=0;i--){const x=v[r[i]]||0;n+=x<prev?-x:x;prev=Math.max(prev,x)}return n||null;
}
function prettyHeading(h){
  h=clean(h).replace(/\.$/,'');const m=h.match(/^(CHAP(?:TER)?|BOOK|LETTER|EPISTLE|VISION|MANDATE|SIMILITUDE)\.?\s+([IVXLCDM0-9]+)/i);
  if(!m)return h;const type=/^chap/i.test(m[1])?'Chapter':m[1][0].toUpperCase()+m[1].slice(1).toLowerCase();return`${type} ${romanToNumber(m[2])||m[2]}`;
}
function sourceJunk(t){
  if(!t)return true;
  return /^(?:sacred texts?|bible|apocrypha|index|previous|next|home|contents?|illustrations?|historical introductions?)$/i.test(t)
    || /^(?:next|previous)\s*:/i.test(t)
    || /buy\s+(?:this\s+)?book.*amazon|amazon\.com/i.test(t)
    || /sacred[- ]texts\.com|internet sacred text archive|www\.sacred[- ]texts/i.test(t)
    || /^https?:\/\//i.test(t)||/^www\./i.test(t)
    || /^public[- ]domain/i.test(t)||/^copyright\b|^all rights reserved/i.test(t)
    || /^rutherford h\.?\s*platt/i.test(t)||/^edited by rutherford/i.test(t)
    || /^new york,?\s*n\.?y\.?;?\s*alpha house/i.test(t)||/^alpha house\b/i.test(t)
    || /^\[?1926\]?$/i.test(t)||/^\[?ad\s*\d{2,4}\]?/i.test(t)
    || /^ante[- ]nicene fathers/i.test(t)||/^from eusebius/i.test(t);
}
function cleanAncientText(raw){
  let lines=String(raw||'').replace(/\r/g,'').split('\n').map(x=>x.replace(/[ \t]+/g,' ').trim());
  const firstStructure=lines.findIndex(x=>headingRe.test(x));
  if(firstStructure>0){
    const lead=lines.slice(0,firstStructure).join(' ');
    if(/historical introductions?|\[ad\s*\d+\]|eusebius|sacred texts?|amazon|rutherford h\.?\s*platt|alpha house|public[- ]domain/i.test(lead))lines=lines.slice(firstStructure);
  }
  lines=lines.filter(x=>!sourceJunk(x));
  return lines.join('\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function looksLikeContents(text,title=''){
  if(/^(?:contents?|index|illustrations?)$/i.test(clean(title)))return true;
  const lines=String(text||'').split('\n').map(clean).filter(Boolean),nums=lines.filter(x=>/^\d{1,4}$/.test(x)).length,short=lines.filter(x=>x.length<70).length;
  return nums>=5&&short>=10&&nums/Math.max(1,lines.length)>.18;
}
function prettifyFileTitle(title){
  let t=String(title||'').replace(/[_]+/g,' ').replace(/\.[a-z0-9]{2,5}$/i,'').replace(/^\d+[\s._-]+/,'').replace(/\s+/g,' ').trim();
  t=t.replace(/\s*[-—|:]\s*(?:sacred[- ]texts?|internet sacred text archive).*$/i,'').replace(/\s*[-—]\s*page\s*\d+.*$/i,'').replace(/\bpage\s*\d+\b.*$/i,'').trim();
  return t;
}
function knownWorkTitle(title,text,part){
  const hay=`${title} ${String(text||'').slice(0,1200)}`;
  if(partKey(part)==='ancient'){for(const [name,re]of fbeWorks)if(re.test(hay))return name}
  const rules=[
    ['First Epistle of Clement to the Corinthians',/(?:first|1st|1)\s+(?:epistle of )?clement|clement.*corinthians/i],
    ['Second Epistle of Clement',/(?:second|2nd|2)\s+(?:epistle of )?clement/i],
    ['Didache',/\bdidache\b/i],['Epistle of Barnabas',/\bbarnabas\b/i],['Shepherd of Hermas',/\bhermas\b/i],
    ['Epistle to Diognetus',/\bdiognet/i],['Fragments of Papias',/\bpapias\b/i],['Quadratus Fragment',/\bquadratus\b/i],
    ['Polycarp to the Philippians',/polycarp.*philipp/i],['Martyrdom of Polycarp',/polycarp.*martyr|martyr.*polycarp/i],
    ['Muratorian Fragment',/murator/i],['Athanasius — Festal Letter 39',/athanasius.*(?:festal|letter).*39/i]
  ];
  for(const [name,re]of rules)if(re.test(title))return name;
  return prettifyFileTitle(title)||'Ancient text';
}
function sectionChunks(text){
  const lines=String(text||'').split('\n'),starts=[];
  lines.forEach((l,i)=>{if(headingRe.test(clean(l)))starts.push(i)});
  if(!starts.length)return[{label:'',text:String(text||'').trim()}];
  const out=[];
  if(starts[0]>0){const lead=lines.slice(0,starts[0]).join('\n').trim();if(lead.length>160)out.push({label:'Opening',text:lead})}
  for(let n=0;n<starts.length;n++){
    const a=starts[n],b=starts[n+1]??lines.length,label=prettyHeading(lines[a]),body=lines.slice(a+1,b).join('\n').trim();
    if(body.length>40)out.push({label,text:body});
  }
  return out.length?out:[{label:'',text:String(text||'').trim()}];
}
function buildCatalog(m){
  if(state.catalog)return state.catalog;
  const grouped=new Map(),works=[];
  for(const s of m.sections){
    const body=cleanAncientText(s.text||''),rawTitle=prettifyFileTitle(s.title||'');
    if(body.length<80||looksLikeContents(body,rawTitle)||/^(?:the\s+)?forgotten books of eden$/i.test(rawTitle)||/^illustrations?$/i.test(rawTitle))continue;
    const collection=partKey(s.part),title=knownWorkTitle(rawTitle,body,s.part),isFbe=collection==='ancient'&&fbeWorks.some(([name])=>name===title);
    const key=isFbe?`${collection}|${title.toLowerCase()}`:`${collection}|${s._i}|${title.toLowerCase()}`;
    let work=grouped.get(key);
    if(!work){work={id:`w${works.length}`,title,collection,chapters:[],search:''};grouped.set(key,work);works.push(work)}
    for(const chunk of sectionChunks(body)){
      let label=chunk.label;
      if(!label&&work.chapters.length)label=`Section ${work.chapters.length+1}`;
      work.chapters.push({label,text:chunk.text,sourceIndex:s._i});
    }
  }
  for(const work of works){
    if(work.chapters.length>1)work.chapters.forEach((c,i)=>{if(!c.label||c.label==='Opening')c.label=`Chapter ${i+1}`});
    work.search=`${work.title} ${work.chapters.map(c=>`${c.label} ${c.text}`).join(' ')}`.toLowerCase();
  }
  state.catalog=works.filter(w=>w.chapters.some(c=>c.text.length>70));return state.catalog;
}

function decorateDrawer(){
  const drawer=$('#drawer');if(!drawer)return;if(drawer.dataset.booksNavVersion==='97')return;
  drawer.dataset.booksNavVersion='97';drawer.dataset.ancientLibrary='1';drawer.classList.add('booksHubDrawer');
  drawer.innerHTML=`<div class="books96Top"><header class="books96Header"><div><span class="eyebrow">HOBAH LIBRARY</span><h2>Books</h2></div><button class="books96Close" id="closeDrawer" type="button" aria-label="Close books">×</button></header><nav class="books96Shelves" role="tablist" aria-label="Library shelves"><button type="button" data-books-tab="scripture" class="active" role="tab" aria-selected="true"><b>Scripture</b><span>81 books</span></button><button type="button" data-books-tab="ancient" role="tab" aria-selected="false"><b>Ancient Library</b><span id="ancientTabCount">Books & letters</span></button></nav><label class="books96Search" for="booksHubSearchInput"><span aria-hidden="true">⌕</span><input id="booksHubSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search Scripture…" aria-label="Search books"><button id="booksHubClear" type="button" aria-label="Clear search">×</button></label></div><div id="books96Scroll" class="books96Scroll" tabindex="0"><div id="booksHubChips" class="books96Filters" aria-label="Book filters"></div><div id="booksHubStatus" class="books96Status" aria-live="polite"></div><div id="booksHubContent" class="books96Content"></div></div><div id="drawerFilters" hidden></div><div id="drawerBooks" hidden></div>`;
  $('#closeDrawer',drawer)?.addEventListener('click',closeDrawer);
  $$('[data-books-tab]',drawer).forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.booksTab)));
  let timer=null;const input=$('#booksHubSearchInput',drawer);
  input?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.query=clean(input.value);renderActiveShelf()},100)});
  $('#booksHubClear',drawer)?.addEventListener('click',e=>{e.preventDefault();if(input)input.value='';state.query='';renderActiveShelf()});
  $('#booksHubChips',drawer)?.addEventListener('click',e=>{const b=e.target.closest('button[data-scripture-filter],button[data-ancient-part]');if(!b)return;if(b.dataset.scriptureFilter!==undefined){state.scriptureFilter=b.dataset.scriptureFilter;renderScripture()}else{state.ancientPart=b.dataset.ancientPart;paintAncient(state.manifest)}});
  $('#booksHubContent',drawer)?.addEventListener('click',e=>{const ancient=e.target.closest('[data-ancient-work]');if(ancient){e.preventDefault();openAncientReader(ancient.dataset.ancientWork,0);return}if(e.target.closest('a[href^="#read/"]'))closeDrawer()});
}
function openBooksHub(tab='scripture',filter='all'){decorateDrawer();state.tab=tab;if(tab==='scripture')state.scriptureFilter=filter||'all';state.query='';const input=$('#booksHubSearchInput');if(input){input.value='';input.blur()}setTab(tab);openDrawer()}
function setTab(tab){
  state.tab=tab==='ancient'?'ancient':'scripture';
  const input=$('#booksHubSearchInput');input?.blur();
  $$('[data-books-tab]',$('#drawer')).forEach(b=>{const on=b.dataset.booksTab===state.tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});
  if(input)input.placeholder=state.tab==='ancient'?'Search Ancient Library…':'Search Scripture…';renderActiveShelf();requestAnimationFrame(()=>$('#books96Scroll')?.scrollTo?.({top:0,left:0,behavior:'instant'}));
}
function renderActiveShelf(){state.tab==='ancient'?renderAncient():renderScripture()}
function renderScripture(){
  const books=Array.isArray(window.MEB_BOOKS)?window.MEB_BOOKS:[],q=state.query.toLowerCase(),list=books.filter(b=>(state.scriptureFilter==='all'||b.category===state.scriptureFilter)&&(!q||`${b.title} ${categoryLabel[b.category]||''}`.toLowerCase().includes(q)));
  const filters=[['all','All 81'],['ot','Old Testament'],['eth','Ethiopian'],['nt','New Testament']];
  $('#booksHubChips').innerHTML=`<div class="books96FilterGrid">${filters.map(([id,label])=>`<button type="button" data-scripture-filter="${id}" class="${state.scriptureFilter===id?'active':''}">${label}</button>`).join('')}</div>`;
  $('#booksHubStatus').innerHTML=`<b>${list.length} book${list.length===1?'':'s'}</b><span>${state.scriptureFilter==='all'?'81-book Scripture collection':categoryLabel[state.scriptureFilter]||'Scripture'}</span>`;
  $('#booksHubContent').innerHTML=list.length?`<div class="scriptureShelf">${list.map(b=>`<a href="${bookRoute(b.slug,1)}" class="scriptureBookCard"><span class="bookNo">${String(b.order||books.indexOf(b)+1).padStart(2,'0')}</span><span class="bookMeta"><b>${esc(b.title)}</b><small>${esc(categoryLabel[b.category]||'Scripture')} · ${Array.isArray(b.chapters)?b.chapters.length:'—'} ${b.title==='Psalms'?'psalms':'chapters'}</small></span><i>›</i></a>`).join('')}</div>`:`<div class="booksEmpty"><b>No books found</b><span>Try another title.</span></div>`;
}
function paintAncient(m){
  if(!m)return;const catalog=buildCatalog(m),q=state.query.toLowerCase();
  $('#ancientTabCount').textContent=`${catalog.length} books & letters`;
  const filters=[['all','All'],['ancient','Ancient writings'],['apostolic','Apostolic Fathers'],['early','Early Church'],['canon','Canon history']];
  $('#booksHubChips').innerHTML=`<div class="books97AncientFilters">${filters.map(([id,label])=>`<button type="button" data-ancient-part="${id}" class="${state.ancientPart===id?'active':''}">${label}</button>`).join('')}</div>`;
  const list=catalog.filter(w=>(state.ancientPart==='all'||w.collection===state.ancientPart)&&(!q||w.search.includes(q)));
  $('#booksHubStatus').innerHTML=`<b>${list.length} ${list.length===1?'work':'works'}</b><span>${q?'Matching titles and text':'Books, letters and primary texts'}</span>`;
  $('#booksHubContent').innerHTML=list.length?`<div class="ancientShelf">${list.map(w=>`<button type="button" class="ancientTextCard ancientWorkCard" data-ancient-work="${w.id}"><span class="ancientCardTop"><em>${esc(partLabel(w.collection))}</em><i>›</i></span><b>${esc(w.title)}</b><small>${w.chapters.length>1?`${w.chapters.length} chapters / sections`:'Complete text'}</small></button>`).join('')}</div>`:`<div class="booksEmpty"><b>No Ancient Library results</b><span>Try another title or phrase.</span></div>`;
}
async function renderAncient(){
  if(state.manifest){paintAncient(state.manifest);return}
  $('#booksHubChips').innerHTML='';$('#booksHubStatus').innerHTML='<b>Opening Ancient Library…</b><span>Organising books and letters</span>';$('#booksHubContent').innerHTML='<div class="booksLoading"><div class="spinner"></div><b>Loading Ancient Library</b></div>';
  try{const m=await loadManifest();buildCatalog(m);paintAncient(m)}catch(e){console.error(e);$('#booksHubContent').innerHTML=`<div class="booksEmpty"><b>Could not open Ancient Library</b><span>${esc(e.message||'Please try again.')}</span></div>`}
}

function paragraphHTML(text,query=''){
  const blocks=String(text||'').replace(/\r/g,'').trim().split(/\n\s*\n|\n(?=(?:CHAPTER|Chapter|CHAP\.|Book|BOOK|LETTER|Letter|EPISTLE|Epistle|VISION|Vision|MANDATE|Mandate|SIMILITUDE|Similitude))/).filter(Boolean),q=query.trim();
  return blocks.map(block=>{const compact=block.trim(),isHead=compact.length<150&&headingRe.test(compact);let safe=esc(compact).replace(/\n/g,'<br>');if(q){const re=new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi');safe=safe.replace(re,'<mark>$1</mark>')}return isHead?`<h3>${safe}</h3>`:`<p>${safe}</p>`}).join('');
}
function bridgeContext(work,chapter,index){return{id:work.id,title:work.title,chapterNumber:index+1,chapterLabel:chapter.label||'',text:chapter.text,reference:`${work.title}${chapter.label?` — ${chapter.label}`:''}`}}
function setBridge(ctx){try{window.HobahAncientBridge?.setContext?.(ctx)}catch(e){console.warn('Ancient bridge',e)}}
function findWork(id){return state.catalog?.find(w=>w.id===id)||null}
async function openAncientReader(workId,chapterIndex=0){
  try{
    const m=await loadManifest(),catalog=buildCatalog(m),work=findWork(workId)||catalog[0];if(!work)return;chapterIndex=Math.max(0,Math.min(chapterIndex,work.chapters.length-1));const chapter=work.chapters[chapterIndex];
    closeDrawer();closeSheet();state.fontStep=1;const app=$('#app');if(!app)return;
    const workOptions=catalog.map(w=>`<option value="${w.id}" ${w.id===work.id?'selected':''}>${esc(w.title)}</option>`).join(''),chapterOptions=work.chapters.map((c,i)=>`<option value="${i}" ${i===chapterIndex?'selected':''}>${esc(c.label||`Text ${i+1}`)}</option>`).join('');
    app.innerHTML=`<section class="reader ancientPageReader" data-ancient-font="1"><header class="readerHead ancientPageHead"><span class="eyebrow">ANCIENT LIBRARY</span><h1>${esc(work.title)}</h1>${chapter.label?`<p>${esc(chapter.label)}</p>`:''}</header><div class="readerTools glass ancientReaderTools"><select id="ancientBookSelect" aria-label="Ancient Library book">${workOptions}</select>${work.chapters.length>1?`<select id="ancientChapterSelect" aria-label="Chapter or section">${chapterOptions}</select>`:''}<button id="ancientListen" class="toolStrong" type="button">▶ Listen</button><button id="ancientStudy" type="button">✦ Study AI</button><button id="ancientFindToggle" type="button">⌕ Find</button><button id="ancientFontBtn" type="button">Aa</button><button id="ancientShelfBtn" type="button">Books</button></div><div id="ancientInlineFind" class="ancientInlineFind" hidden><span>⌕</span><input id="ancientReaderSearch" type="search" placeholder="Find in this text…" aria-label="Find in this text"><button id="ancientReaderFindBtn" type="button">Find</button><button id="ancientReaderClearBtn" type="button" aria-label="Close find">×</button></div><div id="ancientReaderMatchStatus" class="ancientReaderMatchStatus"></div><article id="ancientReaderText" class="chapterText ancientChapterText">${paragraphHTML(chapter.text)}</article><nav class="readerPager ancientReaderPager"><button id="ancientPrev" type="button" ${chapterIndex<=0?'disabled':''}>← Previous</button><button id="ancientNext" type="button" ${chapterIndex>=work.chapters.length-1?'disabled':''}>Next →</button></nav></section>`;
    const ctx=bridgeContext(work,chapter,chapterIndex);setBridge(ctx);
    $('#ancientBookSelect')?.addEventListener('change',e=>openAncientReader(e.target.value,0));$('#ancientChapterSelect')?.addEventListener('change',e=>openAncientReader(work.id,+e.target.value));
    $('#ancientShelfBtn')?.addEventListener('click',()=>openBooksHub('ancient'));$('#ancientPrev')?.addEventListener('click',()=>openAncientReader(work.id,chapterIndex-1));$('#ancientNext')?.addEventListener('click',()=>openAncientReader(work.id,chapterIndex+1));
    $('#ancientListen')?.addEventListener('click',()=>{setBridge(ctx);if(window.HobahAncientBridge?.openListen)window.HobahAncientBridge.openListen(ctx);else toastLocal('Listen is loading — try again')});
    $('#ancientStudy')?.addEventListener('click',()=>{setBridge(ctx);if(window.HobahAncientBridge?.openStudy)window.HobahAncientBridge.openStudy(ctx);else toastLocal('Study AI is loading — try again')});
    $('#ancientFontBtn')?.addEventListener('click',()=>{state.fontStep=(state.fontStep+1)%4;$('.ancientPageReader')?.setAttribute('data-ancient-font',String(state.fontStep))});
    $('#ancientFindToggle')?.addEventListener('click',()=>{const bar=$('#ancientInlineFind');if(!bar)return;bar.hidden=!bar.hidden;if(!bar.hidden)setTimeout(()=>$('#ancientReaderSearch')?.focus(),20)});
    const find=()=>applyReaderSearch(chapter.text);$('#ancientReaderFindBtn')?.addEventListener('click',find);$('#ancientReaderSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find()}});$('#ancientReaderClearBtn')?.addEventListener('click',()=>{const i=$('#ancientReaderSearch');if(i)i.value='';$('#ancientReaderText').innerHTML=paragraphHTML(chapter.text);$('#ancientReaderMatchStatus').textContent='';$('#ancientInlineFind').hidden=true});
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }catch(e){console.error(e);toastLocal('Could not open that text')}
}
function applyReaderSearch(text){const q=clean($('#ancientReaderSearch')?.value),box=$('#ancientReaderText'),status=$('#ancientReaderMatchStatus');if(!box||!status)return;box.innerHTML=paragraphHTML(text,q);if(!q){status.textContent='';return}const marks=$$('mark',box);status.textContent=marks.length?`${marks.length} match${marks.length===1?'':'es'}`:'No matches';marks[0]?.scrollIntoView({behavior:'smooth',block:'center'})}
function toastLocal(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1900)}
function installCaptureNavigation(){if(document.documentElement.dataset.books97Capture==='1')return;document.documentElement.dataset.books97Capture='1';document.addEventListener('click',e=>{const t=e.target.closest?.('#bottomBooks,#menuBtn,#allBooksBtn,[data-canon]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();openBooksHub('scripture',t.dataset?.canon||'all')},true)}
function boot(){installCaptureNavigation();let tries=0;const timer=setInterval(()=>{tries++;if($('#drawer')&&Array.isArray(window.MEB_BOOKS)&&window.MEB_BOOKS.length){clearInterval(timer);decorateDrawer();renderScripture()}else if(tries>120)clearInterval(timer)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();