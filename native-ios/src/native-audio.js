import { HobahAudio, HobahVoice } from '@hobah/native-audio';

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
async function initVoice(){
  await HobahVoice.addListener('transcript',e=>document.dispatchEvent(new CustomEvent('hobah:native-voice-transcript',{detail:e})));
  await HobahVoice.addListener('command',e=>document.dispatchEvent(new CustomEvent('hobah:native-voice-command',{detail:e})));
  await HobahVoice.addListener('stateChange',e=>document.dispatchEvent(new CustomEvent('hobah:native-voice-state',{detail:e})));
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
  requestPermissions:()=>HobahVoice.requestPermissions(),
  start:(options={locale:'en-AU'})=>HobahVoice.start(options),
  stop:()=>HobahVoice.stop(),
  getState:()=>HobahVoice.getState()
};
window.HobahNativeAudioReady=initAudio();
window.HobahNativeVoiceReady=initVoice();
