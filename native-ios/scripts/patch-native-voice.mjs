import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appPath=path.join(root,'www','app.js');
let app=await readFile(appPath,'utf8');

if(!app.includes('HOBAH_LISTEN_V2=true'))throw new Error('Native Voice packaging requires the Release 81 Listen rebuild');

// Release 81 owns the complete Listen/Voice state machine in app.js. Native packaging
// must not replace those functions again. It only waits for the native bridges before
// bootstrapping so the first Voice Commands tap always sees a fully registered plugin.
const bootstrapTwo="Promise.allSettled([Promise.resolve(window.HobahNativeReady),Promise.resolve(window.HobahNativeAudioReady)]).finally(()=>bootstrap());";
const bootstrapThree="Promise.allSettled([Promise.resolve(window.HobahNativeReady),Promise.resolve(window.HobahNativeAudioReady),Promise.resolve(window.HobahNativeVoiceReady)]).finally(()=>bootstrap());";
if(app.includes(bootstrapTwo))app=app.replace(bootstrapTwo,bootstrapThree);

for(const required of [
  'HOBAH_LISTEN_V2=true',
  'openListenPanelForChapter',
  'startNativeListenSession',
  'hobah:native-voice-transcript',
  'hobah:native-voice-ready',
  'voiceWanted',
  'save that',
  'explain that'
]){
  if(!app.includes(required))throw new Error('Release 81 native Voice integration missing '+required);
}

await writeFile(appPath,app);
console.log('Hobah Release 81 native packaging: Listen state machine preserved intact');
