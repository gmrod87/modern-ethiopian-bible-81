const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release104 missing '+f);
let app=fs.readFileSync(p('app.js'),'utf8');
const replaceRange=(start,end,transform,label)=>{
  const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error('Release104 range missing: '+label);
  const before=app.slice(a,b),after=typeof transform==='function'?transform(before):transform;
  app=app.slice(0,a)+after+app.slice(b);
};
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release104 patch missing: '+label);app=app.replace(from,()=>to)};

if(!app.includes("const V='102';"))throw new Error('Release104 expected runtime v102 after Release103');
app=app.replace("const V='102';","const V='104';");

// Never send verse-number prefixes to TTS. Announce book + chapter + the first verse once at chapter start.
const ttsHelpers=String.raw`
function speechVerseText(v){
  let text=clean(v?.t||'');
  const n=String(v?.v??'').trim();
  if(n){
    const escaped=n.replace(/[|\\{}()[\]^$+*?.-]/g,'\\$&');
    const prefix=new RegExp('^\\s*(?:verse\\s+)?'+escaped+'(?:\\s*[.\\-–—:)\\]]\\s*|\\s+)','i');
    text=text.replace(prefix,'');
  }
  return clean(text);
}
function chapterSpeechLead(b,c){
  const first=(Array.isArray(c?.verses)&&c.verses.length)?c.verses[0].v:1;
  const unit=b?.title==='Psalms'?'Psalm':'Chapter';
  return clean((b?.title||'Scripture')+', '+unit+' '+(c?.n||1)+', verse '+first+'.');
}
`;
const buildMarker='function buildVerseItems(verses){';
if(!app.includes(buildMarker))throw new Error('Release104 buildVerseItems marker missing');
app=app.replace(buildMarker,ttsHelpers+buildMarker);
replaceRange('function buildVerseItems(verses){','\nfunction contextIntro(',segment=>{
  if(!segment.includes('const t=clean(v.t);'))throw new Error('Release104 verse TTS text marker missing');
  return segment.replace('const t=clean(v.t);','const t=speechVerseText(v);');
},'verse TTS sanitiser');
replaceRange('async function listenItemsForChapter(b,c){','\nasync function openListenPanelForChapter',segment=>{
  const old="  const items=buildVerseItems(c.verses),intro=contextIntro(b,c);\n  if(intro)items.unshift({text:intro,startVerse:null,endVerse:null,context:true});\n  return items;\n}";
  const next="  const items=buildVerseItems(c.verses),intro=contextIntro(b,c);\n  if(mode==='normal'&&items.length){items[0]={...items[0],text:clean(chapterSpeechLead(b,c)+' '+items[0].text),chapterLead:true};}\n  if(intro)items.unshift({text:intro,startVerse:null,endVerse:null,context:true});\n  return items;\n}";
  if(!segment.includes(old))throw new Error('Release104 Listen queue marker missing');
  return segment.replace(old,next);
},'chapter narration lead');

// Persistent verse highlighting lives separately from the existing saved/note profile so older profiles remain compatible.
const highlightHelpers=String.raw`
const HOBAH_VERSE_HIGHLIGHT_KEY='hobah:verse-highlights:v1';
function verseHighlightMap(){
  try{const x=JSON.parse(localGet(HOBAH_VERSE_HIGHLIGHT_KEY,'{}'));return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return{}}
}
function verseHighlightKey(b,c,v){return String(b?.slug||'book')+':'+String(c?.n||1)+':'+String(v?.v||v||1)}
function isVerseHighlighted(b,c,v){return !!verseHighlightMap()[verseHighlightKey(b,c,v)]}
function paintVerseHighlights(b,c){
  const marks=verseHighlightMap();
  $$('.verse[data-v]').forEach(row=>{
    const n=+row.dataset.v,key=verseHighlightKey(b,c,n),on=!!marks[key];
    row.classList.toggle('highlighted',on);row.dataset.highlighted=on?'true':'false';
    row.setAttribute('role','button');row.setAttribute('tabindex','0');row.setAttribute('aria-label','Verse '+n+'. Tap for save or highlight options.');
  });
}
function toggleVerseHighlight(b,c,v,btn){
  const marks=verseHighlightMap(),key=verseHighlightKey(b,c,v),ref=(b?.title||'Scripture')+' '+(c?.n||1)+':'+v.v;
  const removing=!!marks[key];
  if(removing)delete marks[key];else marks[key]={ref,slug:b.slug,chapter:c.n,verse:v.v,text:v.t,updatedAt:Date.now()};
  localSet(HOBAH_VERSE_HIGHLIGHT_KEY,JSON.stringify(marks));
  const row=$('#v'+v.v);if(row){row.classList.toggle('highlighted',!removing);row.dataset.highlighted=removing?'false':'true'}
  if(btn){btn.textContent=removing?'✦ Highlight':'✦ Highlighted';btn.classList.toggle('active',!removing);btn.setAttribute('aria-pressed',removing?'false':'true')}
  toast(removing?'Highlight removed':'Verse highlighted');
}
document.addEventListener('hobah:chapter',e=>{const b=e.detail?.book,c=e.detail?.chapter;if(b&&c)requestAnimationFrame(()=>paintVerseHighlights(b,c))});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const row=e.target?.closest?.('.verse[data-v]');if(!row||!state.currentBook||!state.currentChapter)return;e.preventDefault();openVerse(state.currentBook,state.currentChapter,+row.dataset.v)});
`;
const openVerseMarker='function openVerse(b,c,vnum){';
if(!app.includes(openVerseMarker))throw new Error('Release104 openVerse marker missing');
app=app.replace(openVerseMarker,highlightHelpers+openVerseMarker);
swap(
  "  const ref=`${b.title} ${c.n}:${v.v}`,p=profile(),saved=p.saved.some(x=>x.type==='verse'&&x.ref===ref);",
  "  const ref=`${b.title} ${c.n}:${v.v}`,p=profile(),saved=p.saved.some(x=>x.type==='verse'&&x.ref===ref),highlighted=isVerseHighlighted(b,c,v);",
  'verse highlight state'
);
swap(
  "<button id=\"copyVerse\">Copy</button><button id=\"shareVerse\">Share</button><button id=\"saveVerse\">${saved?'♥ Saved':'♡ Save'}</button><button id=\"listenVerse\">▶ Listen</button><button id=\"studyVerse\">✦ Explain</button>",
  "<button id=\"saveVerse\">${saved?'♥ Saved':'♡ Save'}</button><button id=\"highlightVerse\" class=\"${highlighted?'active':''}\" aria-pressed=\"${highlighted?'true':'false'}\">${highlighted?'✦ Highlighted':'✦ Highlight'}</button><button id=\"copyVerse\">Copy</button><button id=\"shareVerse\">Share</button><button id=\"listenVerse\">▶ Listen</button><button id=\"studyVerse\">✦ Explain</button>",
  'Save and Highlight actions'
);
swap(
  "  $('#saveVerse',body).onclick=()=>toggleVerseSave(b,c,v,$('#saveVerse',body));",
  "  $('#saveVerse',body).onclick=()=>toggleVerseSave(b,c,v,$('#saveVerse',body));\n  $('#highlightVerse',body).onclick=()=>toggleVerseHighlight(b,c,v,$('#highlightVerse',body));",
  'highlight action handler'
);

fs.writeFileSync(p('app.js'),app);

const styleFile=fs.existsSync(p('styles.css'))?p('styles.css'):(fs.existsSync(p('release66.css'))?p('release66.css'):null);
if(!styleFile)throw new Error('Release104 could not find reader stylesheet');
const css=String.raw`
/* Hobah Release 104 — full-verse tap targets and persistent highlights */
.chapterText .verse{cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;border-radius:10px;transition:background .15s ease,box-shadow .15s ease,transform .08s ease;}
.chapterText .verse:active{transform:scale(.997);}
.chapterText .verse.highlighted{background:rgba(214,177,93,.22);box-shadow:inset 3px 0 0 rgba(151,108,43,.62);}
.chapterText .verse.highlighted .vnum{font-weight:800;}
.verseSheet .sheetActions #saveVerse,.verseSheet .sheetActions #highlightVerse{font-weight:750;}
.verseSheet .sheetActions #highlightVerse.active{background:rgba(214,177,93,.24)!important;border-color:rgba(151,108,43,.46)!important;}
@media(prefers-color-scheme:dark){.chapterText .verse.highlighted{background:rgba(214,177,93,.16);box-shadow:inset 3px 0 0 rgba(214,177,93,.56)}}
`;
fs.appendFileSync(styleFile,'\n'+css+'\n');

let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=102','v=104');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=104#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const V='104';",'speechVerseText','chapterSpeechLead','HOBAH_VERSE_HIGHLIGHT_KEY','highlightVerse','paintVerseHighlights',"mode==='normal'&&items.length"])if(!app.includes(required))throw new Error('Release104 integration missing '+required);
if(!css.includes('.verse.highlighted'))throw new Error('Release104 highlight CSS missing');
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 104: every Scripture verse is a save/highlight tap target; Listen announces book/chapter/first verse once and never narrates verse-number prefixes');
