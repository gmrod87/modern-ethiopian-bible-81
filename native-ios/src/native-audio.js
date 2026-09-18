import { HobahAudio } from '@hobah/native-audio';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

const VOICE_CONTEXT=[
  'Hobah','Hey Hobah','explain that','explain this','explain that in more detail',
  'what does that mean','tell me more','go deeper','save that','save this',
  'stop','pause','stop reading','continue','resume','keep reading',
  'next verse','previous verse','go back'
];

function selectedVoice(){
  try{return localStorage.getItem('hobah:ttsVoice')==='male'?'cedar':'marin'}catch{return'marin'}
}
function keyFor(text,mode='normal',voice=selectedVoice()){
  const s=`${voice}|${mode}|${String(text||'').trim()}`;let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return `${voice}-${mode}-${(h>>>0).toString(16)}`;
}

// App Review hardening: Scripture Read Aloud is generated on the device with
// iOS/WebKit speech synthesis. It no longer depends on the network or sends
// Scripture text to a third-party TTS service. The Capacitor audio plugin stays
// installed for compatibility with older saved state, but normal Scripture audio
// uses this local path.
let localSpeechSerial=0,localUtterance=null,localSpeechId='',localSpeechChannel='scripture';
let localSpeechPlaying=false,localSpeechPaused=false,localSpeechRate=1;
function audioEvent(name,detail={}){document.dispatchEvent(new CustomEvent(name,{detail}))}
function availableSystemVoices(){try{return window.speechSynthesis?.getVoices?.()||[]}catch{return[]}}
function chooseSystemVoice(voice=selectedVoice()){
  const voices=availableSystemVoices();if(!voices.length)return null;
  const wantsMale=voice==='cedar';
  const preferred=wantsMale
    ? /Daniel|Alex|Aaron|Tom|Fred|Oliver|Jamie|Rishi/i
    : /Samantha|Karen|Moira|Tessa|Ava|Serena|Fiona|Siri/i;
  return voices.find(v=>preferred.test(v.name)&&/^en[-_]/i.test(v.lang))
    ||voices.find(v=>/^en-AU$/i.test(v.lang))
    ||voices.find(v=>/^en[-_]/i.test(v.lang))
    ||voices[0];
}
async function prepare({text,mode='normal',voice=selectedVoice()}){
  if(!String(text||'').trim())throw new Error('Nothing to read');
  return keyFor(text,mode,voice);
}
async function play({text,mode='normal',voice=selectedVoice(),title='Hobah',subtitle='The Ancient Canon',rate=1,forcePlayback=false,channel='scripture'}){
  text=String(text||'').trim();if(!text)throw new Error('Nothing to read');
  if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance)throw new Error('Read Aloud is unavailable on this device');
  const id=keyFor(text,mode,voice),serial=++localSpeechSerial;
  try{window.speechSynthesis.cancel()}catch{}
  const utterance=new SpeechSynthesisUtterance(text);
  const systemVoice=chooseSystemVoice(voice);if(systemVoice)utterance.voice=systemVoice;
  utterance.lang=systemVoice?.lang||'en-AU';
  utterance.rate=Math.max(.5,Math.min(1.8,.92*Number(rate||1)));
  utterance.pitch=1;utterance.volume=1;
  localUtterance=utterance;localSpeechId=id;localSpeechChannel=channel==='study'?'study':'scripture';localSpeechRate=Number(rate||1);localSpeechPlaying=true;localSpeechPaused=false;
  utterance.onstart=()=>{if(serial!==localSpeechSerial)return;localSpeechPlaying=true;localSpeechPaused=false;audioEvent('hobah:native-audio-state',{playing:true,id,channel:localSpeechChannel,onDevice:true,title,subtitle})};
  utterance.onend=()=>{if(serial!==localSpeechSerial)return;localSpeechPlaying=false;localSpeechPaused=false;localUtterance=null;audioEvent('hobah:native-audio-state',{playing:false,id,channel:localSpeechChannel,onDevice:true});audioEvent('hobah:native-audio-ended',{id,success:true,channel:localSpeechChannel,onDevice:true})};
  utterance.onerror=e=>{if(serial!==localSpeechSerial)return;localSpeechPlaying=false;localSpeechPaused=false;localUtterance=null;const cancelled=/canceled|interrupted/i.test(String(e?.error||''));audioEvent('hobah:native-audio-state',{playing:false,id,channel:localSpeechChannel,onDevice:true,error:e?.error||''});if(!cancelled)audioEvent('hobah:native-audio-ended',{id,success:false,channel:localSpeechChannel,onDevice:true,error:e?.error||'speech error'})};
  window.speechSynthesis.speak(utterance);
  // Some iOS versions do not emit onstart consistently, so publish state now too.
  audioEvent('hobah:native-audio-state',{playing:true,id,channel:localSpeechChannel,onDevice:true,title,subtitle});
  return id;
}
async function pauseAudio(options={}){
  if(!localUtterance)return;
  try{window.speechSynthesis.pause()}catch{}
  localSpeechPlaying=false;localSpeechPaused=true;
  audioEvent('hobah:native-audio-state',{playing:false,id:localSpeechId,channel:options?.channel==='study'?'study':localSpeechChannel,onDevice:true,paused:true});
}
async function resumeAudio(options={}){
  if(!localUtterance)throw new Error('No Read Aloud session is loaded');
  try{window.speechSynthesis.resume()}catch{}
  localSpeechPlaying=true;localSpeechPaused=false;
  audioEvent('hobah:native-audio-state',{playing:true,id:localSpeechId,channel:options?.channel==='study'?'study':localSpeechChannel,onDevice:true});
}
async function stopAudio(options={}){
  ++localSpeechSerial;
  try{window.speechSynthesis.cancel()}catch{}
  const id=localSpeechId,channel=options?.channel==='study'?'study':localSpeechChannel;
  localUtterance=null;localSpeechId='';localSpeechPlaying=false;localSpeechPaused=false;
  audioEvent('hobah:native-audio-state',{playing:false,id,channel,onDevice:true,stopped:true});
}
async function setAudioRate(rate){localSpeechRate=Math.max(.5,Math.min(2,Number(rate||1)));return{rate:localSpeechRate}}
async function getAudioState(options={}){return{playing:localSpeechPlaying,paused:localSpeechPaused,id:localSpeechId,channel:options?.channel==='study'?'study':localSpeechChannel,onDevice:true,rate:localSpeechRate}}
async function clearAudioCache(){try{await HobahAudio.clearCache()}catch{}return{cleared:true}}
async function initAudio(){
  // Keep plugin listeners so an older in-memory native player cannot orphan state
  // during an app update. New Scripture sessions use the on-device synthesizer above.
  await HobahAudio.addListener('ended',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-ended',{detail:e})));
  await HobahAudio.addListener('remoteNext',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-next',{detail:e})));
  await HobahAudio.addListener('remotePrevious',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-previous',{detail:e})));
  await HobahAudio.addListener('stateChange',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-state',{detail:e})));
  // Warm the local voice list where WebKit exposes it asynchronously.
  try{window.speechSynthesis?.getVoices?.()}catch{}
}

let lastVoiceError='',voiceSessionSerial=0,voicePollTimer=0,lastDeliveredText='',lastDeliveredAt=0,lastNativeListening=false;
function voiceText(event={}){
  const matches=Array.isArray(event.matches)?event.matches:[];
  return String(event.accumulatedText||event.accumulated||event.text||matches[0]||'').trim();
}
function emitVoiceTranscript(text,extra={}){
  text=String(text||'').trim();if(!text)return;
  const now=Date.now();if(text===lastDeliveredText&&now-lastDeliveredAt<900)return;
  lastDeliveredText=text;lastDeliveredAt=now;
  document.dispatchEvent(new CustomEvent('hobah:native-voice-transcript',{detail:{text,final:false,engine:'capgo-standard',...extra}}));
}
function stopVoicePolling(){if(voicePollTimer){clearInterval(voicePollTimer);voicePollTimer=0}}
function startVoicePolling(){
  stopVoicePolling();
  voicePollTimer=setInterval(async()=>{
    try{
      const listening=await SpeechRecognition.isListening();
      lastNativeListening=!!listening?.listening;
      if(!lastNativeListening)return;
      const last=await SpeechRecognition.getLastPartialResult();
      const text=voiceText(last);if(text)emitVoiceTranscript(text,{source:'poll'});
    }catch{}
  },180);
}
async function initVoice(){
  await SpeechRecognition.addListener('partialResults',event=>{
    const text=voiceText(event);if(text)emitVoiceTranscript(text,{source:'event',forced:!!event?.forced});
  });
  await SpeechRecognition.addListener('listeningState',event=>{
    const listening=event?.state==='started'||event?.status==='started';
    lastNativeListening=listening;
    document.dispatchEvent(new CustomEvent('hobah:native-voice-state',{detail:{listening,state:event?.state||event?.status||'',reason:event?.reason||'',errorCode:event?.errorCode||'',sessionId:event?.sessionId||0,engine:'capgo-standard'}}));
  });
  await SpeechRecognition.addListener('readyForNextSession',event=>{
    document.dispatchEvent(new CustomEvent('hobah:native-voice-ready',{detail:{sessionId:event?.sessionId||0,engine:'capgo-standard'}}));
  });
  await SpeechRecognition.addListener('error',event=>{
    lastVoiceError=String(event?.message||event?.code||'Speech recognition error');
    lastNativeListening=false;
    document.dispatchEvent(new CustomEvent('hobah:native-voice-state',{detail:{listening:false,error:lastVoiceError,errorCode:event?.code||'',sessionId:event?.sessionId||0,engine:'capgo-standard'}}));
  });
}

async function requestVoicePermissions(){
  const result=await SpeechRecognition.requestPermissions();
  const status=result?.speechRecognition||'prompt';
  return {speech:status,microphone:status,engine:'capgo-standard'};
}
async function forceStopRecognition(){
  await SpeechRecognition.forceStop().catch(()=>SpeechRecognition.stop().catch(()=>{}));
  for(let i=0;i<16;i++){
    const state=await SpeechRecognition.isListening().catch(()=>({listening:false}));
    if(!state?.listening)break;
    await new Promise(r=>setTimeout(r,60));
  }
  await new Promise(r=>setTimeout(r,80));
}
async function startVoice(options={locale:'en-AU'}){
  await Promise.resolve(window.HobahNativeVoiceReady);
  const serial=++voiceSessionSerial,language=options.locale||options.language||'en-AU';
  const availability=await SpeechRecognition.available({language}).catch(()=>({available:false}));
  if(!availability?.available)throw new Error('Speech recognition is temporarily unavailable');
  await forceStopRecognition();
  if(serial!==voiceSessionSerial)return;
  lastVoiceError='';lastDeliveredText='';lastDeliveredAt=0;
  await SpeechRecognition.start({
    language,
    maxResults:3,
    partialResults:true,
    addPunctuation:false,
    contextualStrings:VOICE_CONTEXT,
    useOnDeviceRecognition:false
  });
  startVoicePolling();
}
async function stopVoice(){
  ++voiceSessionSerial;stopVoicePolling();lastNativeListening=false;
  await forceStopRecognition();
}
async function getVoiceState(){
  const [listening,available,permissions,last,version]=await Promise.all([
    SpeechRecognition.isListening().catch(()=>({listening:false})),
    SpeechRecognition.available({language:'en-AU'}).catch(()=>({available:false})),
    SpeechRecognition.checkPermissions().catch(()=>({speechRecognition:'prompt'})),
    SpeechRecognition.getLastPartialResult().catch(()=>({available:false,text:'',matches:[]})),
    SpeechRecognition.getPluginVersion().catch(()=>({version:'8.1.0'}))
  ]);
  const permission=permissions?.speechRecognition||'prompt',lastTranscript=voiceText(last);
  lastNativeListening=!!listening?.listening;
  return {
    listening:lastNativeListening,
    available:!!available?.available,
    speechPermission:permission,
    microphonePermission:permission,
    lastTranscript,
    lastError:lastVoiceError,
    engine:'capgo-standard',
    engineVersion:version?.version||'8.1.0'
  };
}

window.HobahNativeAudio={
  keyFor,
  prepare,
  play,
  pause:pauseAudio,
  resume:resumeAudio,
  stop:stopAudio,
  setRate:setAudioRate,
  getState:getAudioState,
  clearCache:clearAudioCache,
  onDevice:true
};
window.HobahNativeVoice={
  requestPermissions:requestVoicePermissions,
  start:startVoice,
  stop:stopVoice,
  getState:getVoiceState
};
window.HobahNativeAudioReady=initAudio();
window.HobahNativeVoiceReady=initVoice();
