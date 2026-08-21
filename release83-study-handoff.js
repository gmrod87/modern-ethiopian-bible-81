const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='83',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release83: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release83 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='82';","const V='83';",'runtime version');

// Voice-triggered Study AI no longer uses the experimental realtime/WebRTC audio path.
// Build one bounded text answer first, store that exact answer in Study AI, then read
// the exact same text through the proven TTS queue before resuming Scripture.
const explainRe=/async function explainCurrent\(\)\{[\s\S]*?\n\}\nasync function narrateStudyAnswer/;
if(!explainRe.test(app))throw new Error('Release83 patch missing: explainCurrent');
app=app.replace(explainRe,()=>`async function requestVoiceExplanation(question){
  const ctx=quickStudyContext(),mode='study',history=[];
  const r=await fetch('/api/study-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,mode,context:ctx,history,quick:true})});
  if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Study AI unavailable')}
  let answer='',buffer='';
  const consume=line=>{
    if(!line.startsWith('data:'))return;
    const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')return;
    try{const ev=JSON.parse(raw);if(ev.type==='response.output_text.delta'&&ev.delta)answer+=ev.delta}catch{}
  };
  const reader=r.body?.getReader?.();
  if(reader){
    const decoder=new TextDecoder();
    while(true){
      const {done,value}=await reader.read();if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      const lines=buffer.split('\\n');buffer=lines.pop()||'';for(const line of lines)consume(line);
    }
    buffer+=decoder.decode();
    if(buffer)for(const line of buffer.split('\\n'))consume(line);
  }else{
    buffer=await r.text();for(const line of buffer.split('\\n'))consume(line);
  }
  answer=compactStudyAnswer(clean(answer),300);
  if(!answer)throw Error('Study AI did not return an explanation');
  return answer;
}
async function explainCurrent(){
  if(!state.currentBook||!state.currentChapter){toast('Open a chapter first');return}
  if(state.audio.studyBusy)return;
  state.audio.studyBusy=true;suspendRecognitionForStudy();closeStudyRealtime();
  const a=ensureScriptureAudio();if(!a.paused)a.pause();claimVoiceChannel(null);state.audio.resumeAfterStudy=true;
  const v=currentAudioVerse(),ref=\`${'${state.currentBook.title}'} ${'${state.currentChapter.n}'}:${'${v}'}\`;
  const displayQuestion=\`Explain ${'${ref}'}\`;
  const requestQuestion=\`Explain ${'${ref}'} in more detail. Focus on what is happening in this verse, its immediate literary context, and why it matters. Give a complete spoken explanation with no preamble. Aim for about 220 to 280 words and never exceed 300 words. End with a complete sentence.\`;
  setAudioStatus(\`Explaining ${'${ref}'}…\`);state.studyMode='study';
  try{
    const ans=await requestVoiceExplanation(requestQuestion);
    state.studyHistory.push({role:'user',text:displayQuestion},{role:'assistant',text:ans});
    rememberStudyAnswer(ans,displayQuestion,ref);
    setAudioStatus('Study AI • reading explanation');
    await narrateStudyAnswer(ans,false);
    return ans;
  }catch(e){
    console.warn('Voice Study AI explanation',e);setAudioStatus('Study AI could not explain that');toast(e?.message||'Study AI unavailable');return'';
  }finally{
    state.audio.studyBusy=false;resumeScriptureAfterStudy();resumeRecognitionAfterStudy();
  }
}
async function narrateStudyAnswer`);

// Realtime Study is no longer pre-warmed when Voice Commands starts. This avoids a
// second audio session competing with the deterministic text -> TTS handoff above.
const prewarm='ensureStudyRealtime().catch(()=>{});';
if(!app.includes(prewarm))throw new Error('Release83 patch missing: realtime prewarm');
app=app.replaceAll(prewarm,'');

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=82','/styles.css?v=83').replace('/app.js?v=82','/app.js?v=83').replace('/manifest.webmanifest?v=82','/manifest.webmanifest?v=83');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=83#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const V='83';",'requestVoiceExplanation','Aim for about 220 to 280 words and never exceed 300 words','state.studyHistory.push({role:\'user\',text:displayQuestion},{role:\'assistant\',text:ans})','await narrateStudyAnswer(ans,false)','resumeScriptureAfterStudy();resumeRecognitionAfterStudy();'])if(!app.includes(required))throw new Error('Release83 integration missing '+required);
if(app.includes('try{ans=await realtimeStudyExplain(ref)'))throw new Error('Release83: realtime explain path still active');
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 83: Explain That now saves, reads <=300 words, then resumes Scripture');
