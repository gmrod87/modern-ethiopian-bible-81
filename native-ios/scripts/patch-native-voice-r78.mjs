import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appPath=path.join(root,'www','app.js');
let app=await readFile(appPath,'utf8');
function replaceRange(start,end,replacement,label){
  const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error(`Release78 native patch missing ${label}`);
  app=app.slice(0,a)+replacement+app.slice(b);
}

replaceRange(
  'let nativeVoiceRecoveryTimer=0,nativeVoiceRecoveryCount=0,nativeVoiceStarting=false;',
  '\nfunction startVoiceCommands(){',
`let nativeVoiceRecoveryTimer=0,nativeVoiceRecoveryCount=0,nativeVoiceStarting=false;
let nativeVoicePollTimer=0,nativeVoiceSeenCommandRevision=-1,nativeVoiceSeenTranscriptRevision=-1;
function stopNativeVoicePoll(){if(nativeVoicePollTimer){clearInterval(nativeVoicePollTimer);nativeVoicePollTimer=0}}
function acceptNativeVoiceState(status){
  if(!status||!state.listening||state.audio.suppressRecognition)return;
  const cr=Number(status.commandRevision??-1),tr=Number(status.transcriptRevision??-1);
  if(cr>nativeVoiceSeenCommandRevision&&status.command){
    nativeVoiceSeenCommandRevision=cr;handleVoice(status.command,true);return;
  }
  if(tr>nativeVoiceSeenTranscriptRevision&&status.transcript){
    nativeVoiceSeenTranscriptRevision=tr;handleVoice(status.transcript,false);
  }
}
function beginNativeVoicePoll(){
  stopNativeVoicePoll();if(!window.HobahNativeVoice||!state.listening||state.audio.suppressRecognition)return;
  nativeVoicePollTimer=setInterval(async()=>{
    if(!state.listening||state.audio.suppressRecognition)return;
    const status=await window.HobahNativeVoice.getState().catch(()=>null);if(!status)return;
    acceptNativeVoiceState(status);
    if(status.available===false){setAudioStatus('Voice Commands • speech service unavailable');return}
    if(status.listening===false&&!nativeVoiceStarting)scheduleNativeVoiceRecovery(new Error('Microphone listener stopped'));
  },260);
}
async function startNativeVoiceSession(requestPermission=true){
  if(!window.HobahNativeVoice)return;
  if(nativeVoiceStarting)return;
  nativeVoiceStarting=true;
  try{
    // Listener registration is useful but must never be able to block the actual mic.
    await Promise.race([Promise.resolve(window.HobahNativeVoiceReady).catch(()=>{}),sleep(450)]);
    if(requestPermission){
      const permissions=await Promise.race([window.HobahNativeVoice.requestPermissions(),sleep(4000).then(()=>({speech:'prompt',microphone:'prompt'}))]);
      if(permissions?.speech==='denied'||permissions?.microphone==='denied')throw Error('Microphone and Speech Recognition permission are required for Voice Commands');
    }
    await Promise.race([window.HobahNativeVoice.start({locale:'en-AU'}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Voice Commands start timed out')),4500))]);
    await sleep(120);
    const status=await Promise.race([window.HobahNativeVoice.getState().catch(()=>null),sleep(650).then(()=>null)]);
    if(status?.available===false)throw Error('Speech recognition is temporarily unavailable');
    if(status?.listening===false)throw Error('Voice Commands did not start');
    nativeVoiceSeenCommandRevision=Number(status?.commandRevision??-1);
    nativeVoiceSeenTranscriptRevision=Number(status?.transcriptRevision??-1);
    nativeVoiceRecoveryCount=0;beginNativeVoicePoll();
  }finally{nativeVoiceStarting=false}
}
function scheduleNativeVoiceRecovery(error){
  if(!window.HobahNativeVoice||!state.listening||state.audio.suppressRecognition)return;
  clearTimeout(nativeVoiceRecoveryTimer);
  if(nativeVoiceRecoveryCount>=6){
    stopNativeVoicePoll();state.listening=false;syncAudioUI();setAudioStatus('Voice Commands stopped • tap to retry');
    if(error)toast(error?.message||'Voice Commands stopped');return;
  }
  const delay=180+nativeVoiceRecoveryCount*180;nativeVoiceRecoveryCount++;
  nativeVoiceRecoveryTimer=setTimeout(()=>{
    if(!state.listening||state.audio.suppressRecognition)return;
    startNativeVoiceSession(false)
      .then(()=>{syncAudioUI();setAudioStatus('Listening • mic active')})
      .catch(e=>{console.warn('Native Voice recovery',e);scheduleNativeVoiceRecovery(e)});
  },delay);
}`,
  'native voice session/polling'
);

replaceRange(
  'function startVoiceCommands(){',
  '\nfunction stopVoiceCommands(){',
`function startVoiceCommands(){
  if(window.HobahNativeVoice){
    if(state.listening)return;
    clearTimeout(nativeVoiceRecoveryTimer);nativeVoiceRecoveryCount=0;stopNativeVoicePoll();
    state.listening=true;syncAudioUI();setAudioStatus('Voice Commands • starting microphone…');
    startNativeVoiceSession(true)
      .then(()=>{syncAudioUI();setAudioStatus('Listening • mic active');ensureStudyRealtime().catch(()=>{})})
      .catch(e=>{console.warn('Native Voice start',e);stopNativeVoicePoll();state.listening=false;syncAudioUI();setAudioStatus('Voice Commands unavailable');toast(e?.message||'Voice Commands need microphone and speech permission')});
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
  state.listening=false;clearTimeout(nativeVoiceRecoveryTimer);nativeVoiceRecoveryCount=0;stopNativeVoicePoll();
  if(window.HobahNativeVoice)window.HobahNativeVoice.stop().catch(()=>{});
  else try{state.recognition?.stop()}catch{}
  closeStudyRealtime();syncAudioUI();setAudioStatus('Voice Commands off');
}

document.addEventListener('hobah:native-voice-transcript',e=>{
  if(!window.HobahNativeVoice||!state.listening||state.audio.suppressRecognition)return;
  const rev=Number(e.detail?.revision??-1);if(rev>nativeVoiceSeenTranscriptRevision)nativeVoiceSeenTranscriptRevision=rev;
  const text=clean(e.detail?.tail||e.detail?.text).toLowerCase();if(text)handleVoice(text,!!e.detail?.final);
});
document.addEventListener('hobah:native-voice-command',e=>{
  if(!window.HobahNativeVoice||!state.listening||state.audio.suppressRecognition)return;
  const rev=Number(e.detail?.revision??-1);if(rev>nativeVoiceSeenCommandRevision)nativeVoiceSeenCommandRevision=rev;
  const command=clean(e.detail?.command).toLowerCase();if(command)handleVoice(command,true);
});
document.addEventListener('hobah:native-voice-state',e=>{
  if(!window.HobahNativeVoice)return;
  if(e.detail?.listening){
    nativeVoiceRecoveryCount=0;clearTimeout(nativeVoiceRecoveryTimer);beginNativeVoicePoll();
    if(state.listening&&!state.audio.suppressRecognition)setAudioStatus('Listening • mic active');return;
  }
  if(e.detail?.error&&!state.audio.suppressRecognition)setAudioStatus('Voice Commands • '+e.detail.error);
  if(state.listening&&!state.audio.suppressRecognition)scheduleNativeVoiceRecovery(e.detail?.error?new Error(e.detail.error):null);
});
`,
  'Voice Commands stop/events'
);

app=app.replace("  if(window.HobahNativeVoice){window.HobahNativeVoice.stop().catch(()=>{});return}","  if(window.HobahNativeVoice){stopNativeVoicePoll();window.HobahNativeVoice.stop().catch(()=>{});return}");

for(const required of ['nativeVoicePollTimer','hobah:native-voice-command','commandRevision','Listening • mic active','extractVoiceCommand']){
  if(!app.includes(required))throw new Error('Release78 native integration missing '+required);
}
await writeFile(appPath,app);
console.log('Hobah Release 78 native Voice Commands: command events + getState polling fallback enabled');
