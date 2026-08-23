const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release99 missing '+f);
let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
const swap=(from,to,label)=>{if(!lib.includes(from))throw new Error('Release99 library patch missing: '+label);lib=lib.replace(from,()=>to)};

swap("const LIB_VERSION='98';","const LIB_VERSION='99';",'library cache version');
swap("if(drawer.dataset.booksNavVersion==='98')return;","if(drawer.dataset.booksNavVersion==='99')return;",'drawer version guard');
swap("drawer.dataset.booksNavVersion='98';","drawer.dataset.booksNavVersion='99';",'drawer version');
swap("document.documentElement.dataset.books98Capture==='1'","document.documentElement.dataset.books99Capture==='1'",'capture guard read');
swap("document.documentElement.dataset.books98Capture='1'","document.documentElement.dataset.books99Capture='1'",'capture guard write');

const titleHelper=`
function finalWorkTitle(title,text,part,source=''){
  const raw=clean(title),sample=clean(text).slice(0,3200),sampleLow=sample.toLowerCase(),parts=sourceParts(source);
  const sourceText=parts.join(' ').toLowerCase(),sourceAndRaw=(sourceText+' '+raw).toLowerCase();
  let resolved=specificWorkTitle(title,text,part,source);

  const stripped=clean(String(resolved||'').replace(/^(?:fbe|anf|ccel|ist?a|sacred[- ]texts?)\\s*(?:—|–|-|:)\\s*/i,''));
  const generic=genericNumberTitle(stripped)||genericNumberTitle(raw);

  if((/\\bfbe\\b|forgotten books of eden/i.test(sourceAndRaw)||/^fbe\\b/i.test(resolved))&&generic?.type==='Book'){
    if(String(generic.n)==='1')return'First Book of Adam and Eve';
    if(String(generic.n)==='2')return'Second Book of Adam and Eve';
  }
  if(/crystal sea|cave of treasures/i.test(sample)&&/adam/i.test(sample))return'First Book of Adam and Eve';
  if(/such was the condition of the jews/i.test(sample)||(/parthia/i.test(sample)&&/thomas/i.test(sample)&&/scythia/i.test(sample)&&/andrew/i.test(sample))){
    if(generic?.type==='Book')return'Eusebius — Ecclesiastical History, Book '+generic.n;
    return'Eusebius — Ecclesiastical History';
  }

  resolved=clean(String(resolved||'').replace(/^(?:fbe|anf|ccel|ist?a|sacred[- ]texts?|internet sacred text archive)\\s*(?:—|–|-|:)\\s*/i,''));
  if(!resolved)resolved=raw;

  const remaining=genericNumberTitle(resolved);
  if(remaining){
    const usefulParts=parts.filter(x=>! /^(?:fbe|anf|ccel|ist?a|sacred[- ]texts?|internet sacred text archive|historical christian faith|writings database|book\\s+[ivxlcdm0-9]+|letter\\s+[ivxlcdm0-9]+|chapter\\s+[ivxlcdm0-9]+)$/i.test(clean(x)));
    const hint=usefulParts.slice().reverse().find(x=>clean(x).length>3);
    if(hint&&!genericNumberTitle(hint))return clean(hint)+' — '+remaining.type+' '+remaining.n;
    const collectionName=partKey(part)==='apostolic'?'Apostolic Fathers':partKey(part)==='early'?'Early Christian Text':partKey(part)==='canon'?'Ancient Canon Witness':'Ancient Text';
    return collectionName+' — '+remaining.type+' '+remaining.n;
  }
  return resolved;
}
`;
const titleAnchor='function sectionChunks(text){';
if(!lib.includes(titleAnchor))throw new Error('Release99 title helper anchor missing');
lib=lib.replace(titleAnchor,titleHelper+titleAnchor);

swap(
"    const collection=partKey(s.part),title=specificWorkTitle(rawTitle,body,s.part,s.source||''),isFbe=collection==='ancient'&&fbeWorks.some(([name])=>name===title);",
"    const collection=partKey(s.part),title=finalWorkTitle(rawTitle,body,s.part,s.source||''),isFbe=collection==='ancient'&&fbeWorks.some(([name])=>name===title);",
'final human-readable work titles'
);

swap(
'<button id="ancientFindToggle" type="button">⌕ Find</button>',
'<button id="ancientFindToggle" type="button" aria-expanded="false" aria-controls="ancientInlineFind">⌕ Find in text</button>',
'find button label'
);
swap(
'<div id="ancientInlineFind" class="ancientInlineFind" hidden><span>⌕</span><input id="ancientReaderSearch" type="search" placeholder="Find in this text…" aria-label="Find in this text"><button id="ancientReaderFindBtn" type="button">Find</button><button id="ancientReaderClearBtn" type="button" aria-label="Close find">×</button></div>',
'<div id="ancientInlineFind" class="ancientInlineFind" hidden><input id="ancientReaderSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Find a word or phrase…" aria-label="Find in this text"><button id="ancientReaderClearBtn" type="button" aria-label="Close find">Done</button></div>',
'compact find row'
);
swap(
"    $('#ancientFindToggle')?.addEventListener('click',()=>{const bar=$('#ancientInlineFind');if(!bar)return;bar.hidden=!bar.hidden;if(!bar.hidden)setTimeout(()=>$('#ancientReaderSearch')?.focus(),20)});",
"    $('#ancientFindToggle')?.addEventListener('click',()=>{const bar=$('#ancientInlineFind'),btn=$('#ancientFindToggle');if(!bar)return;const opening=bar.hidden;bar.hidden=!opening;btn?.setAttribute('aria-expanded',String(opening));if(opening){$('#ancientReaderMatchStatus').textContent='';setTimeout(()=>$('#ancientReaderSearch')?.focus(),20)}else{const i=$('#ancientReaderSearch');if(i)i.value='';$('#ancientReaderText').innerHTML=paragraphHTML(chapter.text);$('#ancientReaderMatchStatus').textContent=''}});",
'find toggle behaviour'
);
swap(
"    const find=()=>applyReaderSearch(chapter.text);$('#ancientReaderFindBtn')?.addEventListener('click',find);$('#ancientReaderSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find()}});$('#ancientReaderClearBtn')?.addEventListener('click',()=>{const i=$('#ancientReaderSearch');if(i)i.value='';$('#ancientReaderText').innerHTML=paragraphHTML(chapter.text);$('#ancientReaderMatchStatus').textContent='';$('#ancientInlineFind').hidden=true});",
"    const find=()=>applyReaderSearch(chapter.text);let findTimer=null;$('#ancientReaderSearch')?.addEventListener('input',()=>{clearTimeout(findTimer);findTimer=setTimeout(find,90)});$('#ancientReaderSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find()}});$('#ancientReaderClearBtn')?.addEventListener('click',()=>{const i=$('#ancientReaderSearch'),bar=$('#ancientInlineFind');if(i)i.value='';$('#ancientReaderText').innerHTML=paragraphHTML(chapter.text);$('#ancientReaderMatchStatus').textContent='';if(bar)bar.hidden=true;$('#ancientFindToggle')?.setAttribute('aria-expanded','false')});",
'live find behaviour'
);

fs.writeFileSync(p('release94-ancient-library.js'),lib);

const css=`
/* Hobah Release 99 — readable Ancient titles + one clean Find-in-text control */
.ancientInlineFind[hidden]{display:none!important;}
.ancientInlineFind{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;max-width:780px!important;margin:10px auto 2px!important;padding:9px!important;border:1px solid rgba(100,76,47,.14)!important;border-radius:16px!important;background:rgba(255,253,248,.94)!important;box-shadow:0 5px 18px rgba(71,52,32,.06)!important;}
.ancientInlineFind #ancientReaderSearch{min-width:0!important;width:100%!important;height:46px!important;padding:0 14px!important;border:0!important;border-radius:12px!important;background:transparent!important;color:#173f37!important;font:600 16px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;outline:none!important;}
.ancientInlineFind #ancientReaderSearch::placeholder{color:#969087!important;font-weight:500!important;}
.ancientInlineFind #ancientReaderClearBtn{width:auto!important;min-width:64px!important;height:42px!important;padding:0 13px!important;border:0!important;border-radius:12px!important;background:#eee6d8!important;color:#654a2e!important;font:750 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
.ancientReaderMatchStatus:empty{display:none!important;}
.ancientReaderMatchStatus{max-width:780px!important;margin:8px auto 0!important;padding:0 4px!important;color:#8b6435!important;font:700 12px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;}
.ancientReaderTools #ancientFindToggle{white-space:nowrap!important;}
`;
fs.appendFileSync(p('release97-ancient-library.css'),css);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='98';"))throw new Error('Release99 expected app runtime v98');
app=app.replace("const V='98';","const V='99';");fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=98','v=99');fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=99#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const LIB_VERSION='99'",'finalWorkTitle','First Book of Adam and Eve','Eusebius — Ecclesiastical History','⌕ Find in text','Find a word or phrase…'])if(!lib.includes(required))throw new Error('Release99 library integration missing '+required);
for(const forbidden of ['>⌕ Find</button>','id="ancientReaderFindBtn"'])if(lib.includes(forbidden))throw new Error('Release99 old find UI survived: '+forbidden);
for(const required of ['.ancientInlineFind[hidden]','ancientReaderMatchStatus:empty'])if(!css.includes(required))throw new Error('Release99 CSS missing '+required);
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 99: human-readable Ancient titles and clean live Find-in-text UI');