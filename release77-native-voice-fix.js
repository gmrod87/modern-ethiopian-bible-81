const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='77',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release77: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release77 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='76';","const V='77';",'runtime version');

swap(
"  const narrator=selectedNarrator();$$('[data-tts-voice]').forEach(b=>b.classList.toggle('active',b.dataset.ttsVoice===narrator));",
"  const narrator=selectedNarrator();$$('[data-tts-voice]').forEach(b=>{const active=b.dataset.ttsVoice===narrator;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')});",
'voice toggle state'
);

swap(
"  $$('[data-tts-voice]').forEach(b=>b.onclick=()=>{localSet('hobah:ttsVoice',b.dataset.ttsVoice);ttsCache.clear();ttsInFlight.clear();syncAudioSettings();toast(`${b.dataset.ttsVoice==='male'?'Deep male':'Female'} voice selected`)});",
`  async function applyNarratorSelection(choice){
    choice=choice==='male'?'male':'female';
    const previous=selectedNarrator(),label=choice==='male'?'Deep male':'Female';
    localSet('hobah:ttsVoice',choice);ttsCache.clear();ttsInFlight.clear();
    if(window.HobahNativeAudio)await window.HobahNativeAudio.clearCache().catch(()=>{});
    syncAudioSettings();
    if(previous===choice){toast(label+' voice selected');return}
    const wasPlaying=!!state.audio.playing,wasPaused=!!state.audio.paused;
    if((wasPlaying||wasPaused)&&!state.audio.studyBusy&&state.audio.items.length){
      setAudioStatus(label+' voice • switching…');
      if(window.HobahNativeAudio)await window.HobahNativeAudio.stop().catch(()=>{});
      else{const a=ensureScriptureAudio();try{a.pause();a.removeAttribute('src');a.load()}catch{}}
      state.audio.playing=false;state.audio.paused=wasPaused;state.audio.stopped=false;
      if(wasPlaying)await playNarrationItem();else{setAudioPlay('▶');setAudioStatus(label+' voice selected')}
    }else toast(label+' voice selected');
  }
  $$('[data-tts-voice]').forEach(b=>{b.type='button';b.onclick=()=>applyNarratorSelection(b.dataset.ttsVoice).catch(e=>{console.warn('Voice switch',e);toast('Could not switch voice')})});`,
'immediate narrator switch'
);

fs.writeFileSync(p('app.js'),app);

let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('<button data-tts-voice="female">Female</button>','<button type="button" data-tts-voice="female" aria-pressed="false">Female</button>');
html=html.replace('<button data-tts-voice="male">Male</button>','<button type="button" data-tts-voice="male" aria-pressed="false">Male</button>');
html=html.replace('/styles.css?v=76','/styles.css?v=77').replace('/app.js?v=76','/app.js?v=77').replace('/manifest.webmanifest?v=76','/manifest.webmanifest?v=77');
fs.writeFileSync(p('index.html'),html);

fs.appendFileSync(p('styles.css'),`\n/* Hobah Release 77 — tactile narrator selector */\n.audioModes [data-tts-voice]{touch-action:manipulation!important;cursor:pointer!important;pointer-events:auto!important}.audioModes [data-tts-voice][aria-pressed=\"true\"]{box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)!important}\n`);

if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=77#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 77: native microphone session preserved + narrator switch applies immediately');