const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','release97-ancient-library.css','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release105 missing '+f);
let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
const swap=(from,to,label)=>{if(!lib.includes(from))throw new Error('Release105 library patch missing: '+label);lib=lib.replace(from,()=>to)};

swap("const LIB_VERSION='102';","const LIB_VERSION='105';",'Ancient Library cache version');

const helpers=String.raw`
function normalizeAncientReadingText(raw){
  let text=String(raw||'').replace(/\r/g,'').replace(/\u00ad/g,'').replace(/\u00a0/g,' ');
  try{text=text.normalize('NFKC')}catch{}
  text=text
    .replace(/â€™/g,'’').replace(/â€˜/g,'‘').replace(/â€œ/g,'“').replace(/â€/g,'”').replace(/â€“/g,'–').replace(/â€”/g,'—')
    .replace(/([A-Za-z])-[ \t]*\n(?=[a-z])/g,'$1')
    .replace(/[ \t]+/g,' ')
    .split('\n')
    .map(line=>line.trim())
    .filter(line=>!/^\s*(?:\[?\s*)?\d{1,4}(?:\s*\]?)?\s*$/.test(line))
    .filter(line=>!/^\s*(?:page|p\.)\s*\d{1,4}\s*$/i.test(line))
    .join('\n')
    .replace(/\[(?:footnote|note)\s*\d*[^\]]*\]/gi,'')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/\s+([,.;:!?])/g,'$1')
    .trim();
  return text;
}
function ancientVerseUnits(text){
  const paras=String(text||'').replace(/\r/g,'').split(/\n\s*\n/).map(clean).filter(Boolean),out=[];
  for(const para of paras){
    if(para.length<=620){out.push(para);continue}
    const sentences=para.split(/(?<=[.!?])\s+/);let cur='';
    for(const sentence of sentences){
      if((cur+' '+sentence).length>560&&cur){out.push(cur);cur=sentence}else cur+=(cur?' ':'')+sentence;
    }
    if(cur)out.push(cur);
  }
  return out.filter(Boolean).map((t,i)=>({v:i+1,t}));
}
function ancientVerseHTML(text,query=''){
  const q=clean(query),units=ancientVerseUnits(text);
  return units.map(v=>{
    const isHead=v.t.length<150&&headingRe.test(v.t);let safe=esc(v.t);
    if(q){const re=new RegExp('('+q.replace(/[.*+?^$(){}|[\\]\\\\]/g,'\\\\$&')+')','gi');safe=safe.replace(re,'<mark>$1</mark>')}
    return '<div class="verse ancientVerse'+(isHead?' ancientVerseHeading':'')+'" id="v'+v.v+'" data-v="'+v.v+'" data-ancient-v="'+v.v+'" role="button" tabindex="0" aria-label="Section '+v.v+'. Tap for save, highlight, copy, listen or explain options."><span class="vnum ancientVerseNum" aria-hidden="true">'+v.v+'</span><span class="ancientVerseBody">'+safe+'</span></div>';
  }).join('');
}
`;
const helperAnchor='function chapterFingerprint(text){';
if(!lib.includes(helperAnchor))throw new Error('Release105 helper anchor missing');
lib=lib.replace(helperAnchor,helpers+helperAnchor);

swap(
"      const visible=visiblePrimaryText(chunk.text);if(visible.length<40)continue;work.chapters.push({label:chunk.label||'',text:visible,sourceText:chunk.text,sourceIndex:s._i,chapterNumber:inferred});",
"      const visible=normalizeAncientReadingText(visiblePrimaryText(chunk.text));if(visible.length<40)continue;work.chapters.push({label:chunk.label||'',text:visible,sourceText:chunk.text,sourceIndex:s._i,chapterNumber:inferred});",
'uniform readable Ancient text'
);
swap(
"function bridgeContext(work,chapter,index){return{id:work.id,title:work.title,chapterNumber:index+1,chapterLabel:chapter.label||'',text:chapter.text,reference:`${work.title}${chapter.label?` — ${chapter.label}`:''}`}}",
"function bridgeContext(work,chapter,index){return{id:work.id,title:work.title,chapterNumber:chapter.chapterNumber||index+1,chapterLabel:chapter.label||'',text:chapter.text,reference:`${work.title}${chapter.label?` — ${chapter.label}`:''}`}}",
'actual Ancient chapter references'
);
swap('${paragraphHTML(chapter.text)}','${ancientVerseHTML(chapter.text)}','clickable Ancient reading units');
swap("const ctx=bridgeContext(work,chapter,chapterIndex);setBridge(ctx);","const ctx=bridgeContext(work,chapter,chapterIndex);setBridge(ctx);requestAnimationFrame(()=>window.HobahAncientBridge?.syncHighlights?.(ctx));\n    const openAncientUnit=row=>{const n=Number(row?.dataset?.ancientV);if(!n)return;setBridge(ctx);if(window.HobahAncientBridge?.openVerse)window.HobahAncientBridge.openVerse(ctx,n);else toastLocal('Verse tools are loading — try again')};\n    $('#ancientReaderText')?.addEventListener('click',e=>{const row=e.target.closest?.('.ancientVerse[data-ancient-v]');if(!row)return;const sel=window.getSelection?.();if(sel&&!sel.isCollapsed&&clean(sel.toString()))return;openAncientUnit(row)});\n    $('#ancientReaderText')?.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const row=e.target.closest?.('.ancientVerse[data-ancient-v]');if(!row)return;e.preventDefault();openAncientUnit(row)});",'Ancient verse action binding');
swap("$('#ancientReaderText').innerHTML=paragraphHTML(chapter.text);","$('#ancientReaderText').innerHTML=ancientVerseHTML(chapter.text);requestAnimationFrame(()=>window.HobahAncientBridge?.syncHighlights?.(ctx));",'clear search keeps verse actions');
swap("box.innerHTML=paragraphHTML(text,q);","box.innerHTML=ancientVerseHTML(text,q);requestAnimationFrame(()=>window.HobahAncientBridge?.syncHighlights?.());",'search keeps verse actions');

fs.writeFileSync(p('release94-ancient-library.js'),lib);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='104';"))throw new Error('Release105 expected runtime v104 after Release104');
app=app.replace("const V='104';","const V='105';");
const runtimeAnchor='bindAudio();\nbootstrap();';
if(!app.includes(runtimeAnchor))throw new Error('Release105 runtime anchor missing');
const bridgeExtension=String.raw`/* Hobah Release 105 — Ancient Library verse sheet parity with Scripture. */
function syncAncientBridgeHighlights(ctx){
  let book=state.currentBook,chapter=state.currentChapter;
  if(ctx){const x=setAncientBridgeContext(ctx);if(!x)return;book=x.book;chapter=x.chapter}
  if(!book||!chapter||book.category!=='ancient')return;
  document.querySelectorAll('#ancientReaderText .verse[data-v]').forEach(row=>{
    const n=Number(row.dataset.v),v=chapter.verses.find(x=>Number(x.v)===n),on=!!v&&isVerseHighlighted(book,chapter,v);
    row.classList.toggle('highlighted',on);row.dataset.highlighted=on?'true':'false';
  });
}
if(window.HobahAncientBridge){
  window.HobahAncientBridge.openVerse=function(ctx,vnum){
    const x=setAncientBridgeContext(ctx);if(!x)return false;
    const n=Math.max(1,Number(vnum)||1);openVerse(x.book,x.chapter,n);return true;
  };
  window.HobahAncientBridge.syncHighlights=function(ctx){syncAncientBridgeHighlights(ctx);return true};
}
`;
app=app.replace(runtimeAnchor,bridgeExtension+runtimeAnchor);
fs.writeFileSync(p('app.js'),app);

const css=String.raw`
/* Hobah Release 105 — Ancient Library verse parity and legibility */
#ancientReaderText.ancientChapterText{display:flex!important;flex-direction:column!important;gap:3px!important;max-width:780px!important;margin-left:auto!important;margin-right:auto!important;}
#ancientReaderText .ancientVerse{display:grid!important;grid-template-columns:34px minmax(0,1fr)!important;gap:12px!important;align-items:start!important;padding:11px 10px!important;margin:0!important;border-radius:12px!important;cursor:pointer!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important;font-family:Georgia,"Times New Roman",serif!important;font-size:clamp(18px,2.2vw,22px)!important;line-height:1.68!important;letter-spacing:.002em!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;}
#ancientReaderText .ancientVerse+.ancientVerse{border-top:1px solid rgba(24,61,50,.075)!important;}
#ancientReaderText .ancientVerseNum{position:static!important;width:auto!important;min-width:0!important;padding-top:.22em!important;text-align:right!important;font:700 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;color:#9b7442!important;opacity:.9!important;user-select:none!important;}
#ancientReaderText .ancientVerseBody{display:block!important;min-width:0!important;}
#ancientReaderText .ancientVerseHeading .ancientVerseBody{font-weight:750!important;font-size:1.02em!important;letter-spacing:.01em!important;}
#ancientReaderText .ancientVerse:focus-visible{outline:2px solid rgba(151,108,43,.55)!important;outline-offset:2px!important;}
#ancientReaderText .ancientVerse:active{transform:scale(.997)!important;}
#ancientReaderText .ancientVerse.highlighted{background:rgba(214,177,93,.20)!important;box-shadow:inset 3px 0 0 rgba(151,108,43,.60)!important;}
#ancientReaderText mark{border-radius:4px!important;padding:0 .06em!important;}
@media(max-width:520px){#ancientReaderText.ancientChapterText{gap:1px!important}#ancientReaderText .ancientVerse{grid-template-columns:27px minmax(0,1fr)!important;gap:9px!important;padding:10px 5px!important;font-size:19px!important;line-height:1.62!important}#ancientReaderText .ancientVerseNum{font-size:11px!important}}
@media(prefers-color-scheme:dark){#ancientReaderText .ancientVerse+.ancientVerse{border-top-color:rgba(255,255,255,.07)!important}#ancientReaderText .ancientVerseNum{color:#d4b77f!important}#ancientReaderText .ancientVerse.highlighted{background:rgba(214,177,93,.14)!important;box-shadow:inset 3px 0 0 rgba(214,177,93,.52)!important}}
`;
fs.appendFileSync(p('release97-ancient-library.css'),'\n'+css+'\n');

let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=104','v=105').replaceAll('v=102','v=105');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=105#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const LIB_VERSION='105'",'normalizeAncientReadingText','ancientVerseUnits','ancientVerseHTML','data-ancient-v','syncHighlights'])if(!lib.includes(required))throw new Error('Release105 Ancient Library integration missing '+required);
for(const required of ["const V='105';",'syncAncientBridgeHighlights','HobahAncientBridge.openVerse','isVerseHighlighted'])if(!app.includes(required))throw new Error('Release105 app integration missing '+required);
for(const required of ['#ancientReaderText .ancientVerse','.ancientVerseNum','.ancientVerse.highlighted'])if(!css.includes(required))throw new Error('Release105 CSS missing '+required);
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 105: Ancient Library text is normalized and every reading unit opens the same Save / Highlight / Copy / Share / Listen / Explain / note sheet as Scripture');
