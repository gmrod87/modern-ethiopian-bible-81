const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release106 missing '+f);
let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='105';"))throw new Error('Release106 expected Ancient Library v105');
lib=lib.replace("const LIB_VERSION='105';","const LIB_VERSION='106';");

// Rebuild the Ancient reading-unit renderer cleanly. Release 105 used a replacement
// string containing a $ token, which could be expanded by String.replace during build.
const start="function ancientVerseHTML(text,query=''){",end='\nfunction chapterFingerprint(text){';
const a=lib.indexOf(start),b=lib.indexOf(end,a+start.length);
if(a<0||b<0)throw new Error('Release106 ancientVerseHTML range missing');
const fixed=String.raw`function escapeAncientSearchTerm(value){return String(value||'').replace(/[.*+?^$(){}|[\]\\]/g,ch=>'\\'+ch)}
function ancientVerseHTML(text,query=''){
  const q=clean(query),units=ancientVerseUnits(text);
  return units.map(v=>{
    const isHead=v.t.length<150&&headingRe.test(v.t);let safe=esc(v.t);
    if(q){const re=new RegExp('('+escapeAncientSearchTerm(q)+')','gi');safe=safe.replace(re,'<mark>$1</mark>')}
    return '<div class="verse ancientVerse'+(isHead?' ancientVerseHeading':'')+'" id="v'+v.v+'" data-v="'+v.v+'" data-ancient-v="'+v.v+'" role="button" tabindex="0" aria-label="Section '+v.v+'. Tap for save, highlight, copy, listen, explain or add a note."><span class="vnum ancientVerseNum" aria-hidden="true">'+v.v+'</span><span class="ancientVerseBody">'+safe+'</span></div>';
  }).join('');
}`;
lib=lib.slice(0,a)+fixed+lib.slice(b);

// Keep the tappable reading-unit renderer after every Find/clear path.
lib=lib.replaceAll("$('#ancientReaderText').innerHTML=paragraphHTML(chapter.text);","$('#ancientReaderText').innerHTML=ancientVerseHTML(chapter.text);requestAnimationFrame(()=>window.HobahAncientBridge?.syncHighlights?.(ctx));");

// Make the interaction unmistakable in the reader UI.
const articleMarker='<article id="ancientReaderText" class="chapterText ancientChapterText">${ancientVerseHTML(chapter.text)}</article>';
if(!lib.includes(articleMarker))throw new Error('Release106 Ancient article marker missing');
lib=lib.replace(articleMarker,'<div class="ancientTapHint">Tap any numbered passage to Save · Highlight · Listen · Explain · Note</div>'+articleMarker);

// Add a capture-level fallback so a tap still opens the verse sheet even if a local
// listener was replaced by a later reader rerender.
const bootMarker='function boot(){installCaptureNavigation();';
if(!lib.includes(bootMarker))throw new Error('Release106 boot marker missing');
const capture=String.raw`function installAncientVerseCapture(){
  if(document.documentElement.dataset.ancientVerseCapture106==='1')return;
  document.documentElement.dataset.ancientVerseCapture106='1';
  document.addEventListener('click',e=>{
    const row=e.target.closest?.('#ancientReaderText .ancientVerse[data-ancient-v]');if(!row)return;
    if(e.defaultPrevented)return;
    const n=Number(row.dataset.ancientV);if(!n)return;
    const bridge=window.HobahAncientBridge;if(!bridge?.openVerse)return;
    const current=bridge.currentContext?.();
    if(current)bridge.openVerse(current,n);
  },false);
}
`;
// Expose the current bridge context from the reader itself for the fallback above.
const setBridgeOld="function setBridge(ctx){try{window.HobahAncientBridge?.setContext?.(ctx)}catch(e){console.warn('Ancient bridge',e)}}";
const setBridgeNew="let currentAncientReaderContext=null;function setBridge(ctx){currentAncientReaderContext=ctx;try{window.HobahAncientBridge?.setContext?.(ctx);if(window.HobahAncientBridge)window.HobahAncientBridge.currentContext=()=>currentAncientReaderContext}catch(e){console.warn('Ancient bridge',e)}}";
if(!lib.includes(setBridgeOld))throw new Error('Release106 setBridge marker missing');
lib=lib.replace(setBridgeOld,setBridgeNew);
lib=lib.replace(bootMarker,capture+bootMarker+'installAncientVerseCapture();');
fs.writeFileSync(p('release94-ancient-library.js'),lib);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='105';"))throw new Error('Release106 expected app runtime v105');
app=app.replace("const V='105';","const V='106';");
fs.writeFileSync(p('app.js'),app);

const css=String.raw`
/* Hobah Release 106 — make Ancient passage actions obvious and touch-safe */
.ancientTapHint{max-width:780px;margin:18px auto 8px;padding:10px 13px;border:1px solid rgba(151,108,43,.18);border-radius:12px;background:rgba(214,177,93,.10);color:#755633;font:700 12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center;letter-spacing:.01em}
#ancientReaderText .ancientVerse{position:relative!important;pointer-events:auto!important;user-select:text!important;-webkit-user-select:text!important;}
#ancientReaderText .ancientVerseNum{pointer-events:none!important;}
#ancientReaderText .ancientVerseBody{pointer-events:none!important;}
#ancientReaderText .ancientVerse::after{content:'›';position:absolute;right:7px;top:50%;transform:translateY(-50%);font:700 18px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:rgba(117,86,51,.28);}
#ancientReaderText .ancientVerse{padding-right:25px!important;}
@media(max-width:520px){.ancientTapHint{margin-top:14px;font-size:11px;padding:9px 10px}#ancientReaderText .ancientVerse::after{right:3px}}
@media(prefers-color-scheme:dark){.ancientTapHint{color:#d9c291;border-color:rgba(214,177,93,.22);background:rgba(214,177,93,.08)}#ancientReaderText .ancientVerse::after{color:rgba(214,177,93,.28)}}
`;
fs.appendFileSync(p('release97-ancient-library.css'),'\n'+css+'\n');

let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=105','v=106');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=106#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const LIB_VERSION='106'",'escapeAncientSearchTerm','ancientTapHint','data-ancient-v','installAncientVerseCapture','currentContext'])if(!lib.includes(required))throw new Error('Release106 Ancient integration missing '+required);
for(const required of ["const V='106';"])if(!app.includes(required))throw new Error('Release106 app version missing');
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 106: Ancient Library passage taps are live, obvious, cache-busted, and preserved through search/clear rerenders');
