const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release98 missing '+f);
let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
const swap=(from,to,label)=>{if(!lib.includes(from))throw new Error('Release98 library patch missing: '+label);lib=lib.replace(from,()=>to)};

swap("const LIB_VERSION='97';","const LIB_VERSION='98';",'library cache version');
swap("if(drawer.dataset.booksNavVersion==='97')return;","if(drawer.dataset.booksNavVersion==='98')return;",'drawer version guard');
swap("drawer.dataset.booksNavVersion='97';drawer.dataset.ancientLibrary='1';","drawer.dataset.booksNavVersion='98';drawer.dataset.ancientLibrary='1';drawer.dataset.activeShelf='scripture';",'drawer shelf state');
swap("document.documentElement.dataset.books97Capture==='1'","document.documentElement.dataset.books98Capture==='1'",'capture guard read');
swap("document.documentElement.dataset.books97Capture='1'","document.documentElement.dataset.books98Capture='1'",'capture guard write');

swap(
"    || /^ante[- ]nicene fathers/i.test(t)||/^from eusebius/i.test(t);",
"    || /^ante[- ]nicene fathers/i.test(t)||/^from eusebius/i.test(t)\n    || /^p\\.?\\s*[ivxlcdm0-9]+$/i.test(t)||/^page\\s+\\d+$/i.test(t)\n    || /^r\\.?\\s*h\\.?\\s*p\\.?\\s*jr\\.?$/i.test(t)||/^new york,?\\s+august\\b/i.test(t)\n    || /^by william n\\.?\\s*guthrie/i.test(t)||/^rector of st\\.?\\s*mark/i.test(t);",
'editorial line removal'
);

swap(
"    if(/historical introductions?|\\[ad\\s*\\d+\\]|eusebius|sacred texts?|amazon|rutherford h\\.?\\s*platt|alpha house|public[- ]domain/i.test(lead))lines=lines.slice(firstStructure);",
"    if(/historical introductions?|preface|foreword|introduction to|\\[ad\\s*\\d+\\]|eusebius|sacred texts?|amazon|rutherford h\\.?\\s*platt|william n\\.?\\s*guthrie|alpha house|public[- ]domain|\\b(?:18|19)\\d{2}\\b/i.test(lead))lines=lines.slice(firstStructure);",
'expanded editorial lead removal'
);

const helper=`
function isModernEditorialSection(title,body,part,source=''){
  const t=clean(title),sample=String(body||'').slice(0,3200),all=(t+' '+sample+' '+source).toLowerCase();
  if(/(?:^|\\b)(?:title page|preface|foreword|introduction|historical introduction|editor(?:ial)? note|translator(?:'s)? (?:note|introduction)|biographical notice|prolegomena|contents|index|illustrations)(?:\\b|$)/i.test(t))return true;
  if(/collection profile|manuscript collection profile/i.test(t))return true;
  if(/^(?:anf\\s+)?title page$/i.test(t))return true;
  if(/forgotten books of eden/i.test(all)&&/(rutherford h\\.?\\s*platt|r\\.?\\s*h\\.?\\s*p\\.?\\s*jr|william n\\.?\\s*guthrie|new york,?\\s+august\\s+1,?\\s+1927|alpha house|\\b1926\\b|\\b1927\\b)/i.test(all))return true;
  if(/\\b(?:copyright|publisher|published by|modern editorial|this profile is metadata)\\b/i.test(all)&&!headingRe.test(t))return true;
  return false;
}
function sourceParts(source){
  let raw=String(source||'');try{raw=decodeURIComponent(raw)}catch{}
  raw=(raw.split('/master/').pop()||raw).split('?')[0];
  return raw.split('/').filter(Boolean).map(prettifyFileTitle).filter(Boolean);
}
function genericNumberTitle(title){const m=clean(title).match(/^(Book|Letter|Epistle|Chapter)\\s+([IVXLCDM0-9]+)/i);if(!m)return null;return{type:/epistle/i.test(m[1])?'Letter':m[1][0].toUpperCase()+m[1].slice(1).toLowerCase(),n:romanToNumber(m[2])||m[2]}}
function specificWorkTitle(title,text,part,source=''){
  let known=knownWorkTitle(title,text,part),parts=sourceParts(source),src=parts.join(' '),hay=(src+' '+title+' '+known).toLowerCase();
  if(/athanasius/.test(hay)&&/(festal|letter)\\s*39|from letter 39/.test(hay))return'Athanasius — Festal Letter 39';
  const g=genericNumberTitle(known);if(!g)return known;
  const suffix=g.type+' '+g.n;
  const mapped=[
    [/eusebius.*(?:church|ecclesiastical).*history|(?:church|ecclesiastical).*history.*eusebius/i,'Eusebius — Ecclesiastical History'],
    [/irenaeus.*heres/i,'Irenaeus — Against Heresies'],
    [/clement.*(?:stromata|miscellanies)/i,'Clement of Alexandria — Stromata'],
    [/clement.*(?:instructor|paedagogus)/i,'Clement of Alexandria — The Instructor'],
    [/tertullian.*marcion/i,'Tertullian — Against Marcion'],
    [/origen.*celsus/i,'Origen — Against Celsus'],
    [/origen.*(?:first principles|principles)/i,'Origen — On First Principles'],
    [/hippolytus.*refutation/i,'Hippolytus — Refutation of All Heresies']
  ];
  for(const [re,name]of mapped)if(re.test(hay))return name+', '+suffix;
  if(partKey(part)==='canon'&&/eusebius/i.test(hay)&&g.type==='Book')return'Eusebius — Ecclesiastical History, '+suffix;
  const authors=[[/cyprian/i,'Cyprian of Carthage'],[/dionysius.*alexandria/i,'Dionysius of Alexandria'],[/origen/i,'Origen'],[/tertullian/i,'Tertullian'],[/hippolytus/i,'Hippolytus'],[/clement.*alexandria/i,'Clement of Alexandria'],[/irenaeus/i,'Irenaeus'],[/eusebius/i,'Eusebius']];
  const author=authors.find(([re])=>re.test(hay))?.[1];
  const parents=parts.slice(0,-1).filter(x=>!/^historical christian faith|writings database$/i.test(x));
  const workHint=parents.slice().reverse().find(x=>!author||!x.toLowerCase().includes(author.split(' ')[0].toLowerCase()));
  if(author&&workHint)return author+' — '+workHint+', '+suffix;
  if(author)return author+' — '+suffix;
  if(workHint)return workHint+' — '+suffix;
  return known;
}
`;
const helperAnchor='function sectionChunks(text){';
if(!lib.includes(helperAnchor))throw new Error('Release98 helper anchor missing');
lib=lib.replace(helperAnchor,helper+helperAnchor);

swap(
"    if(body.length<80||looksLikeContents(body,rawTitle)||/^(?:the\\s+)?forgotten books of eden$/i.test(rawTitle)||/^illustrations?$/i.test(rawTitle))continue;\n    const collection=partKey(s.part),title=knownWorkTitle(rawTitle,body,s.part),isFbe=collection==='ancient'&&fbeWorks.some(([name])=>name===title);",
"    if(body.length<80||looksLikeContents(body,rawTitle)||/^(?:the\\s+)?forgotten books of eden$/i.test(rawTitle)||/^illustrations?$/i.test(rawTitle)||isModernEditorialSection(rawTitle,body,s.part,s.source||''))continue;\n    const collection=partKey(s.part),title=specificWorkTitle(rawTitle,body,s.part,s.source||''),isFbe=collection==='ancient'&&fbeWorks.some(([name])=>name===title);",
'primary text filter and specific titles'
);

swap(
"function partLabel(k){return({ancient:'Ancient writings',apostolic:'Apostolic Fathers',early:'Early Church',canon:'Canon history'})[k]||'Ancient Library'}",
"function partLabel(k){return({ancient:'Ancient texts',apostolic:'Apostolic Fathers',early:'Early Christian texts',canon:'Ancient canon witnesses'})[k]||'Ancient Library'}",
'primary collection labels'
);
swap("['ancient','Ancient writings'],['apostolic','Apostolic Fathers'],['early','Early Church'],['canon','Canon history']","['ancient','Ancient texts'],['apostolic','Apostolic Fathers'],['early','Early Christian'],['canon','Canon witnesses']",'filter labels');

swap(
"  state.tab=tab==='ancient'?'ancient':'scripture';\n  const input=$('#booksHubSearchInput');input?.blur();",
"  state.tab=tab==='ancient'?'ancient':'scripture';\n  const drawer=$('#drawer');if(drawer)drawer.dataset.activeShelf=state.tab;\n  const input=$('#booksHubSearchInput');input?.blur();",
'shelf theme switch'
);

fs.writeFileSync(p('release94-ancient-library.js'),lib);

const css=`
/* Hobah Release 98 — shelf-specific classical palette */
.booksHubDrawer[data-active-shelf="scripture"]{background:#f4f0e5!important;}
.booksHubDrawer[data-active-shelf="scripture"] .books96Top{background:#f4f0e5!important;border-bottom-color:rgba(13,87,76,.12)!important;}
.booksHubDrawer[data-active-shelf="scripture"] .books96Header .eyebrow{color:#9b743a!important;}
.booksHubDrawer[data-active-shelf="scripture"] .books96Header h2,.booksHubDrawer[data-active-shelf="scripture"] .books96Close{color:#0d574c!important;}
.booksHubDrawer[data-active-shelf="scripture"] .books96Shelves{background:#e4e8dc!important;}
.booksHubDrawer[data-active-shelf="scripture"] [data-books-tab="scripture"].active{background:#0d574c!important;color:#f8f4ea!important;box-shadow:0 4px 16px rgba(13,87,76,.18)!important;}
.booksHubDrawer[data-active-shelf="scripture"] [data-books-tab="ancient"]{color:#6b5b47!important;}
.booksHubDrawer[data-active-shelf="scripture"] .books96Search{background:#fffdf8!important;border-color:rgba(13,87,76,.18)!important;}
.booksHubDrawer[data-active-shelf="scripture"] .books96Search>span{color:#0d574c!important;}
.booksHubDrawer[data-active-shelf="scripture"] .books96FilterGrid button.active{background:#0d574c!important;border-color:#0d574c!important;color:#fffaf2!important;}
.booksHubDrawer[data-active-shelf="scripture"] .scriptureBookCard{background:#fffdf8!important;border-color:rgba(13,87,76,.10)!important;}
.booksHubDrawer[data-active-shelf="scripture"] .scriptureBookCard .bookNo{background:#e5eadf!important;color:#0d574c!important;}
.booksHubDrawer[data-active-shelf="scripture"] .scriptureBookCard .bookMeta b{color:#123f36!important;}

.booksHubDrawer[data-active-shelf="ancient"]{background:#efe3d1!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books96Top{background:#efe3d1!important;border-bottom-color:rgba(118,78,39,.15)!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books96Header .eyebrow{color:#9b6f32!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books96Header h2,.booksHubDrawer[data-active-shelf="ancient"] .books96Close{color:#6f4a27!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books96Shelves{background:#dfccb0!important;}
.booksHubDrawer[data-active-shelf="ancient"] [data-books-tab="ancient"].active{background:#8a6031!important;color:#fff7e8!important;box-shadow:0 4px 16px rgba(101,66,31,.17)!important;}
.booksHubDrawer[data-active-shelf="ancient"] [data-books-tab="scripture"]{color:#675744!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books96Search{background:#f9f0e2!important;border-color:rgba(118,78,39,.18)!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books96Search>span{color:#93672f!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books97AncientFilters button{background:#f7eddd!important;border-color:rgba(118,78,39,.16)!important;color:#6f563d!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books97AncientFilters button.active{background:#8a6031!important;border-color:#8a6031!important;color:#fff8e9!important;}
.booksHubDrawer[data-active-shelf="ancient"] .ancientWorkCard{background:#fbf3e7!important;border-color:rgba(118,78,39,.13)!important;}
.booksHubDrawer[data-active-shelf="ancient"] .ancientWorkCard .ancientCardTop em{color:#9a6a30!important;}
.booksHubDrawer[data-active-shelf="ancient"] .ancientWorkCard>b{color:#4d3420!important;}
.booksHubDrawer[data-active-shelf="ancient"] .books96Status b{color:#5d4228!important;}
`;
fs.appendFileSync(p('release97-ancient-library.css'),css);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='97';"))throw new Error('Release98 expected app runtime v97');
app=app.replace("const V='97';","const V='98';");fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=97','v=98');fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=98#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ["const LIB_VERSION='98'",'isModernEditorialSection','specificWorkTitle','Eusebius — Ecclesiastical History','drawer.dataset.activeShelf=state.tab'])if(!lib.includes(required))throw new Error('Release98 library integration missing '+required);
for(const required of ['data-active-shelf="scripture"','data-active-shelf="ancient"'])if(!css.includes(required))throw new Error('Release98 CSS missing '+required);
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 98: classical Scripture palette, tan Ancient Library, primary ancient texts only, specific historical work titles');
