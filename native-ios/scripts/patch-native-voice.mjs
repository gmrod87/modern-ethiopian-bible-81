import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appPath=path.join(root,'www','app.js');
let app=await readFile(appPath,'utf8');

function replaceRange(start,end,replacement,label){
  const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error(`Native Voice patch missing ${label}`);
  app=app.slice(0,a)+replacement+app.slice(b);
}

replaceRange(
  'function suspendRecognitionForStudy(){',
  '\nfunction resumeRecognitionAfterStudy(){',
`function suspendRecognitionForStudy(){
  if(!state.listening)return;
  state.audio.voiceWasListening=true;
  state.audio.suppressRecognition=true;
  if(window.HobahNativeVoice){window.HobahNativeVoice.stop().catch(()=>{});return}
  try{state.recognition?.abort()}catch{}
}`,
  'Study microphone suspend'
);

replaceRange(
  'function resumeRecognitionAfterStudy(){',
  '\nfunction ensureScriptureAudio(){',
`function resumeRecognitionAfterStudy(){
  const shouldRestart=!!state.audio.voiceWasListening;
  state.audio.voiceWasListening=false;
  state.audio.suppressRecognition=false;
  if(!shouldRestart||!state.listening)return;
  if(window.HobahNativeVoice){
    setTimeout(()=>{
      if(!state.listening||state.audio.suppressRecognition)return;
      startNativeVoiceSession(false)
        .then(()=>{syncAudioUI();setAudioStatus('Listening • say explain that, save that, stop, or play')})
        .catch(e=>{console.warn('Native Voice restart',e);scheduleNativeVoiceRecovery(e)});
    },220);
    return;
  }
  setTimeout(()=>{if(state.listening&&!state.audio.suppressRecognition){try{state.recognition?.start()}catch{}}},60);
}`,
  'Study microphone resume'
);

replaceRange(
  'function startVoiceCommands(){',
  '\nfunction stopVoiceCommands(){',
`let nativeVoiceRecoveryTimer=0,nativeVoiceRecoveryCount=0,nativeVoiceStarting=false;
async function startNativeVoiceSession(requestPermission=true){
  if(!window.HobahNativeVoice)return;
  if(nativeVoiceStarting)return;
  nativeVoiceStarting=true;
  try{
    await Promise.resolve(window.HobahNativeVoiceReady);
    if(requestPermission){
      const permissions=await window.HobahNativeVoice.requestPermissions();
      if(permissions?.speech==='denied'||permissions?.microphone==='denied')throw Error('Microphone and Speech Recognition permission are required for Voice Commands');
    }
    await window.HobahNativeVoice.start({locale:'en-AU'});
    await sleep(90);
    const status=await window.HobahNativeVoice.getState().catch(()=>({listening:true,available:true}));
    if(status?.available===false)throw Error('Speech recognition is temporarily unavailable');
    if(status?.listening===false)throw Error('Voice Commands did not start');
    nativeVoiceRecoveryCount=0;
  }finally{nativeVoiceStarting=false}
}
function scheduleNativeVoiceRecovery(error){
  if(!window.HobahNativeVoice||!state.listening||state.audio.suppressRecognition)return;
  clearTimeout(nativeVoiceRecoveryTimer);
  if(nativeVoiceRecoveryCount>=4){
    state.listening=false;syncAudioUI();setAudioStatus('Voice Commands stopped • tap to retry');
    if(error)toast(error?.message||'Voice Commands stopped');
    return;
  }
  const delay=220+nativeVoiceRecoveryCount*220;nativeVoiceRecoveryCount++;
  nativeVoiceRecoveryTimer=setTimeout(()=>{
    if(!state.listening||state.audio.suppressRecognition)return;
    startNativeVoiceSession(false)
      .then(()=>{syncAudioUI();setAudioStatus('Listening • say explain that, save that, stop, or play')})
      .catch(e=>{console.warn('Native Voice recovery',e);scheduleNativeVoiceRecovery(e)});
  },delay);
}
function startVoiceCommands(){
  if(window.HobahNativeVoice){
    if(state.listening)return;
    clearTimeout(nativeVoiceRecoveryTimer);nativeVoiceRecoveryCount=0;
    state.listening=true;syncAudioUI();setAudioStatus('Voice Commands • starting…');
    startNativeVoiceSession(true)
      .then(()=>{syncAudioUI();setAudioStatus('Listening • say explain that, save that, stop, or play');ensureStudyRealtime().catch(()=>{})})
      .catch(e=>{console.warn('Native Voice start',e);state.listening=false;syncAudioUI();setAudioStatus('Microphone permission needed');toast(e?.message||'Voice Commands need microphone and speech permission')});
    return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('Voice commands are not supported by this Safari version');return}
  if(!state.recognition){
    const r=new SR();r.continuous=true;r.interimResults=true;r.lang='en-AU';r.maxAlternatives=1;
    r.onresult=e=>{if(state.audio.suppressRecognition)return;for(let i=e.resultIndex;i<e.results.length;i++){const text=clean(e.results[i][0]?.transcript).toLowerCase();if(text)handleVoice(text,e.results[i].isFinal)}};
    r.onend=()=>{if(state.listening&&!state.audio.suppressRecognition)setTimeout(()=>{try{r.start()}catch{}},25)};
    r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){state.listening=false;syncAudioUI();setAudioStatus('Microphone permission needed')}};
    state.recognition=r;
  }
  state.listening=true;try{state.recognition.start()}catch{}ensureStudyRealtime().catch(()=>{});syncAudioUI();setAudioStatus('Listening • say explain that, save that, stop, or play');
}`,
  'Voice Commands start'
);

replaceRange(
  'function stopVoiceCommands(){',
  '\nlet lastVoice=',
`function stopVoiceCommands(){
  state.listening=false;clearTimeout(nativeVoiceRecoveryTimer);nativeVoiceRecoveryCount=0;
  if(window.HobahNativeVoice)window.HobahNativeVoice.stop().catch(()=>{});
  else try{state.recognition?.stop()}catch{}
  closeStudyRealtime();syncAudioUI();setAudioStatus('Voice Commands off');
}

document.addEventListener('hobah:native-voice-transcript',e=>{
  if(!window.HobahNativeVoice||!state.listening||state.audio.suppressRecognition)return;
  const text=clean(e.detail?.text).toLowerCase();if(text)handleVoice(text,!!e.detail?.final);
});
document.addEventListener('hobah:native-voice-state',e=>{
  if(!window.HobahNativeVoice)return;
  if(e.detail?.listening){
    nativeVoiceRecoveryCount=0;clearTimeout(nativeVoiceRecoveryTimer);
    if(state.listening&&!state.audio.suppressRecognition)setAudioStatus('Listening • say explain that, save that, stop, or play');
    return;
  }
  if(e.detail?.error&&!state.audio.suppressRecognition)setAudioStatus('Voice Commands • '+e.detail.error);
  if(state.listening&&!state.audio.suppressRecognition)scheduleNativeVoiceRecovery(e.detail?.error?new Error(e.detail.error):null);
});
`,
  'Voice Commands stop/events'
);

const bootstrapTwo="Promise.allSettled([Promise.resolve(window.HobahNativeReady),Promise.resolve(window.HobahNativeAudioReady)]).finally(()=>bootstrap());";
if(app.includes(bootstrapTwo))app=app.replace(bootstrapTwo,"Promise.allSettled([Promise.resolve(window.HobahNativeReady),Promise.resolve(window.HobahNativeAudioReady),Promise.resolve(window.HobahNativeVoiceReady)]).finally(()=>bootstrap());");

for(const required of ['HobahNativeVoice','HobahNativeVoiceReady','hobah:native-voice-transcript','scheduleNativeVoiceRecovery','save that','explain that']){
  if(!app.includes(required))throw new Error('Native Voice integration missing '+required);
}
await writeFile(appPath,app);
console.log('Hobah native Voice Study bridge patched with permission preflight and automatic recovery');
