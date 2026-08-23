const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release102 missing '+f);
let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
const swap=(from,to,label)=>{if(!lib.includes(from))throw new Error('Release102 library patch missing: '+label);lib=lib.replace(from,()=>to)};

swap("const LIB_VERSION='101';","const LIB_VERSION='102';",'library cache version');

const helpers=String.raw`
function visiblePrimaryText(raw){
  let text=String(raw||'').replace(/\r/g,'');
  const hardCut=[
    /\n\s*(?:FOOTNOTES?|EDITOR(?:'S)? NOTES?|TRANSLATOR(?:'S)? NOTES?|CRITICAL NOTES?|NOTES TO (?:THE )?TEXT)\s*\n/i,
    /\n\s*\d+\s*:\s*(?:This section is preserved|Copt\.|The remainder of|See\s+p\.|Compare\b|Cf\.|Migne\b|Lightfoot\b|Am[eé]lineau\b|This fragment\b|The text is preserved\b|The reading\b)/i
  ];
  let cut=text.length;
  for(const re of hardCut){const m=re.exec(text);if(m&&m.index<cut)cut=m.index}
  text=text.slice(0,cut);
  const lines=text.split('\n');
  const editorialLine=/(?:Am[eé]lineau|Mus[eé]e\s+Guimet|Patrologia|Migne\b|Lightfoot\b|Roberts\s+and\s+Donaldson|Ante[- ]Nicene|see\s+p\.\s*\d+|p\.\s*\d+\s*,?\s*note\s*\d+|manuscript\s+(?:authority|reading)|editor(?:'s)?\s+note|translator(?:'s)?\s+note|modern\s+editor|this\s+section\s+is\s+preserved|the\s+remainder\s+of\s+the\s+.*letter\s+has\s+long\s+been)/i;
  const kept=[];
  for(let line of lines){
    line=line.trim();
    if(!line){kept.push('');continue}
    if(editorialLine.test(line))continue;
    if(/^\s*\[(?:footnote|note|editor|translator)\b/i.test(line))continue;
    if(/^\s*(?:cf\.|compare|see)\s+(?:p\.|vol\.|book\s+\d+)/i.test(line))continue;
    kept.push(line);
  }
  text=kept.join('\n')
    .replace(/\[(?:footnote|note)\s*\d*[^\]]*\]/gi,'')
    .replace(/\((?:see\s+)?p\.\s*\d+(?:\s*,\s*note\s*\d+)?\)/gi,'')
    .replace(/([,.;:!?])\s+(?:[1-9]|1\d|20)\s+(?=[A-Za-z])/g,'$1 ')
    .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return text;
}
function historicalWorkMeta(title,collection=''){
  const t=clean(title),l=t.toLowerCase();
  const meta=(author,date)=>({author,date});
  if(collection==='apostolic'){
    if(/first epistle.*corinth|1\s*clement|clement.*corinth/.test(l))return meta('Clement of Rome','c. AD 96');
    if(/second epistle.*clement|2\s*clement/.test(l))return meta('Anonymous','c. AD 120–140');
    if(/(?:epistle|letter)\s+to\s+the\s+(?:ephesians|magnesians|trallians|romans|philadelphians|smyrnaeans)\b/.test(l)||/(?:epistle|letter)\s+to\s+polycarp\b/.test(l))return meta('Ignatius of Antioch','c. AD 107');
    if(/polycarp.*philipp/.test(l))return meta('Polycarp of Smyrna','c. AD 110–135');
    if(/martyrdom.*polycarp/.test(l))return meta('Church of Smyrna','c. AD 155–160');
    if(/\bdidache\b/.test(l))return meta('Anonymous','c. AD 70–120');
    if(/barnabas/.test(l))return meta('Anonymous','c. AD 70–132');
    if(/shepherd.*hermas|\bhermas\b/.test(l))return meta('Hermas','c. AD 100–160');
    if(/diognet/.test(l))return meta('Anonymous','c. AD 130–200');
    if(/papias/.test(l))return meta('Papias of Hierapolis','c. AD 110–130');
    if(/quadratus/.test(l))return meta('Quadratus of Athens','c. AD 125');
  }
  if(/first book of adam and eve/.test(l))return meta('Anonymous','c. AD 500–900');
  if(/second book of adam and eve/.test(l))return meta('Anonymous','c. AD 500–900');
  if(/secrets? of enoch|\b2\s*enoch\b/.test(l))return meta('Anonymous','c. AD 1–100');
  if(/psalms? of solomon/.test(l))return meta('Anonymous','c. 50 BCE');
  if(/odes? of solomon/.test(l))return meta('Anonymous','c. AD 100–125');
  if(/letter of aristeas/.test(l))return meta('Pseudonymous','c. 150–100 BCE');
  if(/fourth book of maccabees|\b4\s*maccabees\b/.test(l))return meta('Anonymous','c. AD 50–100');
  if(/story of ahikar|\bahikar\b/.test(l))return meta('Anonymous','c. 700–400 BCE');
  if(/testament of (?:reuben|simeon|levi|judah|issachar|zebulun|dan|naphtali|gad|asher|joseph|benjamin)/.test(l))return meta('Anonymous / composite','c. 150 BCE–AD 200');
  if(/muratorian/.test(l))return meta('Anonymous','c. AD 170–200');
  if(/athanasius.*festal.*39/.test(l))return meta('Athanasius of Alexandria','AD 367');
  if(/eusebius.*(?:ecclesiastical|church).*history/.test(l))return meta('Eusebius of Caesarea','c. AD 313–325');
  if(/irenaeus.*heres|against heresies/.test(l))return meta('Irenaeus of Lyons','c. AD 180');
  if(/clement of alexandria.*stromata|\bstromata\b/.test(l))return meta('Clement of Alexandria','c. AD 198–203');
  if(/clement of alexandria.*instructor|\bpaedagogus\b|the instructor/.test(l))return meta('Clement of Alexandria','c. AD 198');
  if(/tertullian.*marcion|against marcion/.test(l))return meta('Tertullian','c. AD 207');
  if(/^tertullian\b/.test(l))return meta('Tertullian','c. AD 197–220');
  if(/origen.*celsus|against celsus/.test(l))return meta('Origen of Alexandria','c. AD 248');
  if(/origen.*(?:first principles|principles)|on first principles/.test(l))return meta('Origen of Alexandria','c. AD 220–230');
  if(/^origen\b/.test(l))return meta('Origen of Alexandria','c. AD 220–250');
  if(/hippolytus.*refutation|refutation of all heresies/.test(l))return meta('Hippolytus of Rome','c. AD 222–235');
  if(/^hippolytus\b/.test(l))return meta('Hippolytus of Rome','c. AD 200–235');
  if(/^cyprian\b|cyprian of carthage/.test(l))return meta('Cyprian of Carthage','c. AD 248–258');
  if(/dionysius.*alexandria/.test(l))return meta('Dionysius of Alexandria','c. AD 250–264');
  if(/first apology|second apology|dialogue with trypho/.test(l))return meta('Justin Martyr','c. AD 155–160');
  if(/address to the greeks/.test(l)&&/tatian/.test(l))return meta('Tatian','c. AD 165');
  if(/athenagoras|plea for the christians/.test(l))return meta('Athenagoras of Athens','c. AD 176–177');
  if(/theophilus.*autolycus|to autolycus/.test(l))return meta('Theophilus of Antioch','c. AD 180');
  if(/minucius felix|\boctavius\b/.test(l))return meta('Minucius Felix','c. AD 200');
  if(/^athanasius\b/.test(l))return meta('Athanasius of Alexandria','c. AD 330–373');
  const pref=[
    ['Clement of Alexandria','c. AD 195–215'],['Irenaeus','c. AD 175–190'],['Eusebius','c. AD 300–325'],['Justin Martyr','c. AD 150–165'],['Tatian','c. AD 160–175']
  ];
  for(const [author,date] of pref)if(l.startsWith(author.toLowerCase()))return meta(author,date);
  return meta('Unknown author','Date uncertain');
}
`;
const helperAnchor='function chapterFingerprint(text){';
if(!lib.includes(helperAnchor))throw new Error('Release102 helper anchor missing');
lib=lib.replace(helperAnchor,helpers+helperAnchor);

swap(
"      work.chapters.push({label:chunk.label||'',text:chunk.text,sourceIndex:s._i,chapterNumber:inferred});",
"      const visible=visiblePrimaryText(chunk.text);if(visible.length<40)continue;work.chapters.push({label:chunk.label||'',text:visible,sourceText:chunk.text,sourceIndex:s._i,chapterNumber:inferred});",
'visible primary text only'
);
swap(
"    work.chapters=unique;\n    work.search=(work.title+' '+work.chapters.map(c=>(c.label+' '+c.text)).join(' ')).toLowerCase();",
"    work.chapters=unique;work.meta=historicalWorkMeta(work.title,work.collection);\n    work.search=(work.title+' '+work.meta.author+' '+work.meta.date+' '+work.chapters.map(c=>(c.label+' '+c.text)).join(' ')).toLowerCase();",
'work metadata'
);
swap(
"<span class=\"ancientCardTop\"><em>${esc(partLabel(w.collection))}</em><i>›</i></span><b>${esc(w.title)}</b><small>${w.chapters.length>1?`${w.chapters.length} chapters / sections`:'Complete text'}</small>",
"<span class=\"ancientCardTop\"><em>${esc(w.meta?.author||'Unknown author')} · ${esc(w.meta?.date||'Date uncertain')}</em><i>›</i></span><b>${esc(w.title)}</b><small>${esc(partLabel(w.collection))} · ${w.chapters.length>1?`${w.chapters.length} chapters / sections`:'Complete text'}</small>",
'author and date on Ancient cards'
);
swap(
"<span class=\"eyebrow\">ANCIENT LIBRARY</span><h1>${esc(work.title)}</h1>${chapter.label?`<p>${esc(chapter.label)}</p>`:''}",
"<span class=\"eyebrow\">ANCIENT LIBRARY</span><h1>${esc(work.title)}</h1><div class=\"ancientWorkMeta\">${esc(work.meta?.author||'Unknown author')} · ${esc(work.meta?.date||'Date uncertain')}</div>${chapter.label?`<p>${esc(chapter.label)}</p>`:''}",
'author and date on reader header'
);
swap(
"  $$('[data-books-tab]',drawer).forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.booksTab)));",
"  const activateShelf=b=>{if(!b)return;setTab(b.dataset.booksTab)};$$('[data-books-tab]',drawer).forEach(b=>{b.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')return;e.preventDefault();e.stopPropagation();activateShelf(b)},{passive:false});b.addEventListener('click',e=>{e.preventDefault();activateShelf(b)})});",
'first-tap shelf activation'
);

fs.writeFileSync(p('release94-ancient-library.js'),lib);

const css=String.raw`
/* Hobah Release 102 — reader breathing room, first-tap tabs, author/date metadata */
.books96Shelves>button{position:relative!important;z-index:3!important;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important;}
.ancientWorkCard .ancientCardTop em{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.25!important;font-size:12px!important;letter-spacing:.035em!important;}
.ancientWorkCard>small{display:block!important;margin-top:8px!important;line-height:1.35!important;}
.ancientWorkMeta{margin:10px auto 4px!important;color:#8f6a3b!important;font:650 14px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:.01em!important;text-align:center!important;}
#ancientReaderText.ancientChapterText{margin-top:28px!important;padding-top:4px!important;}
.ancientReaderTools{margin-bottom:4px!important;}
@media(max-width:520px){#ancientReaderText.ancientChapterText{margin-top:26px!important}.ancientWorkMeta{font-size:13px!important;margin-top:8px!important}.books96Shelves>button{min-height:78px!important}}
@media(prefers-color-scheme:dark){.ancientWorkMeta{color:#d4b77f!important}}
`;
fs.appendFileSync(p('release97-ancient-library.css'),'\n'+css+'\n');

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='101';"))throw new Error('Release102 expected app runtime v101');
app=app.replace("const V='101';","const V='102';");fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=101','v=102');fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=102#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const LIB_VERSION='102'",'visiblePrimaryText','historicalWorkMeta','Ignatius of Antioch','ancientWorkMeta','pointerup'])if(!lib.includes(required))throw new Error('Release102 integration missing '+required);
for(const required of ['#ancientReaderText.ancientChapterText','touch-action:manipulation','.ancientWorkMeta'])if(!css.includes(required))throw new Error('Release102 CSS missing '+required);
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 102: primary-text reader, author/date metadata, first-tap shelf activation and reader spacing');
