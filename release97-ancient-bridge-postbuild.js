const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release97 bridge: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='90';"))throw new Error('Release97 bridge: expected final Hobah runtime v90');
app=app.replace("const V='90';","const V='97';");

const currentMarker='function currentContext(){';
if(!app.includes(currentMarker))throw new Error('Release97 bridge: currentContext missing');
app=app.replace(currentMarker,`function currentContext(){
  if(state.ancientContext){
    const a=state.ancientContext;
    return{currentReference:a.reference||a.title||'Ancient Library',scripture:String(a.text||'').slice(0,9000),bookBackground:'',sectionContext:a.chapterLabel||'',studyNotes:[]};
  }`);

const quickMarker='function quickStudyContext(){';
if(!app.includes(quickMarker))throw new Error('Release97 bridge: quickStudyContext missing');
app=app.replace(quickMarker,`function quickStudyContext(){
  if(state.ancientContext){
    const a=state.ancientContext,c=state.currentChapter,v=currentAudioVerse(),idx=Math.max(0,(c?.verses||[]).findIndex(x=>x.v===v));
    const nearby=(c?.verses||[]).slice(Math.max(0,idx-1),Math.min((c?.verses||[]).length,idx+2));
    return{currentReference:(a.reference||a.title||'Ancient Library')+(v?' · section '+v:''),scripture:nearby.map(x=>x.t).join('\\n').slice(0,3500),bookBackground:'',sectionContext:a.chapterLabel||'',studyNotes:[]};
  }`);

const chapterMarker='async function renderChapter(slug,cnum,verseJump=null){';
if(!app.includes(chapterMarker))throw new Error('Release97 bridge: Scripture render marker missing');
app=app.replace(chapterMarker,chapterMarker+'\n  state.ancientContext=null;');

const anchor='bindAudio();\nbootstrap();';
if(!app.includes(anchor))throw new Error('Release97 bridge: runtime injection anchor missing');
const bridge=`/* Hobah Release 97 — Ancient Library bridge into the existing Listen / Study AI engine. */
function ancientBridgeVerses(text){
  const paras=String(text||'').replace(/\\r/g,'').split(/\\n\\s*\\n/).map(clean).filter(Boolean),out=[];
  for(const para of paras){
    if(para.length<=620){out.push(para);continue}
    const sentences=para.split(/(?<=[.!?])\\s+/);let cur='';
    for(const sentence of sentences){if((cur+' '+sentence).length>560&&cur){out.push(cur);cur=sentence}else cur+=(cur?' ':'')+sentence}if(cur)out.push(cur);
  }
  return out.filter(Boolean).map((t,i)=>({v:i+1,t}));
}
function setAncientBridgeContext(ctx){
  if(!ctx||!clean(ctx.text))return null;
  const verses=ancientBridgeVerses(ctx.text),book={slug:'ancient-'+String(ctx.id||'work'),title:clean(ctx.title)||'Ancient Library',category:'ancient',chapters:[]};
  const chapter={n:Number(ctx.chapterNumber)||1,label:clean(ctx.chapterLabel)||clean(ctx.title)||'Text',verses};book.chapters=[chapter];
  state.ancientContext={...ctx,text:clean(ctx.text),reference:clean(ctx.reference)||book.title,verses};state.currentBook=book;state.currentChapter=chapter;state.selectedVerse=null;
  return{book,chapter};
}
window.HobahAncientBridge={
  setContext(ctx){setAncientBridgeContext(ctx);return true},
  clearContext(){state.ancientContext=null;return true},
  async openListen(ctx){
    const x=setAncientBridgeContext(ctx);if(!x)return;
    await stopVoiceCommands({silent:true}).catch(()=>{});
    prepareListenQueue(x.book,x.chapter,buildVerseItems(x.chapter.verses),0);
  },
  async openStudy(ctx){
    const x=setAncientBridgeContext(ctx);if(!x)return;
    await openStudy('study');
  }
};
`;
app=app.replace(anchor,bridge+anchor);
fs.writeFileSync(p('app.js'),app);
fs.copyFileSync('release97-ancient-library.css',p('release97-ancient-library.css'));
let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=90','v=97');
if(!html.includes('release97-ancient-library.css'))html=html.replace('</head>','<link rel="stylesheet" href="/release97-ancient-library.css?v=97">\n</head>');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=97#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ["const V='97';",'window.HobahAncientBridge','prepareListenQueue(x.book,x.chapter','await openStudy(\'study\')','if(state.ancientContext)','ancientBridgeVerses'])if(!app.includes(required))throw new Error('Release97 bridge integration missing '+required);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 97: Ancient Library now uses the existing Listen, voice-command and Study AI engine');