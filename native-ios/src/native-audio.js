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
function requireOnline(){if(window.HOBAH_NETWORK_CONNECTED===false)throw new Error('Natural voice needs an internet connection')}
async function prepare({text,mode='normal',voice=selectedVoice()}){
  requireOnline();const id=keyFor(text,mode,voice);await HobahAudio.prepare({id,text,mode,voice});return id;
}
async function play({text,mode='normal',voice=selectedVoice(),title='Hobah',subtitle='The Ancient Canon',rate=1}){
  requireOnline();const id=keyFor(text,mode,voice);
  await HobahAudio.play({id,text,mode,voice,title,subtitle,rate});return id;
}
async function initAudio(){
  await HobahAudio.addListener('ended',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-ended',{detail:e})));
  await HobahAudio.addListener('remoteNext',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-next',{detail:e})));
  await HobahAudio.addListener('remotePrevious',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-previous',{detail:e})));
  await HobahAudio.addListener('stateChange',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-state',{detail:e})));
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
  },220);
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
async function stopExistingSession(){
  const existing=await SpeechRecognition.isListening().catch(()=>({listening:false}));
  if(!existing?.listening)return;
  await SpeechRecognition.forceStop().catch(()=>SpeechRecognition.stop().catch(()=>{}));
  await new Promise(r=>setTimeout(r,140));
}
async function startVoice(options={locale:'en-AU'}){
  await Promise.resolve(window.HobahNativeVoiceReady);
  const serial=++voiceSessionSerial,language=options.locale||options.language||'en-AU';
  const availability=await SpeechRecognition.available({language}).catch(()=>({available:false}));
  if(!availability?.available)throw new Error('Speech recognition is temporarily unavailable');
  await stopExistingSession();
  if(serial!==voiceSessionSerial)return;
  lastVoiceError='';lastDeliveredText='';lastDeliveredAt=0;
  await SpeechRecognition.start({
    language,
    maxResults:1,
    partialResults:true,
    addPunctuation:false,
    contextualStrings:VOICE_CONTEXT,
    useOnDeviceRecognition:false
  });
  startVoicePolling();
}
async function stopVoice(){
  ++voiceSessionSerial;stopVoicePolling();lastNativeListening=false;
  const existing=await SpeechRecognition.isListening().catch(()=>({listening:false}));
  if(!existing?.listening)return;
  await SpeechRecognition.forceStop().catch(()=>SpeechRecognition.stop().catch(()=>{}));
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
  pause:()=>HobahAudio.pause(),
  resume:()=>HobahAudio.resume(),
  stop:()=>HobahAudio.stop(),
  setRate:rate=>HobahAudio.setRate({rate}),
  getState:()=>HobahAudio.getState(),
  clearCache:()=>HobahAudio.clearCache()
};
window.HobahNativeVoice={
  requestPermissions:requestVoicePermissions,
  start:startVoice,
  stop:stopVoice,
  getState:getVoiceState
};
window.HobahNativeAudioReady=initAudio();
window.HobahNativeVoiceReady=initVoice();
