import { HobahAudio } from '@hobah/native-audio';

function keyFor(text,mode='normal'){
  const s=`${mode}|${String(text||'').trim()}`;let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return `${mode}-${(h>>>0).toString(16)}`;
}
function requireOnline(){if(window.HOBAH_NETWORK_CONNECTED===false)throw new Error('Natural voice needs an internet connection')}
async function prepare({text,mode='normal'}){
  requireOnline();const id=keyFor(text,mode);await HobahAudio.prepare({id,text,mode});return id;
}
async function play({text,mode='normal',title='Hobah',subtitle='The Ancient Canon',rate=1}){
  requireOnline();const id=keyFor(text,mode);
  await HobahAudio.play({id,text,mode,title,subtitle,rate});return id;
}
async function init(){
  await HobahAudio.addListener('ended',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-ended',{detail:e})));
  await HobahAudio.addListener('remoteNext',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-next',{detail:e})));
  await HobahAudio.addListener('remotePrevious',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-previous',{detail:e})));
  await HobahAudio.addListener('stateChange',e=>document.dispatchEvent(new CustomEvent('hobah:native-audio-state',{detail:e})));
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
window.HobahNativeAudioReady=init();
