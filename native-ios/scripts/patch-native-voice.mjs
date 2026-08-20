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
      Promise.resolve(window.HobahNativeVoiceReady)
        .then(()=>window.HobahNativeVoice.start({locale:'en-AU'}))
        .then(()=>{syncAudioUI();setAudioStatus('Listening • say explain that, save that, stop, or play')})
        .catch(e=>{console.warn('Native Voice restart',e);state.listening=false;syncAudioUI();setAudioStatus('Voice Commands stopped')});
    },120);
    return;
  }
  setTimeout(()=>{if(state.listening&&!state.audio.suppressRecognition){try{state.recognition?.start()}catch{}}},60);
}`,
  'Study microphone resume'
);

replaceRange(
  'function startVoiceCommands(){',
  '\nfunction stopVoiceCommands(){',
`function startVoiceCommands(){
  if(window.HobahNativeVoice){
    if(state.listening)return;
    state.listening=true;syncAudioUI();setAudioStatus('Voice Commands • starting…');
    Promise.resolve(window.HobahNativeVoiceReady)
      .then(()=>window.HobahNativeVoice.start({locale:'en-AU'}))
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
  state.listening=false;
  if(window.HobahNativeVoice)window.HobahNativeVoice.stop().catch(()=>{});
  else try{state.recognition?.stop()}catch{}
  closeStudyRealtime();syncAudioUI();
}

document.addEventListener('hobah:native-voice-transcript',e=>{
  if(!window.HobahNativeVoice||!state.listening||state.audio.suppressRecognition)return;
  const text=clean(e.detail?.text).toLowerCase();if(text)handleVoice(text,!!e.detail?.final);
});
document.addEventListener('hobah:native-voice-state',e=>{
  if(!window.HobahNativeVoice)return;
  if(e.detail?.error&&!state.audio.suppressRecognition)setAudioStatus('Voice Commands • '+e.detail.error);
  else if(e.detail?.listening&&state.listening&&!state.audio.suppressRecognition)setAudioStatus('Listening • say explain that, save that, stop, or play');
});
`,
  'Voice Commands stop/events'
);

for(const required of ['HobahNativeVoice','hobah:native-voice-transcript','save that','explain that']){
  if(!app.includes(required))throw new Error('Native Voice integration missing '+required);
}
await writeFile(appPath,app);
console.log('Hobah native Voice Study bridge patched into command system');
