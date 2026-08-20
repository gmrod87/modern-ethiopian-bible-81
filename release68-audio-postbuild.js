const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='68',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js')))throw new Error('Release68: dist/app.js missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{
  if(!app.includes(from))throw new Error(`Release68 patch missing: ${label}`);
  app=app.replace(from,to);
};

// Refresh runtime/cache version so iPhone Safari cannot reuse the previous JS bundle.
swap("const V='66';","const V='68';",'runtime cache version');

// 1) Pre-warm the first spoken chunk as soon as a chapter is on screen.
swap(
  "    emit('hobah:chapter',{book:b,chapter:c});",
  "    emit('hobah:chapter',{book:b,chapter:c});\n    setTimeout(()=>prewarmNarration(b,c),0);",
  'chapter prewarm hook'
);

// 2) Client-side TTS cache: reuse prewarmed blobs and avoid throwing away prefetched audio.
swap(
  'function splitForTTS(text,limit=900){',
`const ttsCache=new Map(),ttsInFlight=new Map();
function ttsKey(text,mode){return \`${mode||'normal'}|${clean(text)}\`}
function rememberTTS(key,blob){
  ttsCache.set(key,blob);
  while(ttsCache.size>14)ttsCache.delete(ttsCache.keys().next().value);
  return blob;
}
function splitForTTS(text,limit=900){`,
  'tts cache helpers'
);

// 3) Make the first Scripture request deliberately short so audio begins much faster.
swap(
`function buildVerseItems(verses){
  const items=[];let text='',start=null,end=null;
  for(const v of verses){
    const t=clean(v.t);if(start===null)start=v.v;
    if((text+' '+t).length>900&&text){items.push({text,startVerse:start,endVerse:end});text=t;start=v.v}else text+=(text?' ':'')+t;
    end=v.v;
  }
  if(text)items.push({text,startVerse:start,endVerse:end});return items;
}`,
`function buildVerseItems(verses){
  const items=[];let text='',start=null,end=null,limit=280;
  for(const v of verses){
    const versePrefix=new RegExp('^'+v.v+'[\\.:)]\\s+');
    const t=clean(v.t).replace(versePrefix,'');
    if(start===null)start=v.v;
    if((text+' '+t).length>limit&&text){items.push({text,startVerse:start,endVerse:end});text=t;start=v.v;limit=700}else text+=(text?' ':'')+t;
    end=v.v;
  }
  if(text)items.push({text,startVerse:start,endVerse:end});return items;
}`,
  'short first narration chunk'
);

// 4) Normal listening no longer waits for all study data to load before speaking.
swap(
`async function startNarrationFromChapter(b,c){
  await loadStudyData().catch(()=>{});
  const items=buildVerseItems(c.verses),intro=contextIntro(b,c);if(intro)items.unshift({text:intro,startVerse:null,endVerse:null,context:true});
  startNarrationItems(b,c,items,0);
}`,
`function prewarmNarration(b,c){
  if(!b||!c||localGet('hobah:audioMode','normal')!=='normal')return;
  const first=buildVerseItems(c.verses)[0];
  if(first)getSpeechBlob(first.text,'normal').catch(()=>{});
}
async function startNarrationFromChapter(b,c){
  const mode=localGet('hobah:audioMode','normal');
  if(mode!=='normal')await loadStudyData().catch(()=>{});
  const items=buildVerseItems(c.verses),intro=contextIntro(b,c);if(intro)items.unshift({text:intro,startVerse:null,endVerse:null,context:true});
  startNarrationItems(b,c,items,0);
}`,
  'instant normal narration'
);

// 5) Reuse in-flight/cached TTS and keep requests small/fast.
swap(
`async function getSpeechBlob(text,mode=null){
  const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:mode||localGet('hobah:audioMode','normal')})});
  if(!r.ok)throw Error('Natural voice unavailable');return r.blob();
}`,
`async function getSpeechBlob(text,mode=null){
  const resolvedMode=mode||localGet('hobah:audioMode','normal'),key=ttsKey(text,resolvedMode);
  if(ttsCache.has(key))return ttsCache.get(key);
  if(ttsInFlight.has(key))return ttsInFlight.get(key);
  const request=fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:resolvedMode})})
    .then(async r=>{if(!r.ok)throw Error('Natural voice unavailable');return rememberTTS(key,await r.blob())})
    .finally(()=>ttsInFlight.delete(key));
  ttsInFlight.set(key,request);return request;
}`,
  'cached speech fetch'
);

swap(
`function prefetchNext(){
  const n=state.audio.items[state.audio.index+1];if(!n)return;
  if('requestIdleCallback'in window)requestIdleCallback(()=>fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:n.text,voice:'marin',mode:localGet('hobah:audioMode','normal')})}).then(()=>{}).catch(()=>{}),{timeout:1000});
}`,
`function prefetchNext(){
  const mode=localGet('hobah:audioMode','normal');
  for(let d=1;d<=2;d++){
    const n=state.audio.items[state.audio.index+d];if(!n)continue;
    getSpeechBlob(n.text,mode).catch(()=>{});
  }
}`,
  'useful narration prefetch'
);

// 6) Stable icon state lets CSS draw a mathematically centered pause symbol.
swap(
  "function setAudioPlay(t){const e=$('#audioPlay');if(e)e.textContent=t}",
  "function setAudioPlay(t){const e=$('#audioPlay');if(!e)return;const s=t==='❚❚'?'pause':t==='…'?'loading':'play';e.dataset.state=s;e.textContent='';e.setAttribute('aria-label',s==='pause'?'Pause':s==='loading'?'Loading audio':'Play')}",
  'centered transport state'
);

// 7) Voice recognition restarts and fires from interim speech much more aggressively.
swap('r.continuous=true;r.interimResults=true;r.lang=\'en-AU\';r.maxAlternatives=3;',"r.continuous=true;r.interimResults=true;r.lang='en-AU';r.maxAlternatives=1;",'voice alternatives');
swap("r.onend=()=>{if(state.listening)setTimeout(()=>{try{r.start()}catch{}},120)};","r.onend=()=>{if(state.listening)setTimeout(()=>{try{r.start()}catch{}},25)};",'voice restart delay');
swap('if(text===lastVoice&&now-lastVoiceAt<1200)return;','if(text===lastVoice&&now-lastVoiceAt<450)return;','voice debounce');
swap("if(hit('explain that','explain this','what does that mean','go deeper')){","if(hit('explain','what does that mean','go deeper')){",'early explain command');

// 8) Voice-triggered explanations use a compact local context for lower first-token latency.
swap(
  'async function explainCurrent(){',
`function quickStudyContext(){
  const b=state.currentBook,c=state.currentChapter;if(!b||!c)return currentContext();
  const v=currentAudioVerse(),idx=Math.max(0,c.verses.findIndex(x=>x.v===v));
  const nearby=c.verses.slice(Math.max(0,idx-1),Math.min(c.verses.length,idx+2));
  const full=currentContext();
  return {...full,currentReference:\`${b.title} ${c.n}:${v}\`,scripture:nearby.map(x=>\`${x.v}. ${x.t}\`).join('\\n'),bookBackground:full.bookBackground.slice(0,1200),sectionContext:full.sectionContext.slice(0,1000),studyNotes:full.studyNotes.slice(0,2)};
}
async function explainCurrent(){`,
  'quick study context'
);
swap("{speak:true,autoResume:true});","{speak:true,autoResume:true,quick:true});",'quick explain option');

// 9) Start speaking Study AI while its answer is still streaming, then resume Scripture immediately after the final spoken chunk.
swap(
  'async function askStudy(question,{speak=false,body=null,autoResume=false}={}){',
`function createStudyStreamNarrator(autoResume=false){
  let buffer='',queue=[],busy=false,finished=false,aborted=false,resolved=false,resolveDone;
  const done=new Promise(r=>resolveDone=r);
  let sa=state.audio.studyAudio;
  if(!sa){sa=document.createElement('audio');sa.hidden=true;sa.className='studyAudio';sa.setAttribute('playsinline','');document.body.appendChild(sa);state.audio.studyAudio=sa}
  const dock=$('.audioDock');if(dock)dock.dataset.studySpeaking='1';
  setAudioStatus('Study AI • answering…');const ref=$('#audioRef');if(ref)ref.textContent='Study AI';
  const settle=()=>{
    if(resolved||aborted||!finished||busy||queue.length||clean(buffer))return;
    resolved=true;if(dock)delete dock.dataset.studySpeaking;
    if(autoResume)resumeScriptureAfterStudy();resolveDone();
  };
  const enqueue=t=>{t=clean(t);if(t){queue.push(t);pump()}};
  const flush=force=>{
    if(!buffer)return;
    if(force){enqueue(buffer);buffer='';return}
    if(buffer.length<90)return;
    let cut=-1;
    for(let i=70;i<buffer.length;i++)if(/[.!?]/.test(buffer[i])&&(i===buffer.length-1||/\\s/.test(buffer[i+1]))){cut=i+1;break}
    if(cut<0&&buffer.length>=160){const at=Math.min(buffer.length,180),sp=buffer.lastIndexOf(' ',at);cut=sp>80?sp:at}
    if(cut>0){enqueue(buffer.slice(0,cut));buffer=buffer.slice(cut)}
  };
  async function pump(){
    if(busy||aborted)return;busy=true;
    while(queue.length&&!aborted){
      const part=queue.shift();let url='';
      try{
        const blob=await getSpeechBlob(part,'normal');if(aborted)break;
        url=URL.createObjectURL(blob);sa.src=url;sa.load();
        await new Promise((resolve,reject)=>{sa.onended=resolve;sa.onerror=reject;sa.play().catch(reject)});
      }catch(e){console.warn('Study narration',e)}finally{if(url)try{URL.revokeObjectURL(url)}catch{}}
    }
    busy=false;settle();
  }
  return{
    push(delta){if(aborted||!delta)return;buffer+=delta;flush(false)},
    async finish(){if(aborted)return;finished=true;flush(true);settle();await done},
    abort(){if(aborted)return;aborted=true;queue=[];buffer='';try{sa.pause()}catch{}if(dock)delete dock.dataset.studySpeaking;if(!resolved){resolved=true;resolveDone()}}
  };
}
async function askStudy(question,{speak=false,body=null,autoResume=false,quick=false}={}){`,
  'streaming study narrator'
);
swap(
  '  const ctx=currentContext(),history=state.studyHistory.slice(-4),mode=state.studyMode;',
  "  const ctx=quick?quickStudyContext():currentContext(),history=quick?[]:state.studyHistory.slice(-4),mode=state.studyMode;",
  'quick ask context'
);
swap(
  "  let answer='',pending=body?$$('.studyMsg.assistant.pending',body).at(-1):null;",
  "  let answer='',pending=body?$$('.studyMsg.assistant.pending',body).at(-1):null;const narrator=speak?createStudyStreamNarrator(autoResume):null;",
  'study narrator initialization'
);
swap(
  "body:JSON.stringify({question,mode,context:ctx,history})",
  "body:JSON.stringify({question,mode,context:ctx,history,quick})",
  'send quick mode'
);
swap(
  "try{const ev=JSON.parse(raw);if(ev.type==='response.output_text.delta'&&ev.delta){answer+=ev.delta;if(pending)pending.querySelector('p').textContent=answer}}catch{}",
  "try{const ev=JSON.parse(raw);if(ev.type==='response.output_text.delta'&&ev.delta){answer+=ev.delta;narrator?.push(ev.delta);if(pending)pending.querySelector('p').textContent=answer}}catch{}",
  'speak streamed study delta'
);
swap(
  '    if(speak)await narrateStudyAnswer(answer,autoResume);',
  '    if(speak){if(narrator)await narrator.finish();else await narrateStudyAnswer(answer,autoResume);}',
  'finish streamed study narration'
);
swap(
  "  }catch(e){\n    console.warn(e);answer=e.message||'Study AI unavailable';",
  "  }catch(e){\n    narrator?.abort();console.warn(e);answer=e.message||'Study AI unavailable';",
  'abort streamed study narration'
);

fs.writeFileSync(p('app.js'),app);
fs.copyFileSync('release68-audio.css',p('release68-audio.css'));
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=66','/styles.css?v=68').replace('/app.js?v=66','/app.js?v=68').replace('/manifest.webmanifest?v=66','/manifest.webmanifest?v=68');
html=html.replace(/\s*<link[^>]+href=["']\/release68-audio\.css(?:\?v=[^"']*)?["'][^>]*>/g,'');
html=html.replace('</head>',`  <link rel="stylesheet" href="/release68-audio.css?v=${V}">\n</head>`);
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=68#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 68: low-latency narration, streaming Study AI speech and responsive voice commands applied');
