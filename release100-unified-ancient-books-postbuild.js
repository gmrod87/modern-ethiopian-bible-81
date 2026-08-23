const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release100 missing '+f);
let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
const swap=(from,to,label)=>{if(!lib.includes(from))throw new Error('Release100 library patch missing: '+label);lib=lib.replace(from,()=>to)};

swap("const LIB_VERSION='99';","const LIB_VERSION='100';",'library cache version');
swap("if(drawer.dataset.booksNavVersion==='99')return;","if(drawer.dataset.booksNavVersion==='100')return;",'drawer version guard');
swap("drawer.dataset.booksNavVersion='99';","drawer.dataset.booksNavVersion='100';",'drawer version');
swap("document.documentElement.dataset.books99Capture==='1'","document.documentElement.dataset.books100Capture==='1'",'capture guard read');
swap("document.documentElement.dataset.books99Capture='1'","document.documentElement.dataset.books100Capture='1'",'capture guard write');

const catalogReplacement=String.raw`
function canonicalAncientTitle(title,text,part,source=''){
  let t=clean(finalWorkTitle(title,text,part,source));
  const hay=clean([t,title,source,String(text||'').slice(0,1800)].join(' '));
  t=t.replace(/^the\s+forgotten\s+books\s+of\s+eden\s*[:—–-]\s*/i,'')
     .replace(/^forgotten\s+books\s+of\s+eden\s*[:—–-]\s*/i,'')
     .replace(/^(?:fbe|anf|ccel|ista|sacred[- ]texts?)\s*[:—–-]\s*/i,'')
     .trim();

  const known=[
    ['The First Book of Adam and Eve',/(?:first|1st)\s+book\s+of\s+adam\s+and\s+e(?:ve)?\b|\bfbe\s*[-—:]?\s*book\s*1\b/i],
    ['The Second Book of Adam and Eve',/(?:second|2nd)\s+book\s+of\s+adam\s+and\s+e(?:ve)?\b|\bfbe\s*[-—:]?\s*book\s*2\b/i],
    ['The Secrets of Enoch',/\b(?:the\s+)?secrets?\s+of\s+enoch\b/i],
    ['The Psalms of Solomon',/\b(?:the\s+)?psalms?\s+of\s+solomon\b/i],
    ['The Odes of Solomon',/\b(?:the\s+)?odes?\s+of\s+solomon\b/i],
    ['The Letter of Aristeas',/\b(?:the\s+)?letter\s+of\s+aristeas\b/i],
    ['The Fourth Book of Maccabees',/\b(?:the\s+)?fourth\s+book\s+of\s+maccabees\b|\b4(?:th)?\s+maccabees\b/i],
    ['The Story of Ahikar',/\b(?:the\s+)?story\s+of\s+ahikar\b/i],
    ['The Testament of Reuben',/\btestament\s+of\s+reuben\b/i],
    ['The Testament of Simeon',/\btestament\s+of\s+simeon\b/i],
    ['The Testament of Levi',/\btestament\s+of\s+levi\b/i],
    ['The Testament of Judah',/\btestament\s+of\s+judah\b/i],
    ['The Testament of Issachar',/\btestament\s+of\s+issachar\b/i],
    ['The Testament of Zebulun',/\btestament\s+of\s+zebulun\b/i],
    ['The Testament of Dan',/\btestament\s+of\s+dan\b/i],
    ['The Testament of Naphtali',/\btestament\s+of\s+naphtali\b/i],
    ['The Testament of Gad',/\btestament\s+of\s+gad\b/i],
    ['The Testament of Asher',/\btestament\s+of\s+asher\b/i],
    ['The Testament of Joseph',/\btestament\s+of\s+joseph\b/i],
    ['The Testament of Benjamin',/\btestament\s+of\s+benjamin\b/i]
  ];
  for(const [name,re] of known)if(re.test(hay))return name;

  t=t.replace(/\s+(?:—|–|-|:)\s*(?:chapter|section)\s+[ivxlcdm0-9]+\.?$/i,'').trim();
  return t||'Ancient Text';
}
function canonicalTitleKey(title){
  return clean(title).toLowerCase().replace(/\bthe\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function sourceFamily(source){
  const parts=sourceParts(source).map(x=>clean(x)).filter(Boolean);
  return parts.filter(x=>! /^(?:chapter|section|page|book|letter)\s+[ivxlcdm0-9]+$/i.test(x)).slice(0,-1).join('|').toLowerCase();
}
function inferredChapterNumber(label,rawTitle,body){
  const candidates=[label,rawTitle,String(body||'').slice(0,220)];
  for(const v of candidates){
    const m=clean(v).match(/(?:^|\b)(?:chap(?:ter)?\.?|section)\s+([ivxlcdm0-9]+)/i);
    if(m){const n=romanToNumber(m[1]);if(n)return n}
  }
  return null;
}
function chapterFingerprint(text){return clean(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function chapterIndexHTML(work,current){
  if(!work||work.chapters.length<=1)return'';
  return '<section class="ancientChapterIndex" aria-label="All chapters"><div class="ancientChapterIndexHead"><b>Chapters</b><span>'+work.chapters.length+' chapters</span></div><div class="ancientChapterGrid">'+work.chapters.map((c,i)=>{
    const short=(c.label||('Chapter '+(i+1))).replace(/^Chapter\s+/i,'');
    return '<button type="button" data-ancient-chapter-jump="'+i+'" class="'+(i===current?'active':'')+'" aria-current="'+(i===current?'page':'false')+'"><span>'+esc(short)+'</span></button>';
  }).join('')+'</div></section>';
}
function buildCatalog(m){
  if(state.catalog)return state.catalog;
  const grouped=new Map(),works=[];
  for(const s of m.sections){
    const body=cleanAncientText(s.text||''),rawTitle=prettifyFileTitle(s.title||'');
    if(body.length<80||looksLikeContents(body,rawTitle)||/^(?:the\s+)?forgotten books of eden$/i.test(rawTitle)||/^illustrations?$/i.test(rawTitle)||isModernEditorialSection(rawTitle,body,s.part,s.source||''))continue;
    const collection=partKey(s.part),title=canonicalAncientTitle(rawTitle,body,s.part,s.source||'');
    const ambiguous=/^(?:Ancient Text|Early Christian Text|Apostolic Fathers|Ancient Canon Witness)\s+[—–-]/i.test(title);
    const key=collection+'|'+canonicalTitleKey(title)+(ambiguous?'|'+sourceFamily(s.source||''):'');
    let work=grouped.get(key);
    if(!work){work={id:'w'+works.length,title,collection,chapters:[],search:'',firstSource:s._i};grouped.set(key,work);works.push(work)}
    for(const chunk of sectionChunks(body)){
      const inferred=inferredChapterNumber(chunk.label,rawTitle,chunk.text);
      work.chapters.push({label:chunk.label||'',text:chunk.text,sourceIndex:s._i,chapterNumber:inferred});
    }
  }
  for(const work of works){
    const unique=[];
    for(const c of work.chapters){
      const fp=chapterFingerprint(c.text);if(!fp||fp.length<40)continue;
      const dup=unique.findIndex(x=>chapterFingerprint(x.text)===fp);
      if(dup>=0){if(c.text.length>unique[dup].text.length)unique[dup]=c;continue}
      unique.push(c);
    }
    unique.sort((a,b)=>{
      const an=Number.isFinite(a.chapterNumber)?a.chapterNumber:null,bn=Number.isFinite(b.chapterNumber)?b.chapterNumber:null;
      if(an!=null&&bn!=null&&an!==bn)return an-bn;if(an!=null&&bn==null)return-1;if(an==null&&bn!=null)return 1;return a.sourceIndex-b.sourceIndex;
    });
    const used=new Set();
    unique.forEach((c,i)=>{
      if(c.chapterNumber){c.label='Chapter '+c.chapterNumber;used.add(c.chapterNumber)}
      else if(!c.label||c.label==='Opening'||/^Section\s+\d+$/i.test(c.label)){
        let n=i+1;while(used.has(n))n++;c.chapterNumber=n;c.label='Chapter '+n;used.add(n)
      }else{
        const n=inferredChapterNumber(c.label,'','');if(n){c.chapterNumber=n;used.add(n);c.label='Chapter '+n}
      }
    });
    work.chapters=unique;
    work.search=(work.title+' '+work.chapters.map(c=>(c.label+' '+c.text)).join(' ')).toLowerCase();
  }
  state.catalog=works.filter(w=>w.chapters.some(c=>c.text.length>70));return state.catalog;
}

function decorateDrawer(){`;
const catalogRe=/function buildCatalog\(m\)\{[\s\S]*?\n\}\n\nfunction decorateDrawer\(\)\{/;
if(!catalogRe.test(lib))throw new Error('Release100 catalog block not found');
lib=lib.replace(catalogRe,()=>catalogReplacement);

const pagerOld='<article id="ancientReaderText" class="chapterText ancientChapterText">${paragraphHTML(chapter.text)}</article><nav class="readerPager ancientReaderPager"><button id="ancientPrev" type="button" ${chapterIndex<=0?\'disabled\':\'\'}>← Previous</button><button id="ancientNext" type="button" ${chapterIndex>=work.chapters.length-1?\'disabled\':\'\'}>Next →</button></nav></section>';
const pagerNew='<article id="ancientReaderText" class="chapterText ancientChapterText">${paragraphHTML(chapter.text)}</article><nav class="readerPager ancientReaderPager"><button id="ancientPrev" type="button" ${chapterIndex<=0?\'disabled\':\'\'}>← Previous</button><button id="ancientNext" type="button" ${chapterIndex>=work.chapters.length-1?\'disabled\':\'\'}>Next →</button></nav>${chapterIndexHTML(work,chapterIndex)}</section>';
swap(pagerOld,pagerNew,'bottom chapter index');
swap(
"    $('#ancientShelfBtn')?.addEventListener('click',()=>openBooksHub('ancient'));$('#ancientPrev')?.addEventListener('click',()=>openAncientReader(work.id,chapterIndex-1));$('#ancientNext')?.addEventListener('click',()=>openAncientReader(work.id,chapterIndex+1));",
"    $('#ancientShelfBtn')?.addEventListener('click',()=>openBooksHub('ancient'));$('#ancientPrev')?.addEventListener('click',()=>openAncientReader(work.id,chapterIndex-1));$('#ancientNext')?.addEventListener('click',()=>openAncientReader(work.id,chapterIndex+1));$$('[data-ancient-chapter-jump]').forEach(b=>b.addEventListener('click',()=>openAncientReader(work.id,+b.dataset.ancientChapterJump)));",
'chapter index navigation'
);

fs.writeFileSync(p('release94-ancient-library.js'),lib);

const css=String.raw`
/* Hobah Release 100 — unified Ancient books + Scripture-style chapter index */
.ancientChapterIndex{max-width:780px;margin:28px auto 110px;padding:22px;border:1px solid rgba(111,78,43,.16);border-radius:24px;background:rgba(255,250,241,.86);box-shadow:0 10px 32px rgba(72,49,27,.06)}
.ancientChapterIndexHead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:16px;color:#6f4a2b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.ancientChapterIndexHead b{font-size:18px}.ancientChapterIndexHead span{font-size:13px;color:#8a7b69}
.ancientChapterGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:9px}
.ancientChapterGrid button{min-width:0;height:50px;border:1px solid rgba(111,78,43,.18);border-radius:14px;background:#fffdf8;color:#5e4229;font:750 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:none}
.ancientChapterGrid button.active{background:#986a32;color:#fff;border-color:#986a32}
.ancientChapterGrid button:active{transform:scale(.97)}
@media(max-width:520px){.ancientChapterIndex{margin:24px 14px 112px;padding:18px 14px;border-radius:22px}.ancientChapterGrid{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.ancientChapterGrid button{height:46px;border-radius:12px}}
`;
fs.appendFileSync(p('release97-ancient-library.css'),'\n'+css+'\n');

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='99';"))throw new Error('Release100 expected app runtime v99');
app=app.replace("const V='99';","const V='100';");fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=99','v=100');fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=100#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const LIB_VERSION='100'",'canonicalAncientTitle','The First Book of Adam and Eve','chapterIndexHTML','data-ancient-chapter-jump'])if(!lib.includes(required))throw new Error('Release100 integration missing '+required);
for(const forbidden of ['The Forgotten Books of Eden: The First Book of Adam and Eve'])if(lib.includes(forbidden))throw new Error('Release100 long anthology title survived in runtime code');
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 100: canonical Ancient works, deduplicated chapters and bottom chapter index');
