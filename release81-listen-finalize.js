const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const p=f=>path.join('dist',f);
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes('HOBAH_LISTEN_V2=true'))throw new Error('Release81 finalize: Listen V2 missing');

// The old postbuild chain placed these helpers between narration setup and the audio
// element. Release 81 replaces that whole block, so restore the handoff explicitly.
if(!app.includes('function suspendRecognitionForStudy(){')){
  const marker='function ensureScriptureAudio(){';
  if(!app.includes(marker))throw new Error('Release81 finalize: audio element entrypoint missing');
  const handoff=`function suspendRecognitionForStudy(){
  if(!state.audio.voiceWanted&&!state.listening)return;
  state.audio.voiceWasListening=!!state.audio.voiceWanted;
  state.audio.suppressRecognition=true;state.listening=false;syncAudioUI();
  if(window.HobahNativeVoice)window.HobahNativeVoice.stop().catch(()=>{});
  else try{state.recognition?.abort()}catch{}
}
function resumeRecognitionAfterStudy(){
  const shouldRestart=!!state.audio.voiceWasListening;
  state.audio.voiceWasListening=false;state.audio.suppressRecognition=false;
  if(!shouldRestart||!state.audio.voiceWanted)return;
  if(window.HobahNativeVoice){scheduleListenVoiceRestart();return}
  setTimeout(()=>{if(state.audio.voiceWanted&&!state.audio.suppressRecognition){try{state.recognition?.start()}catch{}}},100);
}
`;
  app=app.replace(marker,handoff+marker);
}

app=app.replace(
  "      const s=await window.HobahNativeVoice?.getState?.().catch(()=>null);",
  "      const s=window.HobahNativeVoice?await window.HobahNativeVoice.getState().catch(()=>null):null;"
);
app=app.replace(
  "  await stopVoiceCommands({silent:true}).catch(()=>{});\n  const items=await listenItemsForChapter(b,c);",
  "  stopVoiceCommands({silent:true}).catch(()=>{});\n  const items=await listenItemsForChapter(b,c);"
);
app=app.replace(
  "  await stopVoiceCommands({silent:true}).catch(()=>{});\n  prepareListenQueue(b,c,buildVerseItems([v]),0);",
  "  stopVoiceCommands({silent:true}).catch(()=>{});\n  prepareListenQueue(b,c,buildVerseItems([v]),0);"
);

for(const required of ['function suspendRecognitionForStudy(){','function resumeRecognitionAfterStudy(){','Ready • press play or turn on Voice Commands'])if(!app.includes(required))throw new Error('Release81 finalize missing '+required);
fs.writeFileSync(p('app.js'),app);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 81 finalized: Study AI voice handoff preserved; Listen visuals untouched');
