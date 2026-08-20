const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='69',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js')))throw new Error('Release69: dist/app.js missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{
  if(!app.includes(from))throw new Error('Release69 patch missing: '+label);
  app=app.replace(from,()=>to);
};

swap("const V='68';","const V='69';",'runtime version');

swap(
"function ensureScriptureAudio(){",
`function claimVoiceChannel(active){
  document.querySelectorAll('audio').forEach(el=>{
    if(el!==active&&!el.paused){try{el.pause()}catch{}}
  });
  try{window.speechSynthesis?.cancel()}catch{}
}
function suspendRecognitionForStudy(){
  if(!state.listening)return;
  state.audio.voiceWasListening=true;
  state.audio.suppressRecognition=true;
  try{state.recognition?.abort()}catch{}
}
function resumeRecognitionAfterStudy(){
  const shouldRestart=!!state.audio.voiceWasListening;
  state.audio.voiceWasListening=false;
  state.audio.suppressRecognition=false;
  if(!shouldRestart||!state.listening)return;
  setTimeout(()=>{if(state.listening&&!state.audio.suppressRecognition){try{state.recognition?.start()}catch{}}},60);
}
function ensureScriptureAudio(){`,
'exclusive voice helpers'
);

swap(
"    const blob=await getSpeechBlob(item.text),url=URL.createObjectURL(blob);",
"    const blob=await getSpeechBlob(item.text),url=URL.createObjectURL(blob);claimVoiceChannel(a);",
'scripture claims audio channel'
);

swap(
"    await a.play();",
"    claimVoiceChannel(a);await a.play();",
'scripture play remains exclusive'
);

swap(
"        url=URL.createObjectURL(blob);sa.src=url;sa.load();\n        await new Promise((resolve,reject)=>{sa.onended=resolve;sa.onerror=reject;sa.play().catch(reject)});",
"        url=URL.createObjectURL(blob);sa.src=url;sa.load();claimVoiceChannel(sa);\n        await new Promise((resolve,reject)=>{sa.onended=resolve;sa.onerror=reject;claimVoiceChannel(sa);sa.play().catch(reject)});",
'study voice claims audio channel'
);

swap(
`async function explainCurrent(){
  if(!state.currentBook||!state.currentChapter){toast('Open a chapter first');return}
  const a=ensureScriptureAudio();if(!a.paused)a.pause();state.audio.resumeAfterStudy=true;
  const v=currentAudioVerse(),ref=\`${'${state.currentBook.title}'} ${'${state.currentChapter.n}'}:${'${v}'}\`;
  setAudioStatus(\`Explaining ${'${ref}'}…\`);state.studyMode='study';
  const ans=await askStudy(\`Explain ${'${ref}'} in more detail. Focus on what is happening in this verse and why it matters in its immediate context.\`,{speak:true,autoResume:true,quick:true});
  return ans;
}`,
`async function explainCurrent(){
  if(!state.currentBook||!state.currentChapter){toast('Open a chapter first');return}
  if(state.audio.studyBusy)return;
  state.audio.studyBusy=true;suspendRecognitionForStudy();
  const a=ensureScriptureAudio();if(!a.paused)a.pause();claimVoiceChannel(null);state.audio.resumeAfterStudy=true;
  const v=currentAudioVerse(),ref=\`${'${state.currentBook.title}'} ${'${state.currentChapter.n}'}:${'${v}'}\`;
  setAudioStatus(\`Explaining ${'${ref}'}…\`);state.studyMode='study';
  try{
    return await askStudy(\`Explain ${'${ref}'} in more detail. Focus on what is happening in this verse and why it matters in its immediate context.\`,{speak:true,autoResume:false,quick:true});
  }finally{
    state.audio.studyBusy=false;resumeScriptureAfterStudy();resumeRecognitionAfterStudy();
  }
}`,
'single-flight study explanation'
);

swap(
"function resumeNarration(){const a=ensureScriptureAudio();if(a.src)a.play().catch(()=>{});else playNarrationItem()}",
"function resumeNarration(){if(state.audio.studyBusy)return;const a=ensureScriptureAudio();claimVoiceChannel(a);if(a.src)a.play().catch(()=>{});else playNarrationItem()}",
'guard scripture resume during study'
);

swap(
"function jumpNarration(d){\n  if(!state.audio.items.length)return;const a=ensureScriptureAudio();a.pause();state.audio.index=Math.max(0,Math.min(state.audio.items.length-1,state.audio.index+d));playNarrationItem();\n}",
"function jumpNarration(d){\n  if(state.audio.studyBusy||!state.audio.items.length)return;const a=ensureScriptureAudio();a.pause();state.audio.index=Math.max(0,Math.min(state.audio.items.length-1,state.audio.index+d));playNarrationItem();\n}",
'guard jumps during study'
);

swap(
"    r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const text=clean(e.results[i][0]?.transcript).toLowerCase();if(text)handleVoice(text,e.results[i].isFinal)}};",
"    r.onresult=e=>{if(state.audio.suppressRecognition)return;for(let i=e.resultIndex;i<e.results.length;i++){const text=clean(e.results[i][0]?.transcript).toLowerCase();if(text)handleVoice(text,e.results[i].isFinal)}};",
'ignore recognition while Study AI is speaking'
);

swap(
"    r.onend=()=>{if(state.listening)setTimeout(()=>{try{r.start()}catch{}},25)};",
"    r.onend=()=>{if(state.listening&&!state.audio.suppressRecognition)setTimeout(()=>{try{r.start()}catch{}},25)};",
'do not restart mic into Study AI output'
);

swap(
`function handleVoice(text,final){
  const now=Date.now();if(now-lastVoiceAt<650&&(text===lastVoice||text.startsWith(lastVoice)||lastVoice.startsWith(text)))return;
  const hit=(...xs)=>xs.some(x=>text.includes(x));
  if(hit('explain','what does that mean','go deeper')){lastVoice=text;lastVoiceAt=now;explainCurrent();return}
  if(hit('stop','pause')){lastVoice=text;lastVoiceAt=now;pauseNarration();return}
  if(hit('continue','resume','play')){lastVoice=text;lastVoiceAt=now;resumeNarration();return}
  if(hit('next')){lastVoice=text;lastVoiceAt=now;jumpNarration(1);return}
  if(hit('previous','back')){lastVoice=text;lastVoiceAt=now;jumpNarration(-1);return}
  if(final)setAudioStatus('Listening • say stop, play, continue, or explain that');
}`,
`function handleVoice(text,final){
  if(state.audio.suppressRecognition)return;
  const now=Date.now(),t=clean(text).toLowerCase().replace(/[^a-z\\s']/g,'').replace(/\\s+/g,' ').trim();
  if(now-lastVoiceAt<650&&(t===lastVoice||t.startsWith(lastVoice)||lastVoice.startsWith(t)))return;
  const explain=/^(explain that|explain this|explain that in more detail|explain this in more detail|what does that mean|go deeper)$/i.test(t);
  const pause=/^(stop|pause|stop reading|pause reading)$/i.test(t);
  const play=/^(continue|resume|play|keep reading|continue reading)$/i.test(t);
  const next=/^(next|next verse|next section)$/i.test(t);
  const prev=/^(previous|previous verse|go back|back)$/i.test(t);
  if(!(explain||pause||play||next||prev)){if(final)setAudioStatus('Listening • say stop, play, continue, or explain that');return}
  lastVoice=t;lastVoiceAt=now;
  if(explain){explainCurrent();return}
  if(state.audio.studyBusy)return;
  if(pause){pauseNarration();return}
  if(play){resumeNarration();return}
  if(next){jumpNarration(1);return}
  if(prev){jumpNarration(-1);return}
}`,
'strict anti-echo voice commands'
);

swap(
"function stopNarration(){\n  state.audio.stopped=true;const a=ensureScriptureAudio();a.pause();",
"function stopNarration(){\n  state.audio.stopped=true;state.audio.studyBusy=false;state.audio.suppressRecognition=false;state.audio.voiceWasListening=false;const a=ensureScriptureAudio();a.pause();try{state.audio.studyAudio?.pause()}catch{}try{window.speechSynthesis?.cancel()}catch{};",
'stop all app voice outputs'
);

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=68','/styles.css?v=69').replace('/app.js?v=68','/app.js?v=69').replace('/manifest.webmanifest?v=68','/manifest.webmanifest?v=69');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=69#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 69: exclusive one-voice audio channel and anti-echo voice commands applied');
