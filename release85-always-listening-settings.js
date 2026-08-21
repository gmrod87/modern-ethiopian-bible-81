const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='85',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release85: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release85 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='84';","const V='85';",'runtime version');

// Listen is playback-only. Voice Commands is a global app setting and must not be
// stopped/restarted just because the Listen dock opens.
app=app.replaceAll("  stopVoiceCommands({silent:true}).catch(()=>{});\n",'');
app=app.replaceAll('Ready • press play or turn on Voice Commands','Ready • press play');
app=app.replace(/ensureStudyRealtime\(\)\.catch\(\(\)=>\{\}\);?/g,'');
app=app.replace("$('#audioVoiceToggle').onclick=toggleVoiceCommands;",'');

// Replace the stream-based voice explanation request with one deterministic JSON request.
const requestRe=/async function requestVoiceExplanation\(question\)\{[\s\S]*?\n\}\nasync function explainCurrent/;
if(!requestRe.test(app))throw new Error('Release85 patch missing: old voice explanation request');
app=app.replace(requestRe,()=>`async function requestVoiceExplanationJSON(question,reference){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),16000);
  state.audio.studyRequestAbort=ctl;state.audio.studyCancelReason='';
  const explainURL=(window.HOBAH_API_BASE?window.HOBAH_API_BASE.replace(/\\/$/,''):'')+'/api/explain';
  try{
    const r=await fetch(explainURL,{method:'POST',headers:{'content-type':'application/json'},signal:ctl.signal,body:JSON.stringify({question,reference,context:quickStudyContext()})});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Study AI unavailable')}
    const j=await r.json(),answer=compactStudyAnswer(clean(j.answer),300);
    if(!answer)throw Error('Study AI returned no explanation');
    return answer;
  }catch(e){
    if(e?.name==='AbortError')throw Error(state.audio.studyCancelReason==='user'?'Study explanation cancelled':'Study AI took too long to respond');
    throw e;
  }finally{
    clearTimeout(timer);if(state.audio.studyRequestAbort===ctl)state.audio.studyRequestAbort=null;
  }
}
async function explainCurrent`);

const explainRe=/async function explainCurrent\(\)\{[\s\S]*?\n\}\nasync function narrateStudyAnswer/;
if(!explainRe.test(app))throw new Error('Release85 patch missing: explainCurrent');
app=app.replace(explainRe,()=>`async function explainCurrent(){
  if(!state.currentBook||!state.currentChapter){toast('Open a chapter first');return}
  if(state.audio.studyBusy){abortStudyRequest('recover');state.audio.studyBusy=false;setStudyPhase('idle');if(window.HobahNativeAudio)await window.HobahNativeAudio.stop().catch(()=>{})}
  const wasPlaying=!!state.audio.playing;
  state.audio.studyBusy=true;setStudyPhase('generating');
  const v=currentAudioVerse(),ref=\`${'${state.currentBook.title}'} ${'${state.currentChapter.n}'}:${'${v}'}\`;
  const displayQuestion=\`Explain ${'${ref}'}\`;
  const requestQuestion=\`Explain ${'${ref}'} in more detail. Focus on what is happening in this verse, its immediate literary context, and why it matters. Give a complete spoken explanation with no preamble. Aim for 220 to 270 words and never exceed 300 words. End with a complete sentence.\`;
  setAudioStatus(\`Explaining ${'${ref}'}…\`);state.studyMode='study';
  // Start the network request before touching the microphone/audio session.
  const answerPromise=requestVoiceExplanationJSON(requestQuestion,ref);
  const a=ensureScriptureAudio();if(!a.paused)a.pause();claimVoiceChannel(null);state.audio.resumeAfterStudy=true;
  state.audio.resumeAfterStudy=wasPlaying;
  suspendRecognitionForStudy();closeStudyRealtime();
  try{
    const ans=await answerPromise;
    state.studyHistory.push({role:'user',text:displayQuestion},{role:'assistant',text:ans});
    rememberStudyAnswer(ans,displayQuestion,ref);
    setAudioStatus('Study AI • reading explanation');
    await narrateStudyAnswer(ans,false);
    return ans;
  }catch(e){
    const cancelled=/cancelled/i.test(e?.message||'');console.warn('Voice Study AI explanation',e);
    if(!cancelled){setAudioStatus('Study AI could not explain that');toast(e?.message||'Study AI unavailable')}
    return'';
  }finally{
    abortStudyRequest('cleanup');state.audio.studyBusy=false;setStudyPhase('idle');
    if(state.audio.resumeAfterStudy)resumeScriptureAfterStudy();else state.audio.resumeAfterStudy=false;
    resumeRecognitionAfterStudy();
  }
}
async function narrateStudyAnswer`);

// Settings and global always-on voice preference.
const settingsMarker='function updateHeart(){';
if(!app.includes(settingsMarker))throw new Error('Release85 patch missing: settings insertion point');
const settingsBlock=`function voicePreferenceEnabled(){return localGet('hobah:voiceCommands','1')!=='0'}
function nightModeEnabled(){return localGet('hobah:nightMode','0')==='1'}
function applyNightMode(on=nightModeEnabled()){
  on=!!on;document.documentElement.classList.toggle('nightMode',on);document.body.classList.toggle('nightMode',on);
  localSet('hobah:nightMode',on?'1':'0');Promise.resolve(window.HobahNative?.setNightMode?.(on)).catch(()=>{});Promise.resolve(window.HobahNative?.savePreferences?.()).catch(()=>{});
}
function syncSettingsVoiceUI(){
  const enabled=voicePreferenceEnabled(),live=!!state.listening;
  const input=$('#settingsVoiceEnabled');if(input)input.checked=enabled;
  const text=$('#settingsVoiceStatus');if(text)text.textContent=enabled?(live?'On • listening':'On • reconnecting automatically'):'Off';
  const dot=$('#settingsVoiceDot');if(dot)dot.classList.toggle('live',enabled&&live);
}
async function setPersistentVoiceEnabled(on){
  localSet('hobah:voiceCommands',on?'1':'0');Promise.resolve(window.HobahNative?.savePreferences?.()).catch(()=>{});
  if(on){await ensurePersistentVoice()}else{await stopVoiceCommands({silent:true});state.audio.voiceWanted=false;state.listening=false;syncAudioUI()}
  syncSettingsVoiceUI();
}
async function ensurePersistentVoice(){
  if(!voicePreferenceEnabled()){
    if(state.audio.voiceWanted||state.listening)await stopVoiceCommands({silent:true});
    syncSettingsVoiceUI();return;
  }
  if(state.audio.suppressRecognition)return;
  if(!state.audio.voiceWanted){await startVoiceCommands();syncSettingsVoiceUI();return}
  if(window.HobahNativeVoice){
    const s=await window.HobahNativeVoice.getState().catch(()=>null);
    if(s?.listening){state.listening=true;syncAudioUI();syncSettingsVoiceUI();return}
    scheduleListenVoiceRestart();syncSettingsVoiceUI();return;
  }
  if(!state.listening){try{state.recognition?.start()}catch{}}
  syncSettingsVoiceUI();
}
function openSettingsExternal(path){
  if(window.HobahNative?.openExternal){Promise.resolve(window.HobahNative.openExternal(path)).catch(()=>{});return}
  try{window.open(path,'_blank','noopener,noreferrer')}catch{location.href=path}
}
function openSettings(){
  $$('.bottomNav button').forEach(b=>b.classList.remove('active'));$('#bottomSettings')?.classList.add('active');
  const body=openSheet('Settings',`<div class="settingsPanel">
    <section class="settingsGroup"><span class="settingsGroupTitle">Voice & listening</span>
      <label class="settingsRow"><span class="settingsText"><b>Voice Commands</b><small id="settingsVoiceStatus">Always listening while Hobah is open</small></span><span class="settingsStatus"><i id="settingsVoiceDot" class="settingsDot"></i><span class="settingsSwitch"><input id="settingsVoiceEnabled" type="checkbox"><span></span></span></span></label>
    </section>
    <section class="settingsGroup"><span class="settingsGroupTitle">Appearance</span>
      <label class="settingsRow"><span class="settingsText"><b>Night Mode</b><small>Use Hobah's dark reading theme.</small></span><span class="settingsSwitch"><input id="settingsNightMode" type="checkbox"><span></span></span></label>
    </section>
    <section class="settingsGroup"><span class="settingsGroupTitle">Hobah</span>
      <button class="settingsRow" id="settingsPrivacy"><span class="settingsText"><b>Privacy & Policies</b><small>Read Hobah's privacy policy.</small></span><span class="settingsChevron">›</span></button>
      <button class="settingsRow" id="settingsSupport"><span class="settingsText"><b>Support</b><small>Help and support information.</small></span><span class="settingsChevron">›</span></button>
      <div class="settingsAbout"><h3>About Hobah</h3><p>Hobah — The Ancient Canon. An 81-book Ethiopian Bible reading, listening, search and Study AI edition for iPhone, iPad and the web.</p></div>
    </section>
  </div>`);
  const voice=$('#settingsVoiceEnabled',body),night=$('#settingsNightMode',body);
  voice.checked=voicePreferenceEnabled();night.checked=nightModeEnabled();syncSettingsVoiceUI();
  voice.onchange=()=>setPersistentVoiceEnabled(voice.checked).catch(e=>{console.warn('Voice setting',e);syncSettingsVoiceUI()});
  night.onchange=()=>applyNightMode(night.checked);
  $('#settingsPrivacy',body).onclick=()=>openSettingsExternal('/privacy.html');
  $('#settingsSupport',body).onclick=()=>openSettingsExternal('/support.html');
}
function initGlobalSettings(){
  applyNightMode(nightModeEnabled());
  setTimeout(()=>ensurePersistentVoice().catch(e=>console.warn('Persistent voice startup',e)),180);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensurePersistentVoice().catch(()=>{})});
document.addEventListener('hobah:native-app-state',e=>{if(e.detail?.isActive)ensurePersistentVoice().catch(()=>{})});

`;
app=app.replace(settingsMarker,settingsBlock+settingsMarker);

swap(
  "  $('#bottomLibrary').onclick=openLibrary;",
  "  $('#bottomLibrary').onclick=openLibrary;$('#bottomSettings').onclick=openSettings;initGlobalSettings();",
  'Settings nav binding'
);

fs.writeFileSync(p('app.js'),app);

let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace(/<button id="audioVoiceToggle"[^>]*>[\s\S]*?<\/button>/,'');
if(!html.includes('id="bottomSettings"'))html=html.replace('</nav>','<button id="bottomSettings"><i>⚙</i><span>Settings</span></button>\n</nav>');
// Native packaging previously injected a fifth About button. A hidden legacy anchor keeps
// that packaging step inert; visible About/Policies now live only inside Settings.
if(!html.includes('id="bottomAbout"'))html=html.replace('</body>','<span id="bottomAbout" hidden aria-hidden="true"></span>\n</body>');
html=html.replace('/styles.css?v=84','/styles.css?v=85').replace('/app.js?v=84','/app.js?v=85').replace('/manifest.webmanifest?v=84','/manifest.webmanifest?v=85');
if(!html.includes('/release85-settings.css'))html=html.replace('</head>',`<link rel="stylesheet" href="/release85-settings.css?v=85">\n<script>try{if(localStorage.getItem('hobah:nightMode')==='1')document.documentElement.classList.add('nightMode')}catch{}</script>\n</head>`);
fs.writeFileSync(p('index.html'),html);
fs.copyFileSync('release85-settings.css',p('release85-settings.css'));
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=85#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const V='85';",'/api/explain','requestVoiceExplanationJSON','id="bottomSettings"','Voice Commands','Night Mode','Privacy & Policies','About Hobah','ensurePersistentVoice','Ready • press play']){
  const target=required.startsWith('id=')||required==='Voice Commands'||required==='Night Mode'||required==='Privacy & Policies'||required==='About Hobah'?html:app;
  if(!target.includes(required))throw new Error('Release85 integration missing '+required);
}
if(html.includes('id="audioVoiceToggle"'))throw new Error('Release85 still contains Listen voice toggle');
if(app.includes("stopVoiceCommands({silent:true}).catch(()=>{});\n  const items=await listenItemsForChapter"))throw new Error('Release85 Listen still stops global voice');
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 85: global always-listening voice + Settings + deterministic Explain That applied');
