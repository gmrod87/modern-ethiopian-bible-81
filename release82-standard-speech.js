const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='82',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release82: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release82 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='81';","const V='82';",'runtime version');
swap(
"  for(let i=0;i<8;i++){\n    if(generation!==listenVoiceGeneration||!state.audio.voiceWanted||state.audio.suppressRecognition)return false;\n    const s=await window.HobahNativeVoice.getState().catch(()=>null);\n    if(s?.listening){state.listening=true;syncAudioUI();setAudioStatus(voiceReadyStatus());return true}\n    await sleep(90);\n  }",
"  for(let i=0;i<30;i++){\n    if(generation!==listenVoiceGeneration||!state.audio.voiceWanted||state.audio.suppressRecognition)return false;\n    const s=await window.HobahNativeVoice.getState().catch(()=>null);\n    if(s?.listening){state.listening=true;syncAudioUI();setAudioStatus(voiceReadyStatus());return true}\n    if(s?.lastTranscript){state.listening=true;syncAudioUI();setAudioStatus(voiceReadyStatus());handleVoice(clean(s.lastTranscript).toLowerCase(),false);return true}\n    await sleep(100);\n  }",
'physical-device voice startup window'
);
swap(
"  if(!existing?.listening)await window.HobahNativeVoice.start({locale:'en-AU',continuous:true});",
"  if(!existing?.listening)await window.HobahNativeVoice.start({locale:'en-AU'});",
'standard native speech start'
);
swap(
`document.addEventListener('hobah:native-voice-transcript',e=>{
  if(!window.HobahNativeVoice||!state.audio.voiceWanted||!state.listening||state.audio.suppressRecognition)return;
  const text=clean(e.detail?.text).toLowerCase();if(text)handleVoice(text,!!e.detail?.final);
});`,
`document.addEventListener('hobah:native-voice-transcript',e=>{
  if(!window.HobahNativeVoice||!state.audio.voiceWanted||state.audio.suppressRecognition)return;
  const text=clean(e.detail?.text).toLowerCase();if(!text)return;
  state.listening=true;syncAudioUI();handleVoice(text,!!e.detail?.final);
});`,
'accept transcript before listening-state event'
);

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=81','/styles.css?v=82').replace('/app.js?v=81','/app.js?v=82').replace('/manifest.webmanifest?v=81','/manifest.webmanifest?v=82');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=82#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ["const V='82';","window.HobahNativeVoice.start({locale:'en-AU'})","state.listening=true;syncAudioUI();handleVoice(text"]){if(!app.includes(required))throw new Error('Release82 integration missing '+required)}
if(app.includes('continuous:true'))throw new Error('Release82 still contains continuous voice start flag');
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 82: stock speech sessions + transcript-first command delivery; Listen visuals unchanged');
