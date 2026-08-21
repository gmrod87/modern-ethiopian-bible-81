const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release89: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='88';"))throw new Error('Release89: runtime version 88 not found');
app=app.replace("const V='88';","const V='89';");

// Voice-triggered Study AI starts after an async network response. On iOS Safari/PWA,
// media playback can be rejected because the original voice command is not a user gesture.
// Unlock the exact hidden Study AI <audio> element on the user's next normal tap, then
// reuse that same element for every later Explain That response.
const speechMarker='function browserSpeakStudyPart(text){';
if(!app.includes(speechMarker))throw new Error('Release89: browser Study speech marker not found');
const unlock=`function ensureStudyNarrationAudio(){
  let sa=state.audio.studyAudio;
  if(!sa){
    sa=document.createElement('audio');sa.hidden=true;sa.className='studyAudio';sa.setAttribute('playsinline','');sa.preload='auto';document.body.appendChild(sa);state.audio.studyAudio=sa;
  }
  return sa;
}
function primeStudyNarration(){
  if(state.audio.studyPlaybackUnlocked||state.audio.studyBusy)return;
  const sa=ensureStudyNarrationAudio();
  try{
    const oldVolume=sa.volume;
    sa.volume=.001;
    sa.src='data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    sa.load();
    const started=sa.play();
    Promise.resolve(started).then(()=>{
      state.audio.studyPlaybackUnlocked=true;
      setTimeout(()=>{try{sa.pause();sa.currentTime=0;sa.volume=oldVolume}catch{}},35);
    }).catch(()=>{try{sa.volume=oldVolume}catch{}});
  }catch{}
}
if(!window.__hobahStudyNarrationPrimer){
  window.__hobahStudyNarrationPrimer=true;
  document.addEventListener('pointerdown',primeStudyNarration,{capture:true,passive:true});
  document.addEventListener('touchstart',primeStudyNarration,{capture:true,passive:true});
  document.addEventListener('keydown',primeStudyNarration,{capture:true});
}
${speechMarker}`;
app=app.replace(speechMarker,unlock);

// Reuse the primed element instead of creating a fresh, still-locked media element later.
const oldAudio="  let sa=state.audio.studyAudio;if(!sa){sa=document.createElement('audio');sa.hidden=true;sa.className='studyAudio';sa.setAttribute('playsinline','');document.body.appendChild(sa);state.audio.studyAudio=sa}";
const newAudio="  let sa=ensureStudyNarrationAudio();";
if(!app.includes(oldAudio))throw new Error('Release89: Study narration audio creation block not found');
app=app.replace(oldAudio,newAudio);

// If iOS still rejects the natural-voice media play, immediately use the system voice
// fallback rather than leaving Explain That silent. The existing fallback already waits
// for completion, so Scripture resumes only after the explanation has actually been read.
const oldPlay="          sa.onended=()=>finish();sa.onerror=()=>finish(new Error('Study audio chunk failed'));claimVoiceChannel(sa);sa.play().catch(finish);";
const newPlay="          sa.onended=()=>finish();sa.onerror=()=>finish(new Error('Study audio chunk failed'));claimVoiceChannel(sa);\n          const playPromise=sa.play();if(playPromise&&typeof playPromise.catch==='function')playPromise.catch(err=>finish(err));";
if(!app.includes(oldPlay))throw new Error('Release89: Study audio play block not found');
app=app.replace(oldPlay,newPlay);

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/app.js?v=88','/app.js?v=89').replace('/manifest.webmanifest?v=88','/manifest.webmanifest?v=89').replace('/release85-settings.css?v=88','/release85-settings.css?v=89');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=89#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ["const V='89';",'primeStudyNarration','studyPlaybackUnlocked','ensureStudyNarrationAudio','/app.js?v=89'])if(!app.includes(required)&&required!=='/app.js?v=89')throw new Error('Release89 integration missing '+required);
if(!html.includes('/app.js?v=89'))throw new Error('Release89: HTML cache-bust missing');
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 89: Explain That primes iOS/PWA Study audio so AI responses read automatically before Scripture resumes');
