const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f),VERSION='115';
for(const f of ['app.js','release94-ancient-library.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release115 missing '+f);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!/const V='114';/.test(app))throw new Error('Release115 expected app runtime v114');

// Ancient Library works use synthetic one-chapter books in the shared narration engine.
// Without this guard, the generic cross-book fallback sees that synthetic slug as index -1
// and advances to state.books[0] — Genesis. Hand Ancient chapter continuation back to
// the Ancient Library instead, which knows the real work and its next fragment/section.
const canonicalAdvance="  const cur=state.audio.current,b=state.map.get(cur.slug),ci=b?.chapters?.findIndex(x=>x.n===cur.chapter)??-1;let nb=b,nc=b?.chapters?.[ci+1];";
if(!app.includes(canonicalAdvance))throw new Error('Release115 narration cross-chapter marker missing');
app=app.replace(canonicalAdvance,"  if(state.ancientContext){emit('hobah:ancient-audio-advance',{...state.ancientContext});return}\n"+canonicalAdvance);

// Give the Ancient Library a safe way to end narration after its final section.
const clearBridge="  clearContext(){state.ancientContext=null;return true},";
if(!app.includes(clearBridge))throw new Error('Release115 Ancient bridge clearContext marker missing');
app=app.replace(clearBridge,clearBridge+"\n  finishListen(){finishNarration();return true},");
app=app.replace("const V='114';","const V='115';");
fs.writeFileSync(p('app.js'),app);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!/const LIB_VERSION='114';/.test(lib))throw new Error('Release115 expected Ancient Library v114');
lib=lib.replace("const LIB_VERSION='114';","const LIB_VERSION='115';");

const end=lib.lastIndexOf('})();');
if(end<0)throw new Error('Release115 Ancient Library IIFE end missing');
const continuation=String.raw`

/* Hobah Release 115 — continue Ancient read aloud within the same work. */
document.addEventListener('hobah:ancient-audio-advance',async e=>{
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
});
`;
lib=lib.slice(0,end)+continuation+'\n'+lib.slice(end);
fs.writeFileSync(p('release94-ancient-library.js'),lib);

let html=fs.readFileSync(p('index.html'),'utf8').replace(/\?v=114\b/g,'?v=115');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){
  const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));
  m.start_url='/?v=115#home';
  fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m));
}

// Regression guards: Ancient narration must branch before canonical book lookup,
// auto-open its next section, and finish cleanly instead of ever falling into Genesis.
const ancientGuard=app.indexOf("if(state.ancientContext){emit('hobah:ancient-audio-advance'");
const canonLookup=app.indexOf('const cur=state.audio.current,b=state.map.get(cur.slug)',ancientGuard);
if(ancientGuard<0||canonLookup<0||ancientGuard>canonLookup)throw new Error('Release115 Ancient narration guard is not before canonical lookup');
for(const required of ["finishListen(){finishNarration();return true}","const V='115';"])if(!app.includes(required))throw new Error('Release115 app integration missing '+required);
for(const required of ["const LIB_VERSION='115';","hobah:ancient-audio-advance","openAncientReader(work.id,nextIndex)","HobahAncientBridge.openListen(nextCtx)"])if(!lib.includes(required))throw new Error('Release115 library integration missing '+required);

execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
console.log('Hobah Release 115: Ancient Library read aloud now advances through the current work and stops at its final section; Genesis fallback removed');
