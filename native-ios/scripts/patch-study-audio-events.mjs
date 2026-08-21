import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const appPath=path.resolve(here,'..','www','app.js');
let app=await readFile(appPath,'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release83 native patch missing: '+label);app=app.replace(from,to)};

swap(
  "document.addEventListener('hobah:native-audio-ended',()=>{if(window.HobahNativeAudio&&!state.audio.stopped)advanceNarration()});",
  "document.addEventListener('hobah:native-audio-ended',()=>{if(window.HobahNativeAudio&&!state.audio.stopped&&!state.audio.studyBusy)advanceNarration()});",
  'native ended Study guard'
);
swap(
  "document.addEventListener('hobah:native-audio-state',e=>{if(!window.HobahNativeAudio)return;const playing=!!e.detail?.playing;state.audio.playing=playing;state.audio.paused=!playing&&!state.audio.stopped;syncAudioUI()});",
  "document.addEventListener('hobah:native-audio-state',e=>{if(!window.HobahNativeAudio||state.audio.studyBusy)return;const playing=!!e.detail?.playing;state.audio.playing=playing;state.audio.paused=!playing&&!state.audio.stopped;syncAudioUI()});",
  'native state Study guard'
);

for(const required of ["!state.audio.studyBusy)advanceNarration()","window.HobahNativeAudio||state.audio.studyBusy","window.HobahNativeAudio.play({text:part,mode:'normal',title:'Study AI'"]){if(!app.includes(required))throw new Error('Release83 native integration missing '+required)}
await writeFile(appPath,app);
console.log('Hobah Release 83 native Study audio events isolated from Scripture queue');
