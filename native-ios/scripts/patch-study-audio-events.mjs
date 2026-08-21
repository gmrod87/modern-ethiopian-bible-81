import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const appPath=path.resolve(here,'..','www','app.js');
let app=await readFile(appPath,'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release90 native patch missing: '+label);app=app.replace(from,to)};

swap(
  "document.addEventListener('hobah:native-audio-ended',()=>{if(window.HobahNativeAudio&&!state.audio.stopped)advanceNarration()});",
  "document.addEventListener('hobah:native-audio-ended',e=>{if(e.detail?.channel==='study')return;if(window.HobahNativeAudio&&!state.audio.stopped&&!state.audio.studyBusy)advanceNarration()});",
  'channel-aware native ended handler'
);
swap(
  "document.addEventListener('hobah:native-audio-state',e=>{if(!window.HobahNativeAudio)return;const playing=!!e.detail?.playing;state.audio.playing=playing;state.audio.paused=!playing&&!state.audio.stopped;syncAudioUI()});",
  "document.addEventListener('hobah:native-audio-state',e=>{if(!window.HobahNativeAudio||e.detail?.channel==='study'||state.audio.studyBusy)return;const playing=!!e.detail?.playing;state.audio.playing=playing;state.audio.paused=!playing&&!state.audio.stopped;syncAudioUI()});",
  'channel-aware native state handler'
);

for(const required of ["e.detail?.channel==='study'","channel:'study'",'voice90WaitNativeStudyEnd'])if(!app.includes(required))throw new Error('Release90 native integration missing '+required);
await writeFile(appPath,app);
console.log('Hobah Release 90 native Study and Scripture audio events are isolated by channel');
