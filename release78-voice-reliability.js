const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release78: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const replaceRange=(start,end,replacement,label)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);if(a<0||b<0)throw new Error('Release78 patch missing: '+label);app=app.slice(0,a)+replacement+app.slice(b)};
if(!app.includes("const V='77';"))throw new Error('Release78 patch missing: runtime version');
app=app.replace("const V='77';","const V='78';");

replaceRange(
  '  async function applyNarratorSelection(choice){',
  "  $('#audioRate').onchange=",
`  let narratorTouchAt=0;
  async function applyNarratorSelection(choice){
    choice=choice==='male'?'male':'female';
    const previous=selectedNarrator(),label=choice==='male'?'Deep male':'Female';
    // Update the UI and preference synchronously. Native cache work must never make
    // the selector look dead on iPhone.
    localSet('hobah:ttsVoice',choice);ttsCache.clear();ttsInFlight.clear();syncAudioSettings();
    setAudioStatus(label+' voice selected');toast(label+' voice selected');
    if(window.HobahNative?.savePreferences)window.HobahNative.savePreferences().catch(()=>{});
    if(window.HobahNativeAudio)window.HobahNativeAudio.clearCache().catch(e=>console.warn('Native voice cache clear',e));
    if(previous===choice)return;
    const wasPlaying=!!state.audio.playing,wasPaused=!!state.audio.paused;
    if((wasPlaying||wasPaused)&&!state.audio.studyBusy&&state.audio.items.length){
      setAudioStatus(label+' voice • switching…');
      if(window.HobahNativeAudio){
        await Promise.race([window.HobahNativeAudio.stop().catch(()=>{}),sleep(650)]);
      }else{
        const a=ensureScriptureAudio();try{a.pause();a.removeAttribute('src');a.load()}catch{}
      }
      state.audio.playing=false;state.audio.paused=wasPaused;state.audio.stopped=false;
      if(wasPlaying)await playNarrationItem();else{setAudioPlay('▶');setAudioStatus(label+' voice selected')}
    }
  }
  function chooseNarratorButton(b){if(!b)return;applyNarratorSelection(b.dataset.ttsVoice).catch(e=>{console.warn('Voice switch',e);toast('Could not switch voice')})}
  $$('[data-tts-voice]').forEach(b=>{
    b.type='button';
    b.onpointerup=e=>{if(e.pointerType==='touch'){narratorTouchAt=Date.now();e.preventDefault();chooseNarratorButton(b)}};
    b.onclick=()=>{if(Date.now()-narratorTouchAt<450)return;chooseNarratorButton(b)};
  });
  let voiceToggleTouchAt=0;const voiceToggle=$('#audioVoiceToggle');
  voiceToggle.onpointerup=e=>{if(e.pointerType==='touch'){voiceToggleTouchAt=Date.now();e.preventDefault();toggleVoiceCommands()}};
  voiceToggle.onclick=()=>{if(Date.now()-voiceToggleTouchAt<450)return;toggleVoiceCommands()};
  `,
  'iPhone narrator and voice-command controls'
);
app=app.replace("  $('#audioVoiceToggle').onclick=toggleVoiceCommands;$('#audioAmbient').onclick=toggleAmbient;","  $('#audioAmbient').onclick=toggleAmbient;");

replaceRange(
  "let lastVoice='',lastVoiceAt=0;",
  '\nfunction ensureAmbient(){',
`let lastVoice='',lastVoiceAt=0;
const voicePhraseMap=[
  ['explain','explain that in more detail'],['explain','explain this in more detail'],['explain','what does that mean'],['explain','explain that more'],['explain','explain this more'],['explain','explain that'],['explain','explain this'],['explain','tell me more'],['explain','go deeper'],
  ['save','save that to my notes'],['save','save this to my notes'],['save','save this in my notes'],['save','save that in my notes'],['save','save this explanation'],['save','save that explanation'],['save','save to my notes'],['save','save that'],['save','save this'],['save','save it'],
  ['pause','stop reading'],['pause','pause reading'],['pause','hold on'],['pause','stop'],['pause','pause'],
  ['play','keep reading'],['play','continue reading'],['play','carry on'],['play','continue'],['play','resume'],['play','play'],
  ['next','next verse'],['next','next section'],['next','go next'],['next','next'],
  ['prev','previous verse'],['prev','go previous'],['prev','go back'],['prev','previous'],['prev','back']
];
function normalizeVoiceText(text){return clean(text).toLowerCase().replace(/[^a-z\\s']/g,' ').replace(/\\s+/g,' ').trim()}
function extractVoiceCommand(text){
  let t=normalizeVoiceText(text);if(!t)return null;
  t=t.replace(/\\b(?:hey\\s+)?(?:hobah|hoba|ho bah|oba)\\b/g,' ').replace(/\\s+/g,' ').trim();
  t=t.replace(/^please\\s+/,'').replace(/\\s+please$/,'').trim();
  for(const [kind,phrase] of voicePhraseMap){
    if(t===phrase||t.endsWith(' '+phrase))return {kind,phrase};
  }
  return null;
}
function handleVoice(text,final){
  if(state.audio.suppressRecognition)return;
  const found=extractVoiceCommand(text);
  if(!found){if(final)setAudioStatus('Listening • say explain that, save that, stop, or play');return}
  const now=Date.now(),token=found.kind+':'+found.phrase;if(now-lastVoiceAt<650&&token===lastVoice)return;
  lastVoice=token;lastVoiceAt=now;setAudioStatus('Heard “'+found.phrase+'”');
  if(found.kind==='explain'){explainCurrent();return}
  if(found.kind==='save'){saveStudyExplanation();return}
  if(state.audio.studyBusy)return;
  if(found.kind==='pause'){pauseNarration();return}
  if(found.kind==='play'){resumeNarration();return}
  if(found.kind==='next'){jumpNarration(1);return}
  if(found.kind==='prev'){jumpNarration(-1);return}
}
document.addEventListener('hobah:native-voice-command',e=>{
  if(!state.listening||state.audio.suppressRecognition)return;
  const command=e.detail?.command||e.detail?.text;if(command)handleVoice(command,true);
});
`,
  'running-transcript command parser'
);

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=77','/styles.css?v=78').replace('/app.js?v=77','/app.js?v=78').replace('/manifest.webmanifest?v=77','/manifest.webmanifest?v=78');
fs.writeFileSync(p('index.html'),html);
fs.appendFileSync(p('styles.css'),`\n/* Hobah Release 78 — immediate touch feedback for Listen controls */\n.audioModes [data-tts-voice],#audioVoiceToggle{touch-action:manipulation!important;-webkit-tap-highlight-color:rgba(13,76,63,.12)}.audioModes [data-tts-voice]:active,#audioVoiceToggle:active{transform:scale(.97)}\n`);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=78#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 78: tail-command recognition + synchronous iPhone narrator controls applied');
