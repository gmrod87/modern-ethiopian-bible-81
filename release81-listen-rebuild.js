const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='81',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release81: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release81 patch missing: '+label);app=app.replace(from,()=>to)};
const replaceRange=(start,end,replacement,label)=>{
  const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error('Release81 range missing: '+label);
  app=app.slice(0,a)+replacement+app.slice(b);
};

swap("const V='79';","const V='81';",'runtime version');

// LISTEN V2: opening Listen must only open/prepare the controls. It must never auto-play.
swap(
  "    $('#listenChapter').onclick=()=>startNarrationFromChapter(b,c);",
  "    $('#listenChapter').onclick=()=>openListenPanelForChapter(b,c);",
  'chapter Listen opens controls only'
);
swap(
  "  $('#listenVerse',body).onclick=()=>{closeSheet();startNarrationItems(b,c,buildVerseItems([v]),0)};",
  "  $('#listenVerse',body).onclick=()=>{closeSheet();openListenPanelForVerse(b,c,v)};",
  'verse Listen opens controls only'
);

replaceRange(
  'async function startNarrationFromChapter(b,c){',
  '\nfunction ensureScriptureAudio(){',
`const HOBAH_LISTEN_V2=true;
function resetListenPlaybackForQueue(){
  const a=state.audio.audio;
  if(a){try{a.pause();a.removeAttribute('src');a.load()}catch{}}
  if(window.HobahNativeAudio)window.HobahNativeAudio.stop().catch(()=>{});
  if(state.audio.objectUrl)try{URL.revokeObjectURL(state.audio.objectUrl)}catch{}
  state.audio.objectUrl=null;state.audio.playing=false;state.audio.paused=false;
  $$('.verse.speaking').forEach(x=>x.classList.remove('speaking'));
}
function prepareListenQueue(b,c,items,index=0){
  resetListenPlaybackForQueue();
  state.audio.current={slug:b.slug,title:b.title,chapter:c.n};
  state.audio.items=Array.isArray(items)?items:[];
  state.audio.index=Math.max(0,Math.min(index,Math.max(0,state.audio.items.length-1)));
  state.audio.stopped=false;
  state.audio.resumeAfterStudy=false;
  state.audio.voiceWasListening=false;
  state.audio.suppressRecognition=false;
  showAudioBar();setAudioPlay('▶');
  setAudioStatus('Ready • press play or turn on Voice Commands');
  const first=state.audio.items[state.audio.index];
  if(first){
    if(window.HobahNativeAudio)window.HobahNativeAudio.prepare({text:first.text,mode:localGet('hobah:audioMode','normal')}).catch(()=>{});
    else getSpeechBlob(first.text,localGet('hobah:audioMode','normal')).catch(()=>{});
  }
}
async function listenItemsForChapter(b,c){
  const mode=localGet('hobah:audioMode','normal');
  if(mode!=='normal')await loadStudyData().catch(()=>{});
  const items=buildVerseItems(c.verses),intro=contextIntro(b,c);
  if(intro)items.unshift({text:intro,startVerse:null,endVerse:null,context:true});
  return items;
}
async function openListenPanelForChapter(b,c){
  await stopVoiceCommands({silent:true}).catch(()=>{});
  const items=await listenItemsForChapter(b,c);
  prepareListenQueue(b,c,items,0);
}
async function openListenPanelForVerse(b,c,v){
  await stopVoiceCommands({silent:true}).catch(()=>{});
  prepareListenQueue(b,c,buildVerseItems([v]),0);
}
async function startNarrationFromChapter(b,c){
  const items=await listenItemsForChapter(b,c);
  prepareListenQueue(b,c,items,0);
  await playNarrationItem();
}`,
  'separate Listen open/prepare/play lifecycle'
);

// Voice Commands have their own desired/actual state. Never use playback state as microphone state.
replaceRange(
  'function syncAudioUI(){',
  '\nfunction syncAudioSettings(){',
`function syncAudioUI(){
  setAudioPlay(state.audio.playing?'❚❚':'▶');
  const voice=$('#audioVoiceToggle');if(voice){
    const active=!!(state.audio.voiceWanted||state.listening);
    voice.classList.toggle('active',active);voice.setAttribute('aria-pressed',active?'true':'false');
  }
}`,
  'Listen UI state separation'
);

replaceRange(
  'function toggleVoiceCommands(){',
  '\nlet lastVoice=',
`function toggleVoiceCommands(){state.audio.voiceWanted?stopVoiceCommands():startVoiceCommands()}
let listenVoiceGeneration=0,listenVoiceRestartTimer=0;
function voiceReadyStatus(){return 'Listening • say explain that, save that, stop, or play'}
async function confirmNativeVoiceStarted(generation){
  for(let i=0;i<8;i++){
    if(generation!==listenVoiceGeneration||!state.audio.voiceWanted||state.audio.suppressRecognition)return false;
    const s=await window.HobahNativeVoice.getState().catch(()=>null);
    if(s?.listening){state.listening=true;syncAudioUI();setAudioStatus(voiceReadyStatus());return true}
    await sleep(90);
  }
  return false;
}
async function startNativeListenSession({requestPermission=false,generation=listenVoiceGeneration}={}){
  if(!window.HobahNativeVoice||generation!==listenVoiceGeneration||!state.audio.voiceWanted||state.audio.suppressRecognition)return false;
  await Promise.resolve(window.HobahNativeVoiceReady);
  if(requestPermission){
    const permissions=await window.HobahNativeVoice.requestPermissions();
    if(permissions?.speech==='denied'||permissions?.microphone==='denied')throw Error('Microphone and Speech Recognition permission are required for Voice Commands');
  }
  const existing=await window.HobahNativeVoice.getState().catch(()=>({listening:false,available:true}));
  if(existing?.available===false)throw Error('Speech recognition is temporarily unavailable');
  if(!existing?.listening)await window.HobahNativeVoice.start({locale:'en-AU',continuous:true});
  if(await confirmNativeVoiceStarted(generation))return true;
  throw Error('Voice Commands could not activate the microphone');
}
function scheduleListenVoiceRestart(){
  clearTimeout(listenVoiceRestartTimer);
  const generation=listenVoiceGeneration;
  listenVoiceRestartTimer=setTimeout(async()=>{
    if(generation!==listenVoiceGeneration||!state.audio.voiceWanted||state.audio.suppressRecognition)return;
    try{
      const s=await window.HobahNativeVoice?.getState?.().catch(()=>null);
      if(s?.listening){state.listening=true;syncAudioUI();setAudioStatus(voiceReadyStatus());return}
      await startNativeListenSession({requestPermission:false,generation});
    }catch(e){console.warn('Listen voice restart',e);if(generation===listenVoiceGeneration&&state.audio.voiceWanted){state.listening=false;syncAudioUI();setAudioStatus('Voice Commands • tap off and on to retry')}}
  },320);
}
async function startVoiceCommands(){
  if(state.audio.voiceWanted)return;
  const generation=++listenVoiceGeneration;state.audio.voiceWanted=true;state.listening=false;
  clearTimeout(listenVoiceRestartTimer);syncAudioUI();setAudioStatus('Voice Commands • starting microphone…');
  if(window.HobahNativeVoice){
    try{await startNativeListenSession({requestPermission:true,generation});ensureStudyRealtime().catch(()=>{})}
    catch(e){
      console.warn('Voice Commands start',e);
      if(generation!==listenVoiceGeneration)return;
      state.audio.voiceWanted=false;state.listening=false;syncAudioUI();setAudioStatus('Voice Commands off');toast(e?.message||'Voice Commands could not start');
    }
    return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){state.audio.voiceWanted=false;syncAudioUI();toast('Voice commands are not supported by this browser');return}
  if(!state.recognition){
    const r=new SR();r.continuous=true;r.interimResults=true;r.lang='en-AU';r.maxAlternatives=1;
    r.onstart=()=>{if(state.audio.voiceWanted){state.listening=true;syncAudioUI();setAudioStatus(voiceReadyStatus())}};
    r.onresult=e=>{if(state.audio.suppressRecognition)return;for(let i=e.resultIndex;i<e.results.length;i++){const text=clean(e.results[i][0]?.transcript).toLowerCase();if(text)handleVoice(text,e.results[i].isFinal)}};
    r.onend=()=>{state.listening=false;syncAudioUI();if(state.audio.voiceWanted&&!state.audio.suppressRecognition)setTimeout(()=>{try{r.start()}catch{}},120)};
    r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){state.audio.voiceWanted=false;state.listening=false;syncAudioUI();setAudioStatus('Microphone permission needed')}};
    state.recognition=r;
  }
  try{state.recognition.start()}catch{}
  ensureStudyRealtime().catch(()=>{});
}
async function stopVoiceCommands({silent=false,preserveWanted=false}={}){
  const generation=++listenVoiceGeneration;clearTimeout(listenVoiceRestartTimer);
  if(!preserveWanted)state.audio.voiceWanted=false;
  state.listening=false;syncAudioUI();
  if(window.HobahNativeVoice)await window.HobahNativeVoice.stop().catch(()=>{});
  else try{state.recognition?.stop()}catch{}
  if(!preserveWanted)closeStudyRealtime();
  if(!silent&&generation===listenVoiceGeneration)setAudioStatus('Voice Commands off');
}
document.addEventListener('hobah:native-voice-transcript',e=>{
  if(!window.HobahNativeVoice||!state.audio.voiceWanted||!state.listening||state.audio.suppressRecognition)return;
  const text=clean(e.detail?.text).toLowerCase();if(text)handleVoice(text,!!e.detail?.final);
});
document.addEventListener('hobah:native-voice-state',e=>{
  if(!window.HobahNativeVoice)return;
  if(e.detail?.listening){state.listening=true;syncAudioUI();if(state.audio.voiceWanted&&!state.audio.suppressRecognition)setAudioStatus(voiceReadyStatus());return}
  state.listening=false;syncAudioUI();
  if(state.audio.voiceWanted&&!state.audio.suppressRecognition){setAudioStatus('Voice Commands • reconnecting…');scheduleListenVoiceRestart()}
});
document.addEventListener('hobah:native-voice-ready',()=>{
  if(window.HobahNativeVoice&&state.audio.voiceWanted&&!state.audio.suppressRecognition&&!state.listening)scheduleListenVoiceRestart();
});
`,
  'fresh Voice Commands state machine'
);

// Study AI temporarily owns the audio channel, but Voice Commands remains logically enabled and resumes afterwards.
if(app.includes('function suspendRecognitionForStudy(){')){
  replaceRange(
    'function suspendRecognitionForStudy(){',
    '\nfunction resumeRecognitionAfterStudy(){',
`function suspendRecognitionForStudy(){
  if(!state.audio.voiceWanted&&!state.listening)return;
  state.audio.voiceWasListening=!!state.audio.voiceWanted;
  state.audio.suppressRecognition=true;state.listening=false;syncAudioUI();
  if(window.HobahNativeVoice)window.HobahNativeVoice.stop().catch(()=>{});
  else try{state.recognition?.abort()}catch{}
}`,
    'Study microphone suspend'
  );
  replaceRange(
    'function resumeRecognitionAfterStudy(){',
    '\nfunction ensureScriptureAudio(){',
`function resumeRecognitionAfterStudy(){
  const shouldRestart=!!state.audio.voiceWasListening;
  state.audio.voiceWasListening=false;state.audio.suppressRecognition=false;
  if(!shouldRestart||!state.audio.voiceWanted)return;
  if(window.HobahNativeVoice){scheduleListenVoiceRestart();return}
  setTimeout(()=>{if(state.audio.voiceWanted&&!state.audio.suppressRecognition){try{state.recognition?.start()}catch{}}},100);
}`,
    'Study microphone resume'
  );
}

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=79','/styles.css?v=81').replace('/app.js?v=79','/app.js?v=81').replace('/manifest.webmanifest?v=79','/manifest.webmanifest?v=81');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=81#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ['HOBAH_LISTEN_V2=true','openListenPanelForChapter','Ready • press play or turn on Voice Commands','voiceWanted','hobah:native-voice-ready'])if(!app.includes(required))throw new Error('Release81 integration missing '+required);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 81: Listen rebuilt as open → opt-in voice → play/pause, with visuals unchanged');
