import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const nativeRoot=path.resolve(here,'..');
const repoRoot=path.resolve(nativeRoot,'..');
const dist=path.join(repoRoot,'dist');
const www=path.join(nativeRoot,'www');
if(!existsSync(path.join(dist,'index.html'))||!existsSync(path.join(dist,'app.js')))throw new Error('Build Hobah first: run npm run build from the repository root.');

await rm(www,{recursive:true,force:true});
await mkdir(www,{recursive:true});
await cp(dist,www,{recursive:true});
await cp(path.join(nativeRoot,'src','native.css'),path.join(www,'native.css'));

// Expand whole-Bible search at build time so iOS never gunzips inside WKWebView.
await mkdir(path.join(www,'search'),{recursive:true});
for(const cat of ['ot','eth','nt']){
  const source=path.join(www,`${cat}.b64`);
  const encoded=(await readFile(source,'utf8')).trim();
  const json=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
  JSON.parse(json);
  await writeFile(path.join(www,'search',`${cat}.json`),json);
  await rm(source,{force:true});
}

let html=await readFile(path.join(www,'index.html'),'utf8');
html=html.replace('<body>','<body class="nativeCapacitor">');
if(!html.includes('/native.css'))html=html.replace('</head>','<link rel="stylesheet" href="/native.css?v=1">\n</head>');
if(!html.includes('id="bottomAbout"'))html=html.replace('</nav>','<button id="bottomAbout"><i>ⓘ</i><span>About</span></button>\n</nav>');
const appTag=html.match(/<script[^>]+src=["']\/app\.js[^"']*["'][^>]*><\/script>/i)?.[0];
if(!appTag)throw new Error('Native prep: app.js script tag not found');
html=html.replace(appTag,`<script src="/native-bridge.js?v=1" defer></script>\n<script src="/native-audio.js?v=1" defer></script>\n${appTag}`);
await writeFile(path.join(www,'index.html'),html);

let app=await readFile(path.join(www,'app.js'),'utf8');
const vm=app.match(/const V='(\d+)';/);
if(!vm)throw new Error('Native prep: runtime version not found');
if(!app.includes('const apiURL='))app=app.replace(vm[0],`${vm[0]}\nconst apiURL=p=>window.HOBAH_API_BASE?window.HOBAH_API_BASE.replace(/\\/$/,'')+p:p;`);
for(const endpoint of ['/api/tts','/api/study-chat','/api/realtime-study'])app=app.replaceAll(`fetch('${endpoint}'`,`fetch(apiURL('${endpoint}')`);

// Native search uses local expanded JSON.
const searchStart='async function loadCorpus(cat){';
const searchEnd='\nasync function renderSearch(q){';
const si=app.indexOf(searchStart),se=app.indexOf(searchEnd,si);
if(si<0||se<0)throw new Error('Native prep: search loader not found');
const nativeSearch=`async function loadCorpus(cat){\n  if(state.corpora[cat])return state.corpora[cat];\n  const r=await fetch('/search/'+cat+'.json',{cache:'force-cache'});\n  if(!r.ok)throw Error('Offline search corpus unavailable');\n  state.corpora[cat]=await r.json();return state.corpora[cat];\n}`;
app=app.slice(0,si)+nativeSearch+app.slice(se);

// Fail online-only features immediately in Airplane Mode.
const studySig="async function askStudy(question,{speak=false,body=null,autoResume=false,quick=false}={}){";
if(!app.includes(studySig))throw new Error('Native prep: Study AI entrypoint not found');
app=app.replace(studySig,studySig+"\n  if(window.HOBAH_NATIVE&&window.HOBAH_NETWORK_CONNECTED===false){toast('Study AI needs an internet connection');return 'Study AI requires an internet connection.';}");
const ttsSig='async function getSpeechBlob(text,mode=null){';
if(!app.includes(ttsSig))throw new Error('Native prep: TTS entrypoint not found');
app=app.replace(ttsSig,ttsSig+"\n  if(window.HOBAH_NATIVE&&window.HOBAH_NETWORK_CONNECTED===false)throw Error('Natural voice needs an internet connection');");
const rtSig='async function ensureStudyRealtime(){';
if(!app.includes(rtSig))throw new Error('Native prep: realtime Study entrypoint not found');
app=app.replace(rtSig,rtSig+"\n  if(window.HOBAH_NATIVE&&window.HOBAH_NETWORK_CONNECTED===false)throw Error('Realtime Study AI needs an internet connection');");

// Use the native AVFoundation player for Scripture. The web HTMLAudio path remains
// in the same functions as a fallback if the native plugin is unavailable.
const playSig='async function playNarrationItem(){';
if(!app.includes(playSig))throw new Error('Native prep: narration player not found');
app=app.replace(playSig,playSig+`\n  if(window.HobahNativeAudio){\n    const item=state.audio.items[state.audio.index];if(!item||state.audio.stopped)return finishNarration();\n    setAudioStatus('Preparing native voice…');setAudioPlay('…');\n    try{\n      await Promise.resolve(window.HobahNativeAudioReady);\n      const mode=localGet('hobah:audioMode','normal'),rate=+(localGet('hobah:audioRate','1'));\n      const title=state.audio.current?state.audio.current.title+' '+state.audio.current.chapter:'Hobah';\n      const subtitle=item.context?'Context':item.startVerse?'Verses '+item.startVerse+(item.endVerse!==item.startVerse?'–'+item.endVerse:''):'Scripture';\n      await window.HobahNativeAudio.play({text:item.text,mode,title,subtitle,rate});\n      state.audio.playing=true;state.audio.paused=false;state.audio.stopped=false;highlightAudioItem(item);setAudioPlay('❚❚');setAudioStatus(subtitle);prefetchNext();\n    }catch(e){console.warn('Native Scripture audio',e);state.audio.playing=false;state.audio.paused=false;setAudioStatus(e.message||'Natural voice unavailable');setAudioPlay('▶')}\n    return;\n  }`);

const prefetchSig='function prefetchNext(){';
if(!app.includes(prefetchSig))throw new Error('Native prep: narration prefetch not found');
app=app.replace(prefetchSig,prefetchSig+`\n  if(window.HobahNativeAudio){\n    const mode=localGet('hobah:audioMode','normal');\n    for(let d=1;d<=2;d++){const n=state.audio.items[state.audio.index+d];if(n)window.HobahNativeAudio.prepare({text:n.text,mode}).catch(()=>{})}\n    return;\n  }`);

const oldPause="function pauseNarration(){const a=ensureScriptureAudio();if(!a.paused)a.pause();setAudioStatus('Paused');setAudioPlay('▶');persistAudio()}";
if(!app.includes(oldPause))throw new Error('Native prep: pauseNarration not found');
app=app.replace(oldPause,`function pauseNarration(){if(window.HobahNativeAudio){window.HobahNativeAudio.pause().catch(()=>{});state.audio.playing=false;state.audio.paused=true;setAudioStatus('Paused');setAudioPlay('▶');persistAudio();return}const a=ensureScriptureAudio();if(!a.paused)a.pause();setAudioStatus('Paused');setAudioPlay('▶');persistAudio()}`);
const oldResume="function resumeNarration(){if(state.audio.studyBusy)return;const a=ensureScriptureAudio();claimVoiceChannel(a);if(a.src)a.play().catch(()=>{});else playNarrationItem()}";
if(!app.includes(oldResume))throw new Error('Native prep: resumeNarration not found');
app=app.replace(oldResume,`function resumeNarration(){if(state.audio.studyBusy)return;if(window.HobahNativeAudio){window.HobahNativeAudio.resume().then(()=>{state.audio.playing=true;state.audio.paused=false;setAudioPlay('❚❚');setAudioStatus('Scripture')}).catch(()=>playNarrationItem());return}const a=ensureScriptureAudio();claimVoiceChannel(a);if(a.src)a.play().catch(()=>{});else playNarrationItem()}`);
app=app.replace('function stopNarration(){\n','function stopNarration(){\n  if(window.HobahNativeAudio)window.HobahNativeAudio.stop().catch(()=>{});\n');
const oldToggle="function toggleNarration(){const a=ensureScriptureAudio();if(a.src&&!a.ended){a.paused?resumeNarration():pauseNarration()}else if(state.currentBook&&state.currentChapter)startNarrationFromChapter(state.currentBook,state.currentChapter)}";
if(!app.includes(oldToggle))throw new Error('Native prep: toggleNarration not found');
app=app.replace(oldToggle,`function toggleNarration(){if(window.HobahNativeAudio){if(state.audio.playing)pauseNarration();else if(state.audio.paused)resumeNarration();else if(state.currentBook&&state.currentChapter)startNarrationFromChapter(state.currentBook,state.currentChapter);return}const a=ensureScriptureAudio();if(a.src&&!a.ended){a.paused?resumeNarration():pauseNarration()}else if(state.currentBook&&state.currentChapter)startNarrationFromChapter(state.currentBook,state.currentChapter)}`);
const oldJump=`function jumpNarration(d){\n  if(state.audio.studyBusy||!state.audio.items.length)return;const a=ensureScriptureAudio();a.pause();state.audio.index=Math.max(0,Math.min(state.audio.items.length-1,state.audio.index+d));playNarrationItem();\n}`;
if(!app.includes(oldJump))throw new Error('Native prep: jumpNarration not found');
app=app.replace(oldJump,`function jumpNarration(d){\n  if(state.audio.studyBusy||!state.audio.items.length)return;\n  if(window.HobahNativeAudio){window.HobahNativeAudio.stop().catch(()=>{});state.audio.index=Math.max(0,Math.min(state.audio.items.length-1,state.audio.index+d));playNarrationItem();return}\n  const a=ensureScriptureAudio();a.pause();state.audio.index=Math.max(0,Math.min(state.audio.items.length-1,state.audio.index+d));playNarrationItem();\n}`);

const oldRate="$('#audioRate').onchange=e=>{localSet('hobah:audioRate',e.target.value);if(state.audio.audio)state.audio.audio.playbackRate=+e.target.value};";
if(!app.includes(oldRate))throw new Error('Native prep: audio rate handler not found');
app=app.replace(oldRate,"$('#audioRate').onchange=e=>{localSet('hobah:audioRate',e.target.value);if(window.HobahNativeAudio)window.HobahNativeAudio.setRate(+e.target.value).catch(()=>{});if(state.audio.audio)state.audio.audio.playbackRate=+e.target.value};");

// Pause native Scripture during Study AI, then resume through the same native path.
const oldManualResume="const a=ensureScriptureAudio(),resume=!!(state.audio.playing&&a&&!a.paused);\n  if(resume){a.pause();state.audio.resumeAfterStudy=true}";
if(!app.includes(oldManualResume))throw new Error('Native prep: Study read-aloud handoff not found');
app=app.replace(oldManualResume,"const a=ensureScriptureAudio(),resume=!!(state.audio.playing&&(window.HobahNativeAudio||(a&&!a.paused)));\n  if(resume){if(window.HobahNativeAudio)await window.HobahNativeAudio.pause().catch(()=>{});else a.pause();state.audio.playing=false;state.audio.paused=true;state.audio.resumeAfterStudy=true}");
const oldExplainPause="const a=ensureScriptureAudio();if(!a.paused)a.pause();claimVoiceChannel(null);state.audio.resumeAfterStudy=true;";
if(!app.includes(oldExplainPause))throw new Error('Native prep: explain-that audio handoff not found');
app=app.replace(oldExplainPause,"const a=ensureScriptureAudio();if(window.HobahNativeAudio){if(state.audio.playing)await window.HobahNativeAudio.pause().catch(()=>{});state.audio.playing=false;state.audio.paused=true}else if(!a.paused)a.pause();claimVoiceChannel(null);state.audio.resumeAfterStudy=true;");

// Native Control Center / lock-screen actions feed the existing Scripture queue.
const nativeEvents=`document.addEventListener('hobah:native-audio-ended',()=>{if(window.HobahNativeAudio&&!state.audio.stopped)advanceNarration()});\ndocument.addEventListener('hobah:native-audio-next',()=>{if(window.HobahNativeAudio)jumpNarration(1)});\ndocument.addEventListener('hobah:native-audio-previous',()=>{if(window.HobahNativeAudio)jumpNarration(-1)});\ndocument.addEventListener('hobah:native-audio-state',e=>{if(!window.HobahNativeAudio)return;const playing=!!e.detail?.playing;state.audio.playing=playing;state.audio.paused=!playing&&!state.audio.stopped;syncAudioUI()});\n\n`;
if(!app.includes('bindAudio();\n'))throw new Error('Native prep: audio binding point not found');
app=app.replace('bindAudio();\n',nativeEvents+'bindAudio();\n');

const oldShare="if(navigator.share)await navigator.share({title:ref,text,url:location.href});else await navigator.clipboard.writeText(text)";
const nativeShare="if(window.HobahNative?.share)await window.HobahNative.share({title:ref,text,url:location.hash});else if(navigator.share)await navigator.share({title:ref,text,url:location.href});else await navigator.clipboard.writeText(text)";
if(app.includes(oldShare))app=app.replace(oldShare,nativeShare);
if(app.includes('bindAudio();\nbootstrap();'))app=app.replace('bindAudio();\nbootstrap();','bindAudio();\nPromise.allSettled([Promise.resolve(window.HobahNativeReady),Promise.resolve(window.HobahNativeAudioReady)]).finally(()=>bootstrap());');
else if(!app.includes('HobahNativeReady'))throw new Error('Native prep: bootstrap handoff not found');
const relativeAPI=[...app.matchAll(/fetch\(['"](\/api\/[^'"]+)/g)].map(m=>m[1]);
if(relativeAPI.length)throw new Error('Native prep left relative API calls: '+relativeAPI.join(', '));
if(app.includes('DecompressionStream'))throw new Error('Native prep left WebView decompression code');
await writeFile(path.join(www,'app.js'),app);

const books=JSON.parse(await readFile(path.join(www,'books.json'),'utf8'));
for(const book of books){if(!existsSync(path.join(www,'data',`${book.slug}.json`)))throw new Error(`Native prep missing offline book: ${book.slug}`)}
console.log(`Hobah native web bundle prepared: ${books.length} books + offline search + AVFoundation Scripture audio`);
