const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f),VERSION='118';
for(const f of ['app.js','release94-ancient-library.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release118 missing '+f);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='117';"))throw new Error('Release118 expected app runtime v117');
if(!app.includes("if(state.ancientContext){emit('hobah:ancient-audio-advance'"))throw new Error('Release118 missing Ancient narration handoff');
app=app.replace("const V='117';","const V='118';");
fs.writeFileSync(p('app.js'),app);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='117';"))throw new Error('Release118 expected Ancient Library v117');

const oldContinuation=String.raw`document.addEventListener('hobah:ancient-audio-advance',async e=>{
  try{
    const ctx=e.detail||{},workId=String(ctx.id||'');
    const currentNumber=Math.max(1,Number(ctx.chapterNumber)||1);
    const m=await loadManifest();buildCatalog(m);
    const work=findWork(workId);
    if(!work){window.HobahAncientBridge?.finishListen?.();return}
    // chapterNumber is 1-based, so its numeric value is exactly the next zero-based index.
    const nextIndex=currentNumber;
    if(nextIndex>=work.chapters.length){window.HobahAncientBridge?.finishListen?.();return}
    await openAncientReader(work.id,nextIndex);
    const chapter=work.chapters[nextIndex],nextCtx=bridgeContext(work,chapter,nextIndex);
    setBridge(nextCtx);
    if(window.HobahAncientBridge?.openListen)await window.HobahAncientBridge.openListen(nextCtx);
    else window.HobahAncientBridge?.finishListen?.();
  }catch(err){
    console.warn('Ancient read aloud continuation',err);
    window.HobahAncientBridge?.finishListen?.();
  }
});`;

const newContinuation=String.raw`document.addEventListener('hobah:ancient-audio-advance',async e=>{
  if(window.__hobahAncientAudioAdvance118)return;
  window.__hobahAncientAudioAdvance118=true;
  try{
    const ctx=e.detail||{},workId=String(ctx.id||'');
    if(!workId){window.HobahAncientBridge?.finishListen?.();return}

    // Ancient works have been split into direct /ancient-works/*.json files since Release 108.
    // Use the same loader as the reader itself so continuation works for every shelf item,
    // including newer standalone works such as the Book of Giants that are not in the legacy manifest catalog.
    const work=await loadAncientWork(workId);
    if(!work||!Array.isArray(work.chapters)||!work.chapters.length){window.HobahAncientBridge?.finishListen?.();return}

    const currentIndex=Math.max(0,Math.min(work.chapters.length-1,(Number(ctx.chapterNumber)||1)-1));
    const nextIndex=currentIndex+1;
    if(nextIndex>=work.chapters.length){window.HobahAncientBridge?.finishListen?.();return}

    setAudioStatus?.('Ancient Library • continuing…');
    await openAncientReader(work.id,nextIndex);
    const chapter=work.chapters[nextIndex],nextCtx=bridgeContext(work,chapter,nextIndex);
    setBridge(nextCtx);
    if(window.HobahAncientBridge?.openListen)await window.HobahAncientBridge.openListen(nextCtx);
    else window.HobahAncientBridge?.finishListen?.();
  }catch(err){
    console.warn('Ancient read aloud continuation',err);
    window.HobahAncientBridge?.finishListen?.();
  }finally{
    window.__hobahAncientAudioAdvance118=false;
  }
});`;

if(!lib.includes(oldContinuation))throw new Error('Release118 Ancient continuation target missing');
lib=lib.replace(oldContinuation,newContinuation).replace("const LIB_VERSION='117';","const LIB_VERSION='118';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

let html=fs.readFileSync(p('index.html'),'utf8').replace(/\?v=117\b/g,'?v=118');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){
  const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));
  m.start_url='/?v=118#home';
  fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m));
}

for(const required of ["const V='118';","hobah:ancient-audio-advance"])if(!app.includes(required))throw new Error('Release118 app integration missing '+required);
for(const required of ["const LIB_VERSION='118';",'await loadAncientWork(workId)','__hobahAncientAudioAdvance118','const nextIndex=currentIndex+1','openAncientReader(work.id,nextIndex)','HobahAncientBridge.openListen(nextCtx)'])if(!lib.includes(required))throw new Error('Release118 Ancient integration missing '+required);
if(lib.includes('const m=await loadManifest();buildCatalog(m);\n    const work=findWork(workId);'))throw new Error('Release118 legacy Ancient audio lookup survived');

execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
console.log('Hobah Release 118: Ancient Library read aloud now advances continuously through direct-loaded work chapters, including Book of Giants');
