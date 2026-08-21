/* Hobah Release 90 — clean voice engine. UI is intentionally unchanged. */
const VOICE90={phase:'idle',restartTimer:0,generation:0,resumeAfterVoicePause:false,studyAbort:null,lastKind:'',lastAt:0};
function voice90Status(t){setAudioStatus(t);syncSettingsVoiceUI()}
function voice90Enabled(){return voicePreferenceEnabled()}
function voice90Sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function voice90NativeStopped(){
  if(!window.HobahNativeVoice)return true;
  for(let i=0;i<18;i++){
    const s=await window.HobahNativeVoice.getState().catch(()=>({listening:false}));
    if(!s?.listening)return true;
    await voice90Sleep(70);
  }
  return false;
}
async function voice90StopRecognition({preserveWanted=true,silent=true}={}){
  clearTimeout(VOICE90.restartTimer);VOICE90.restartTimer=0;VOICE90.generation++;
  if(!preserveWanted)state.audio.voiceWanted=false;
  state.audio.suppressRecognition=true;state.listening=false;syncAudioUI();syncSettingsVoiceUI();
  if(window.HobahNativeVoice){
    await Promise.resolve(window.HobahNativeVoiceReady).catch(()=>{});
    await window.HobahNativeVoice.stop().catch(()=>{});
    await voice90NativeStopped();
    await voice90Sleep(90);
  }else{
    try{state.recognition?.abort()}catch{}
    await voice90Sleep(40);
  }
  if(!silent&&!preserveWanted)voice90Status('Voice Commands off');
}
async function voice90StartRecognition({requestPermission=false}={}){
  if(!voice90Enabled()||state.audio.studyBusy||state.audio.suppressRecognition)return false;
  state.audio.voiceWanted=true;
  const generation=++VOICE90.generation;
  clearTimeout(VOICE90.restartTimer);VOICE90.restartTimer=0;
  if(window.HobahNativeVoice){
    await Promise.resolve(window.HobahNativeVoiceReady);
    if(requestPermission){
      const permissions=await window.HobahNativeVoice.requestPermissions();
      if(permissions?.speech==='denied'||permissions?.microphone==='denied')throw Error('Microphone and Speech Recognition permission are required for Voice Commands');
    }
    const s=await window.HobahNativeVoice.getState().catch(()=>({available:true,listening:false}));
    if(s?.available===false)throw Error('Speech recognition is temporarily unavailable');
    if(s?.listening){state.listening=true;state.audio.suppressRecognition=false;VOICE90.phase='listening';syncAudioUI();voice90Status(voiceReadyStatus());return true}
    await voice90NativeStopped();
    if(generation!==VOICE90.generation||!state.audio.voiceWanted||state.audio.studyBusy)return false;
    await window.HobahNativeVoice.start({locale:'en-AU'});
    for(let i=0;i<24;i++){
      if(generation!==VOICE90.generation||!state.audio.voiceWanted||state.audio.studyBusy)return false;
      const live=await window.HobahNativeVoice.getState().catch(()=>null);
      if(live?.listening){state.listening=true;state.audio.suppressRecognition=false;VOICE90.phase='listening';syncAudioUI();voice90Status(voiceReadyStatus());return true}
      await voice90Sleep(70);
    }
    throw Error('Voice Commands could not activate the microphone');
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)throw Error('Voice commands are not supported by this browser');
  if(!state.recognition){
    const r=new SR();r.lang='en-AU';r.continuous=true;r.interimResults=true;r.maxAlternatives=3;
    r.onstart=()=>{if(state.audio.voiceWanted&&!state.audio.studyBusy){state.listening=true;state.audio.suppressRecognition=false;VOICE90.phase='listening';syncAudioUI();voice90Status(voiceReadyStatus())}};
    r.onresult=e=>{if(state.audio.suppressRecognition||state.audio.studyBusy)return;for(let i=e.resultIndex;i<e.results.length;i++){const result=e.results[i];for(let a=0;a<Math.min(3,result.length);a++){const text=clean(result[a]?.transcript).toLowerCase();if(text){handleVoice(text,result.isFinal);if(commandKind90(text))break}}}};
    r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){localSet('hobah:voiceCommands','0');state.audio.voiceWanted=false;state.listening=false;syncAudioUI();syncSettingsVoiceUI();voice90Status('Microphone permission needed')}};
    r.onend=()=>{state.listening=false;syncAudioUI();if(state.audio.voiceWanted&&!state.audio.studyBusy&&!state.audio.suppressRecognition)scheduleListenVoiceRestart()};
    state.recognition=r;
  }
  state.audio.suppressRecognition=false;
  try{state.recognition.start()}catch{}
  return true;
}
function voice90ScheduleRestart(){
  clearTimeout(VOICE90.restartTimer);
  if(!voice90Enabled()||!state.audio.voiceWanted||state.audio.studyBusy||state.audio.suppressRecognition||state.listening)return;
  const generation=VOICE90.generation;
  VOICE90.restartTimer=setTimeout(async()=>{
    if(generation!==VOICE90.generation||state.audio.studyBusy||state.audio.suppressRecognition||!state.audio.voiceWanted||state.listening)return;
    try{await voice90StartRecognition({requestPermission:false})}catch(e){console.warn('Voice90 restart',e);state.listening=false;syncAudioUI();voice90Status('Voice Commands • reconnecting…')}
  },180);
}
async function voice90SuspendForStudy(){
  state.audio.voiceWasListening=!!(state.audio.voiceWanted||state.listening);
  await voice90StopRecognition({preserveWanted:true,silent:true});
  VOICE90.phase='study';
}
async function voice90ResumeAfterStudy(){
  const should=!!state.audio.voiceWasListening&&voice90Enabled();
  state.audio.voiceWasListening=false;state.audio.suppressRecognition=false;
  if(!should||!state.audio.voiceWanted)return;
  await voice90Sleep(150);
  try{await voice90StartRecognition({requestPermission:false})}catch(e){console.warn('Voice90 resume',e);voice90ScheduleRestart()}
}
async function voice90PauseScripture(){
  if(window.HobahNativeAudio){
    await Promise.resolve(window.HobahNativeAudioReady).catch(()=>{});
    const s=await window.HobahNativeAudio.getState({channel:'scripture'}).catch(()=>null);
    if(s?.playing||state.audio.playing)await window.HobahNativeAudio.pause({channel:'scripture'}).catch(()=>{});
    state.audio.playing=false;state.audio.paused=true;syncAudioUI();return;
  }
  const a=ensureScriptureAudio();if(!a.paused)a.pause();state.audio.playing=false;state.audio.paused=true;syncAudioUI();
}
async function voice90ResumeScripture(){
  if(!state.audio.items.length||state.audio.stopped)return;
  $('#audioRef').textContent=state.audio.current?state.audio.current.title+' '+state.audio.current.chapter:'Read aloud';
  voice90Status('Returning to Scripture…');
  if(window.HobahNativeAudio){
    try{await window.HobahNativeAudio.resume({channel:'scripture'});state.audio.playing=true;state.audio.paused=false;setAudioPlay('❚❚');voice90Status('Scripture');return}catch{}
    await playNarrationItem();return;
  }
  const a=ensureScriptureAudio();
  try{if(a.src){await a.play();state.audio.playing=true;state.audio.paused=false;setAudioPlay('❚❚');return}}catch{}
  await playNarrationItem();
}
function commandKind90(text){
  let t=clean(text).toLowerCase().replace(/[^a-z\s']/g,' ').replace(/\s+/g,' ').trim();
  t=t.replace(/^(?:hey\s+)?(?:hobah|hoba|ho bah|oba)\s+/i,'').replace(/^please\s+/i,'').replace(/\s+please$/i,'').trim();
  if(/\b(explain that in more detail|explain this in more detail|explain that|explain this|what does that mean|tell me more|go deeper)\b/.test(t))return'explain';
  if(/\b(save that to my notes|save this to my notes|save that explanation|save this explanation|save that|save this|save it)\b/.test(t))return'save';
  if(/^(stop reading|pause reading|stop|pause|hold on|hold)$/.test(t))return'pause';
  if(/^(keep reading|continue reading|carry on|continue|resume|play)$/.test(t))return'play';
  if(/^(next verse|next section|go next|next)$/.test(t))return'next';
  if(/^(previous verse|go previous|go back|previous|back)$/.test(t))return'prev';
  return'';
}