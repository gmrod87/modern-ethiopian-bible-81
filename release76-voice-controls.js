const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='76',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release76: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release76 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='75';","const V='76';",'runtime version');

swap(
"const ttsCache=new Map(),ttsInFlight=new Map();\nfunction ttsKey(text,mode){return (mode||'normal')+'|'+clean(text)}",
`function selectedNarrator(){return localGet('hobah:ttsVoice','female')==='male'?'male':'female'}
function selectedVoiceId(){return selectedNarrator()==='male'?'cedar':'marin'}
const ttsCache=new Map(),ttsInFlight=new Map();
function ttsKey(text,mode,voice=selectedVoiceId()){return voice+'|'+(mode||'normal')+'|'+clean(text)}`,
'voice-aware TTS cache'
);

swap(
`async function getSpeechBlob(text,mode=null){
  const resolvedMode=mode||localGet('hobah:audioMode','normal'),key=ttsKey(text,resolvedMode);
  if(ttsCache.has(key))return ttsCache.get(key);
  if(ttsInFlight.has(key))return ttsInFlight.get(key);
  const request=fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:resolvedMode})})
    .then(async r=>{if(!r.ok)throw Error('Natural voice unavailable');return rememberTTS(key,await r.blob())})
    .finally(()=>ttsInFlight.delete(key));
  ttsInFlight.set(key,request);return request;
}`,
`async function getSpeechBlob(text,mode=null){
  const resolvedMode=mode||localGet('hobah:audioMode','normal'),voice=selectedVoiceId(),key=ttsKey(text,resolvedMode,voice);
  if(ttsCache.has(key))return ttsCache.get(key);
  if(ttsInFlight.has(key))return ttsInFlight.get(key);
  const request=fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice,mode:resolvedMode})})
    .then(async r=>{if(!r.ok)throw Error('Natural voice unavailable');return rememberTTS(key,await r.blob())})
    .finally(()=>ttsInFlight.delete(key));
  ttsInFlight.set(key,request);return request;
}`,
'selected narration voice'
);

swap(
"      const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.pitch=1;u.volume=1;\n      const voices=window.speechSynthesis.getVoices?.()||[],v=voices.find(x=>/Samantha|Karen|Daniel|Serena|Moira/i.test(x.name))||voices.find(x=>/^en[-_]/i.test(x.lang));if(v)u.voice=v;",
"      const male=selectedNarrator()==='male',u=new SpeechSynthesisUtterance(text);u.rate=.92;u.pitch=male?.86:1;u.volume=1;\n      const voices=window.speechSynthesis.getVoices?.()||[],preferred=male?/Daniel|Alex|Aaron|Arthur|Tom|Oliver|Lee/i:/Samantha|Karen|Serena|Moira|Ava|Victoria|Zoe/i,v=voices.find(x=>preferred.test(x.name))||voices.find(x=>/^en[-_]/i.test(x.lang));if(v)u.voice=v;",
'browser male/female fallback'
);

const oldVoice=`function handleVoice(text,final){
  if(state.audio.suppressRecognition)return;
  const now=Date.now(),t=clean(text).toLowerCase().replace(/[^a-z\\s']/g,'').replace(/\\s+/g,' ').trim();
  if(now-lastVoiceAt<650&&(t===lastVoice||t.startsWith(lastVoice)||lastVoice.startsWith(t)))return;
  const explain=/^(explain that|explain this|explain that in more detail|explain this in more detail|what does that mean|go deeper)$/i.test(t);
  const save=/^(save that|save this|save that to my notes|save this to my notes|save that to my note|save this to my note|save to my notes|save this in my notes|save that in my notes|save this explanation|save that explanation)$/i.test(t);
  const pause=/^(stop|pause|stop reading|pause reading)$/i.test(t);
  const play=/^(continue|resume|play|keep reading|continue reading)$/i.test(t);
  const next=/^(next|next verse|next section)$/i.test(t);
  const prev=/^(previous|previous verse|go back|back)$/i.test(t);
  if(!(explain||save||pause||play||next||prev)){if(final)setAudioStatus('Listening • say explain that, save that, stop, or play');return}
  lastVoice=t;lastVoiceAt=now;
  if(explain){explainCurrent();return}
  if(save){saveStudyExplanation();return}
  if(state.audio.studyBusy)return;
  if(pause){pauseNarration();return}
  if(play){resumeNarration();return}
  if(next){jumpNarration(1);return}
  if(prev){jumpNarration(-1);return}
}`;
const newVoice=`function handleVoice(text,final){
  if(state.audio.suppressRecognition)return;
  const now=Date.now(),raw=clean(text).toLowerCase().replace(/[^a-z\\s']/g,'').replace(/\\s+/g,' ').trim();
  const t=raw.replace(/^(?:hey\\s+)?(?:hobah|hoba|ho bah|oba)\\s+/i,'').replace(/^please\\s+/i,'').replace(/\\s+please$/i,'').trim();
  if(now-lastVoiceAt<420&&(t===lastVoice||t.startsWith(lastVoice)||lastVoice.startsWith(t)))return;
  const explain=/^(explain that|explain this|explain that more|explain this more|explain that in more detail|explain this in more detail|what does that mean|tell me more|go deeper)$/i.test(t);
  const save=/^(save that|save this|save it|save that to my notes|save this to my notes|save to my notes|save this in my notes|save that in my notes|save this explanation|save that explanation)$/i.test(t);
  const pause=/^(stop|pause|stop reading|pause reading|hold on)$/i.test(t);
  const play=/^(continue|resume|play|keep reading|continue reading|carry on)$/i.test(t);
  const next=/^(next|next verse|next section|go next)$/i.test(t);
  const prev=/^(previous|previous verse|go back|back|go previous)$/i.test(t);
  if(!(explain||save||pause||play||next||prev)){if(final)setAudioStatus('Listening • say explain that, save that, stop, or play');return}
  lastVoice=t;lastVoiceAt=now;
  if(explain){explainCurrent();return}
  if(save){saveStudyExplanation();return}
  if(state.audio.studyBusy)return;
  if(pause){pauseNarration();return}
  if(play){resumeNarration();return}
  if(next){jumpNarration(1);return}
  if(prev){jumpNarration(-1);return}
}`;
swap(oldVoice,newVoice,'natural voice command phrases');

swap(
"  const rate=$('#audioRate');if(rate)rate.value=localGet('hobah:audioRate','1');\n  $('#audioAmbient').classList.toggle('active',localGet('hobah:ambient','0')==='1');",
"  const rate=$('#audioRate');if(rate)rate.value=localGet('hobah:audioRate','1');\n  const narrator=selectedNarrator();$$('[data-tts-voice]').forEach(b=>b.classList.toggle('active',b.dataset.ttsVoice===narrator));\n  $('#audioAmbient').classList.toggle('active',localGet('hobah:ambient','0')==='1');",
'sync narrator toggle'
);

swap(
"  $$('[data-audio-mode]').forEach(b=>b.onclick=()=>{localSet('hobah:audioMode',b.dataset.audioMode);syncAudioSettings();toast(`${b.textContent} context`)});\n  $('#audioRate').onchange=e=>{localSet('hobah:audioRate',e.target.value);if(state.audio.audio)state.audio.audio.playbackRate=+e.target.value};",
"  $$('[data-audio-mode]').forEach(b=>b.onclick=()=>{localSet('hobah:audioMode',b.dataset.audioMode);syncAudioSettings();toast(`${b.textContent} context`)});\n  $$('[data-tts-voice]').forEach(b=>b.onclick=()=>{localSet('hobah:ttsVoice',b.dataset.ttsVoice);ttsCache.clear();ttsInFlight.clear();syncAudioSettings();toast(`${b.dataset.ttsVoice==='male'?'Deep male':'Female'} voice selected`)});\n  $('#audioRate').onchange=e=>{localSet('hobah:audioRate',e.target.value);if(state.audio.audio)state.audio.audio.playbackRate=+e.target.value};",
'bind narrator toggle'
);

fs.writeFileSync(p('app.js'),app);

let html=fs.readFileSync(p('index.html'),'utf8');
const voiceMount='<button data-audio-mode="advanced">Advanced</button><select id="audioRate">';
if(!html.includes(voiceMount))throw new Error('Release76 patch missing: Listen controls');
html=html.replace(voiceMount,'<button data-audio-mode="advanced">Advanced</button><span class="audioVoiceLabel">VOICE</span><button data-tts-voice="female">Female</button><button data-tts-voice="male">Male</button><select id="audioRate">');
html=html.replace('/styles.css?v=75','/styles.css?v=76').replace('/app.js?v=75','/app.js?v=76').replace('/manifest.webmanifest?v=75','/manifest.webmanifest?v=76');
fs.writeFileSync(p('index.html'),html);

fs.appendFileSync(p('styles.css'),`
/* Hobah Release 76 — narrator voice selector */
.audioModes .audioVoiceLabel{font-size:10px!important;letter-spacing:.12em!important;font-weight:900!important;opacity:.72!important;margin-left:4px!important}.audioModes [data-tts-voice].active{background:#0d4c3f!important;color:#f3efe5!important;border-color:#0d4c3f!important}@media(max-width:560px){.audioModes .audioVoiceLabel{width:100%!important;margin:5px 0 0!important}}
`);

if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=76#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 76: reliable natural voice commands + female/deep-male narrator selector applied');
