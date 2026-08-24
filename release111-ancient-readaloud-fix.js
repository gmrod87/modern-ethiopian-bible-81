const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','ancient-works','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release111 missing '+f);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='110';"))throw new Error('Release111 expected app runtime v110');
if(!app.includes('function ancientBridgeVerses(text){'))throw new Error('Release111 Ancient audio bridge missing');
if(!app.includes('async openListen(ctx){'))throw new Error('Release111 Ancient Listen bridge missing');

const bridgeStart='function ancientBridgeVerses(text){';
const bridgeEnd='\nfunction setAncientBridgeContext(ctx){';
const a=app.indexOf(bridgeStart),b=app.indexOf(bridgeEnd,a+bridgeStart.length);
if(a<0||b<0)throw new Error('Release111 could not replace Ancient audio splitter');
const robustSplitter=String.raw`function ancientBridgeVerses(text){
  const source=String(text||'').replace(/\r/g,'').replace(/\u00ad/g,'').replace(/\u00a0/g,' ')
    .replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const out=[],LIMIT=430;
  const pushHard=raw=>{
    let s=clean(raw);if(!s)return;
    while(s.length>LIMIT){
      let cut=s.lastIndexOf(' ',LIMIT);
      if(cut<Math.floor(LIMIT*.58))cut=LIMIT;
      const part=clean(s.slice(0,cut));if(part)out.push(part);
      s=clean(s.slice(cut));
    }
    if(s)out.push(s);
  };
  const blocks=source.split(/\n\s*\n|\n+/).map(clean).filter(Boolean);
  for(const block of blocks){
    if(block.length<=LIMIT){out.push(block);continue}
    const sentences=block.split(/(?<=[.!?;:])\s+/).map(clean).filter(Boolean);let cur='';
    for(const sentence of sentences){
      if(sentence.length>LIMIT){if(cur){out.push(cur);cur=''}pushHard(sentence);continue}
      if((cur+' '+sentence).trim().length>LIMIT&&cur){out.push(cur);cur=sentence}else cur+=(cur?' ':'')+sentence;
    }
    if(cur)out.push(cur);
  }
  return out.filter(Boolean).map((t,i)=>({v:i+1,t}));
}`;
app=app.slice(0,a)+robustSplitter+app.slice(b);

const listenOld=String.raw`  async openListen(ctx){
    const x=setAncientBridgeContext(ctx);if(!x)return;
    await stopVoiceCommands({silent:true}).catch(()=>{});
    prepareListenQueue(x.book,x.chapter,buildVerseItems(x.chapter.verses),0);
  },`;
const listenNew=String.raw`  async openListen(ctx){
    const x=setAncientBridgeContext(ctx);if(!x||!x.chapter?.verses?.length){
      toast('This Ancient text has no readable audio content');return false;
    }
    await stopVoiceCommands({silent:true}).catch(()=>{});
    const items=buildVerseItems(x.chapter.verses).filter(i=>clean(i?.text));
    if(!items.length){toast('This Ancient text has no readable audio content');return false}
    prepareListenQueue(x.book,x.chapter,items,0);
    setAudioStatus('Ancient Library • starting…');
    try{await playNarrationItem();return true}
    catch(e){console.warn('Ancient read aloud',e);setAudioPlay('▶');setAudioStatus('Read aloud ready • tap play to retry');toast(e?.message||'Read aloud could not start');return false}
  },`;
if(!app.includes(listenOld))throw new Error('Release111 expected original Ancient openListen block');
app=app.replace(listenOld,listenNew);

// When an Ancient passage action sheet uses Listen, start it immediately as well.
const verseListenOld="async function openListenPanelForVerse(b,c,v){\n  await stopVoiceCommands({silent:true}).catch(()=>{});\n  prepareListenQueue(b,c,buildVerseItems([v]),0);\n}";
const verseListenNew="async function openListenPanelForVerse(b,c,v){\n  await stopVoiceCommands({silent:true}).catch(()=>{});\n  prepareListenQueue(b,c,buildVerseItems([v]),0);\n  if(b?.category==='ancient'){try{await playNarrationItem()}catch(e){console.warn('Ancient passage read aloud',e);setAudioStatus('Read aloud ready • tap play to retry')}}\n}";
if(!app.includes(verseListenOld))throw new Error('Release111 verse Listen function missing');
app=app.replace(verseListenOld,verseListenNew);

app=app.replace("const V='110';","const V='111';");
fs.writeFileSync(p('app.js'),app);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='110';"))throw new Error('Release111 expected Ancient Library v110');
lib=lib.replace("const LIB_VERSION='110';","const LIB_VERSION='111';");
lib=lib.replace('<button id="ancientListen" class="toolStrong" type="button">▶ Listen</button>','<button id="ancientListen" class="toolStrong" type="button">▶ Read aloud</button>');
fs.writeFileSync(p('release94-ancient-library.js'),lib);

const css=String.raw`
/* Hobah Release 111 — Ancient read aloud is a clear primary action */
#ancientListen{touch-action:manipulation!important;white-space:nowrap!important;}
#ancientListen:active{transform:scale(.985)!important;}
`;
fs.appendFileSync(p('release97-ancient-library.css'),'\n'+css+'\n');

let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=110','v=111');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=111#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

// Corpus-wide audio smoke test: every Ancient chapter must yield bounded, non-empty speech chunks.
function chunks(text){
  const source=String(text||'').replace(/\r/g,'').replace(/\u00ad/g,'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const out=[],LIMIT=430,cleanNode=v=>String(v||'').replace(/\s+/g,' ').trim();
  const pushHard=raw=>{let s=cleanNode(raw);while(s.length>LIMIT){let cut=s.lastIndexOf(' ',LIMIT);if(cut<Math.floor(LIMIT*.58))cut=LIMIT;const part=cleanNode(s.slice(0,cut));if(part)out.push(part);s=cleanNode(s.slice(cut))}if(s)out.push(s)};
  for(const block of source.split(/\n\s*\n|\n+/).map(cleanNode).filter(Boolean)){
    if(block.length<=LIMIT){out.push(block);continue}
    const sentences=block.split(/(?<=[.!?;:])\s+/).map(cleanNode).filter(Boolean);let cur='';
    for(const sentence of sentences){if(sentence.length>LIMIT){if(cur){out.push(cur);cur=''}pushHard(sentence);continue}if((cur+' '+sentence).trim().length>LIMIT&&cur){out.push(cur);cur=sentence}else cur+=(cur?' ':'')+sentence}if(cur)out.push(cur)
  }
  return out.filter(Boolean);
}
const files=fs.readdirSync(p('ancient-works')).filter(f=>f.endsWith('.json'));
if(files.length<178)throw new Error(`Release111 expected at least 178 Ancient works, found ${files.length}`);
let chapters=0,maxChunk=0,empty=0;
for(const f of files){const w=JSON.parse(fs.readFileSync(path.join(p('ancient-works'),f),'utf8'));for(const c of w.chapters||[]){chapters++;const cs=chunks(c.text);if(!cs.length)empty++;for(const x of cs){maxChunk=Math.max(maxChunk,x.length);if(x.length>430)throw new Error(`Release111 oversized audio chunk ${x.length} in ${w.title}`)}}}
if(!chapters||empty)throw new Error(`Release111 audio smoke test failed: chapters=${chapters}, empty=${empty}`);

for(const required of ["const V='111';",'LIMIT=430','Ancient Library • starting…',"b?.category==='ancient'"])if(!app.includes(required))throw new Error('Release111 runtime integration missing '+required);
for(const required of ["const LIB_VERSION='111';",'▶ Read aloud'])if(!lib.includes(required))throw new Error('Release111 library integration missing '+required);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
console.log(`Hobah Release 111: Ancient read aloud starts on one tap; ${files.length} works / ${chapters} chapters audio-audited; max speech chunk ${maxChunk} chars`);
