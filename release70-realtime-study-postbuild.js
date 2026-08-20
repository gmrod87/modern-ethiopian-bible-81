const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='70',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js')))throw new Error('Release70: dist/app.js missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release70 patch missing: '+label);app=app.replace(from,()=>to)};
swap("const V='69';","const V='70';",'runtime version');

const realtimeBlock=[
"let studyRealtime=null;",
"function closeStudyRealtime(){",
"  const rt=studyRealtime;studyRealtime=null;if(!rt)return;",
"  try{if(rt.doneTimer)clearTimeout(rt.doneTimer)}catch{}",
"  try{rt.pending?.reject?.(new Error('Realtime session closed'))}catch{}",
"  try{rt.dc?.close()}catch{}try{rt.pc?.close()}catch{}",
"  try{rt.audio?.pause();rt.audio.srcObject=null}catch{}",
"  try{rt.audio?.remove()}catch{}",
"}",
"async function ensureStudyRealtime(){",
"  if(!('RTCPeerConnection'in window))throw Error('Realtime audio is unavailable');",
"  if(studyRealtime?.dc?.readyState==='open')return studyRealtime;",
"  if(studyRealtime?.promise)return studyRealtime.promise;",
"  const rt={pc:new RTCPeerConnection(),dc:null,audio:document.createElement('audio'),pending:null,promise:null,doneTimer:null};",
"  studyRealtime=rt;rt.audio.autoplay=true;rt.audio.setAttribute('playsinline','');rt.audio.className='studyRealtimeAudio';rt.audio.hidden=true;document.body.appendChild(rt.audio);",
"  rt.pc.addTransceiver('audio',{direction:'recvonly'});",
"  rt.pc.ontrack=e=>{rt.audio.srcObject=e.streams[0];rt.audio.play().catch(()=>{})};",
"  rt.pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(rt.pc.connectionState)&&studyRealtime===rt)closeStudyRealtime()};",
"  rt.dc=rt.pc.createDataChannel('oai-events');",
"  rt.dc.addEventListener('message',e=>{",
"    let ev;try{ev=JSON.parse(e.data)}catch{return}const pending=rt.pending;if(!pending)return;",
"    if(ev.type==='response.output_audio_transcript.delta'&&ev.delta){pending.transcript+=ev.delta;if(!pending.started){pending.started=true;setAudioStatus('Study AI • speaking…')}}",
"    if(ev.type==='error'){const msg=ev.error?.message||'Realtime Study AI failed';rt.pending=null;pending.reject(new Error(msg));return}",
"    if(ev.type==='response.done'){",
"      if(rt.doneTimer)clearTimeout(rt.doneTimer);rt.doneTimer=setTimeout(()=>{if(rt.pending!==pending)return;rt.pending=null;pending.resolve(clean(pending.transcript))},260);",
"    }",
"  });",
"  rt.promise=(async()=>{",
"    const offer=await rt.pc.createOffer();await rt.pc.setLocalDescription(offer);",
"    const r=await fetch('/api/realtime-study',{method:'POST',headers:{'content-type':'application/sdp'},body:offer.sdp});",
"    if(!r.ok)throw Error((await r.text()).slice(0,220)||'Realtime Study AI unavailable');",
"    await rt.pc.setRemoteDescription({type:'answer',sdp:await r.text()});",
"    if(rt.dc.readyState!=='open')await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Realtime connection timed out')),5500);rt.dc.addEventListener('open',()=>{clearTimeout(t);resolve()},{once:true});rt.dc.addEventListener('error',()=>{clearTimeout(t);reject(Error('Realtime connection failed'))},{once:true})});",
"    rt.promise=null;return rt;",
"  })();",
"  try{return await rt.promise}catch(e){if(studyRealtime===rt)closeStudyRealtime();throw e}",
"}",
"async function realtimeStudyExplain(ref){",
"  const rt=await ensureStudyRealtime();if(rt.pending)throw Error('Study AI is already answering');",
"  const ctx=quickStudyContext();",
"  const prompt=['REFERENCE: '+ref,'SCRIPTURE:',String(ctx.scripture||'').slice(0,1800),'SECTION CONTEXT:',String(ctx.sectionContext||'').slice(0,700),'QUESTION: Explain '+ref+' in more detail. Focus on what is happening in this verse and why it matters in its immediate context.'].join('\\n');",
"  claimVoiceChannel(rt.audio);try{await rt.audio.play()}catch{}setAudioStatus('Study AI • live…');const ar=$('#audioRef');if(ar)ar.textContent='Study AI';",
"  return await new Promise((resolve,reject)=>{",
"    const timeout=setTimeout(()=>{if(rt.pending){rt.pending=null;reject(Error('Realtime Study AI timed out'))}},18000);",
"    rt.pending={transcript:'',started:false,resolve:v=>{clearTimeout(timeout);resolve(v)},reject:e=>{clearTimeout(timeout);reject(e)}};",
"    rt.dc.send(JSON.stringify({type:'response.create',response:{conversation:'none',metadata:{kind:'hobah-study'},output_modalities:['audio'],instructions:'Answer immediately with no preamble. Give the direct answer in the first sentence, then only the most useful context. Keep this spoken answer concise, natural, rigorous, and around 120 to 180 words. Do not read verse numbers aloud.',input:[{type:'message',role:'user',content:[{type:'input_text',text:prompt}]}]}}));",
"  });",
"}",
""
].join('\n');
const marker='async function explainCurrent(){';
if(!app.includes(marker))throw new Error('Release70 patch missing: explain marker');
app=app.replace(marker,()=>realtimeBlock+marker);

const explainRe=/async function explainCurrent\(\)\{[\s\S]*?\n\}\nasync function narrateStudyAnswer/;
if(!explainRe.test(app))throw new Error('Release70 patch missing: explain function');
app=app.replace(explainRe,()=>`async function explainCurrent(){
  if(!state.currentBook||!state.currentChapter){toast('Open a chapter first');return}
  if(state.audio.studyBusy)return;
  state.audio.studyBusy=true;suspendRecognitionForStudy();
  const a=ensureScriptureAudio();if(!a.paused)a.pause();claimVoiceChannel(null);state.audio.resumeAfterStudy=true;
  const v=currentAudioVerse(),ref=\`${'${state.currentBook.title}'} ${'${state.currentChapter.n}'}:${'${v}'}\`;
  setAudioStatus(\`Explaining ${'${ref}'}…\`);state.studyMode='study';
  let ans='';
  try{
    try{ans=await realtimeStudyExplain(ref)}catch(e){console.warn('Realtime Study fallback',e);ans=await askStudy(\`Explain ${'${ref}'} in more detail. Focus on what is happening in this verse and why it matters in its immediate context.\`,{speak:true,autoResume:false,quick:true})}
    if(ans&&state.studyHistory.at(-1)?.text!==ans)state.studyHistory.push({role:'assistant',text:ans});
    return ans;
  }finally{
    state.audio.studyBusy=false;resumeScriptureAfterStudy();resumeRecognitionAfterStudy();
  }
}
async function narrateStudyAnswer`);

swap(
"  state.listening=true;try{state.recognition.start()}catch{}syncAudioUI();setAudioStatus('Listening • say stop, play, continue, or explain that');",
"  state.listening=true;try{state.recognition.start()}catch{}ensureStudyRealtime().catch(()=>{});syncAudioUI();setAudioStatus('Listening • say stop, play, continue, or explain that');",
'prewarm realtime when voice commands start'
);
swap(
"function stopVoiceCommands(){state.listening=false;try{state.recognition?.stop()}catch{}syncAudioUI()}",
"function stopVoiceCommands(){state.listening=false;try{state.recognition?.stop()}catch{}closeStudyRealtime();syncAudioUI()}",
'close realtime when voice commands stop'
);
app=app.replace("if(buffer.length<90)return;","if(buffer.length<48)return;");
app=app.replace("for(let i=70;i<buffer.length;i++)","for(let i=34;i<buffer.length;i++)");
app=app.replace("if(cut<0&&buffer.length>=160)","if(cut<0&&buffer.length>=90)");
fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=69','/styles.css?v=70').replace('/app.js?v=69','/app.js?v=70').replace('/manifest.webmanifest?v=69','/manifest.webmanifest?v=70');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=70#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 70: Realtime Study AI WebRTC voice path applied');
