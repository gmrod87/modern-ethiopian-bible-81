const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='84',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release84: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release84 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='83';","const V='84';",'runtime version');

const requestRe=/async function requestVoiceExplanation\(question\)\{[\s\S]*?\n\}\nasync function explainCurrent/;
if(!requestRe.test(app))throw new Error('Release84 patch missing: voice request block');
app=app.replace(requestRe,()=>`function setStudyPhase(phase='idle'){
  state.audio.studyPhase=phase;
  if(phase==='speaking')setAudioPlay('❚❚');
  else if(phase==='paused'||phase==='generating')setAudioPlay('▶');
}
function abortStudyRequest(reason='cancelled'){
  state.audio.studyCancelReason=reason;
  const ctl=state.audio.studyRequestAbort;state.audio.studyRequestAbort=null;
  if(ctl)try{ctl.abort()}catch{}
}
async function toggleStudyTransport(){
  if(!state.audio.studyBusy)return false;
  const phase=state.audio.studyPhase||'generating';
  if(phase==='generating'){
    setAudioStatus('Returning to Scripture…');abortStudyRequest('user');return true;
  }
  if(window.HobahNativeAudio){
    if(phase==='speaking'){
      await window.HobahNativeAudio.pause().catch(()=>{});setStudyPhase('paused');setAudioStatus('Study AI • paused');return true;
    }
    if(phase==='paused'){
      await window.HobahNativeAudio.resume().catch(()=>{});setStudyPhase('speaking');setAudioStatus('Study AI • reading');return true;
    }
  }
  const sa=state.audio.studyAudio;
  if(sa?.src){
    if(phase==='speaking'){try{sa.pause()}catch{}setStudyPhase('paused');setAudioStatus('Study AI • paused');return true}
    if(phase==='paused'){try{await sa.play()}catch{}setStudyPhase('speaking');setAudioStatus('Study AI • reading');return true}
  }
  if('speechSynthesis'in window){
    if(phase==='speaking'){try{window.speechSynthesis.pause()}catch{}setStudyPhase('paused');setAudioStatus('Study AI • paused');return true}
    if(phase==='paused'){try{window.speechSynthesis.resume()}catch{}setStudyPhase('speaking');setAudioStatus('Study AI • reading');return true}
  }
  return true;
}
if(!window.__hobahStudyTransportCapture){
  window.__hobahStudyTransportCapture=true;
  document.addEventListener('click',e=>{
    if(!state.audio.studyBusy)return;
    const btn=e.target?.closest?.('#audioPlay');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();toggleStudyTransport().catch(err=>console.warn('Study transport',err));
  },true);
}
function completedResponseText(ev){
  const out=Array.isArray(ev?.response?.output)?ev.response.output:[];
  const parts=[];
  for(const item of out)for(const c of (Array.isArray(item?.content)?item.content:[]))if(typeof c?.text==='string')parts.push(c.text);
  return clean(parts.join(' '));
}
async function requestVoiceExplanation(question){
  const ctx=quickStudyContext(),mode='study',history=[],ctl=new AbortController();
  state.audio.studyRequestAbort=ctl;state.audio.studyCancelReason='';
  let timedOut=false,firstText=false,answer='',doneText='',buffer='';
  const firstTimer=setTimeout(()=>{if(!firstText){timedOut=true;try{ctl.abort()}catch{}}},10000);
  const hardTimer=setTimeout(()=>{timedOut=true;try{ctl.abort()}catch{}},22000);
  const consume=line=>{
    if(!line.startsWith('data:'))return false;
    const raw=line.slice(5).trim();if(!raw)return false;
    if(raw==='[DONE]')return true;
    try{
      const ev=JSON.parse(raw);
      if(ev.type==='response.output_text.delta'&&ev.delta){answer+=ev.delta;firstText=true;clearTimeout(firstTimer)}
      if(ev.type==='response.output_text.done'&&ev.text){doneText=ev.text;firstText=true;clearTimeout(firstTimer)}
      if(ev.type==='response.completed'){
        if(!doneText)doneText=completedResponseText(ev);return true;
      }
      if(ev.type==='error')throw Error(ev.error?.message||'Study AI unavailable');
    }catch(e){if(e instanceof SyntaxError)return false;throw e}
    return false;
  };
  let reader=null;
  try{
    const r=await fetch('/api/study-chat',{method:'POST',headers:{'content-type':'application/json'},signal:ctl.signal,body:JSON.stringify({question,mode,context:ctx,history,quick:true})});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Study AI unavailable')}
    reader=r.body?.getReader?.();
    if(reader){
      const decoder=new TextDecoder();let complete=false;
      while(!complete){
        const {done,value}=await reader.read();if(done)break;
        buffer+=decoder.decode(value,{stream:true});
        const lines=buffer.split('\\n');buffer=lines.pop()||'';
        for(const line of lines){if(consume(line)){complete=true;break}}
      }
      if(!complete){buffer+=decoder.decode();for(const line of buffer.split('\\n'))if(consume(line))break}
      if(complete)reader.cancel().catch(()=>{});
    }else{
      buffer=await r.text();for(const line of buffer.split('\\n'))if(consume(line))break;
    }
    const final=compactStudyAnswer(clean(doneText||answer),300);
    if(!final)throw Error('Study AI did not return an explanation');
    return final;
  }catch(e){
    if(e?.name==='AbortError'){
      if(timedOut)throw Error(firstText?'Study AI explanation timed out':'Study AI took too long to start');
      throw Error('Study explanation cancelled');
    }
    throw e;
  }finally{
    clearTimeout(firstTimer);clearTimeout(hardTimer);try{reader?.cancel?.()}catch{}
    if(state.audio.studyRequestAbort===ctl)state.audio.studyRequestAbort=null;
  }
}
async function explainCurrent`);

const explainRe=/async function explainCurrent\(\)\{[\s\S]*?\n\}\nasync function narrateStudyAnswer/;
if(!explainRe.test(app))throw new Error('Release84 patch missing: explainCurrent');
app=app.replace(explainRe,()=>`async function explainCurrent(){
  if(!state.currentBook||!state.currentChapter){toast('Open a chapter first');return}
  if(state.audio.studyBusy)return;
  state.audio.studyBusy=true;setStudyPhase('generating');suspendRecognitionForStudy();closeStudyRealtime();
  const a=ensureScriptureAudio();if(!a.paused)a.pause();claimVoiceChannel(null);state.audio.resumeAfterStudy=true;
  const v=currentAudioVerse(),ref=\`${'${state.currentBook.title}'} ${'${state.currentChapter.n}'}:${'${v}'}\`;
  const displayQuestion=\`Explain ${'${ref}'}\`;
  const requestQuestion=\`Explain ${'${ref}'} in more detail. Focus on what is happening in this verse, its immediate literary context, and why it matters. Give a complete spoken explanation with no preamble. Aim for about 220 to 280 words and never exceed 300 words. End with a complete sentence.\`;
  setAudioStatus(\`Explaining ${'${ref}'}…\`);state.studyMode='study';
  try{
    const ans=await requestVoiceExplanation(requestQuestion);
    state.studyHistory.push({role:'user',text:displayQuestion},{role:'assistant',text:ans});rememberStudyAnswer(ans,displayQuestion,ref);
    setAudioStatus('Study AI • preparing voice');
    await narrateStudyAnswer(ans,false);
    return ans;
  }catch(e){
    const cancelled=/cancelled/i.test(e?.message||'');
    console.warn('Voice Study AI explanation',e);
    if(!cancelled){setAudioStatus('Study AI could not explain that');toast(e?.message||'Study AI unavailable')}
    return'';
  }finally{
    abortStudyRequest('cleanup');state.audio.studyBusy=false;setStudyPhase('idle');resumeScriptureAfterStudy();resumeRecognitionAfterStudy();
  }
}
async function narrateStudyAnswer`);

const narrateMarker='async function narrateStudyAnswer(text,autoResume=false){';
if(!app.includes(narrateMarker))throw new Error('Release84 patch missing: Study narration');
app=app.replace(narrateMarker,`async function waitForNativeStudyEnd(id,maxMs=60000){
  return await new Promise((resolve,reject)=>{
    let settled=false,hadPlaying=false;
    const finish=err=>{if(settled)return;settled=true;clearTimeout(timer);clearInterval(poll);document.removeEventListener('hobah:native-audio-ended',ended);err?reject(err):resolve()};
    const ended=e=>{if(e.detail?.id===id)finish()};
    document.addEventListener('hobah:native-audio-ended',ended);
    const poll=setInterval(async()=>{
      try{
        const s=await window.HobahNativeAudio.getState();if(s?.id!==id)return;
        if(s.playing)hadPlaying=true;
        const atEnd=Number.isFinite(+s.duration)&&+s.duration>0&&+s.currentTime>=Math.max(0,+s.duration-.12);
        if(hadPlaying&&!s.playing&&state.audio.studyPhase!=='paused'&&atEnd)finish();
      }catch{}
    },220);
    const timer=setTimeout(()=>finish(new Error('Native Study audio timed out')),maxMs);
  });
}
${narrateMarker}`);

const nativeRe=/  if\(window\.HobahNativeAudio\)\{\n    const prepared=parts\.map[\s\S]*?\n    setStudyReadButton\(state\.audio\.studyManualButton,'play'\);setAudioStatus\('Study AI • finished'\);if\(autoResume\)resumeScriptureAfterStudy\(\);return;\n  \}/;
if(!nativeRe.test(app))throw new Error('Release84 patch missing: native Study narration block');
app=app.replace(nativeRe,()=>`  if(window.HobahNativeAudio){
    const prepared=parts.map(part=>window.HobahNativeAudio.prepare({text:part,mode:'normal'}).catch(()=>{}));
    for(let i=0;i<parts.length;i++){
      const part=parts[i];await prepared[i];setAudioStatus('Study AI • preparing '+(i+1)+' of '+parts.length);
      const id=window.HobahNativeAudio.keyFor(part,'normal');let played=false;
      try{
        await window.HobahNativeAudio.play({text:part,mode:'normal',title:'Study AI',subtitle:'Explanation',rate:1});
        setStudyPhase('speaking');setAudioStatus('Study AI • reading '+(i+1)+' of '+parts.length);
        await waitForNativeStudyEnd(id,60000);played=true;
      }catch(e){console.warn('Native Study narration '+(i+1),e)}
      if(!played){claimVoiceChannel(null);setStudyPhase('speaking');played=await browserSpeakStudyPart(part);if(!played)console.warn('Study narration skipped one failed chunk')}
    }
    setStudyReadButton(state.audio.studyManualButton,'play');setStudyPhase('idle');setAudioStatus('Study AI • finished');if(autoResume)resumeScriptureAfterStudy();return;
  }`);

// Browser fallback also exposes a usable transport instead of appearing frozen.
app=app.replace("claimVoiceChannel(sa);sa.play().catch(finish);","claimVoiceChannel(sa);setStudyPhase('speaking');sa.play().catch(finish);");
app=app.replace("window.speechSynthesis.speak(u);","setStudyPhase('speaking');window.speechSynthesis.speak(u);");

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=83','/styles.css?v=84').replace('/app.js?v=83','/app.js?v=84').replace('/manifest.webmanifest?v=83','/manifest.webmanifest?v=84');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=84#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ["const V='84';",'response.completed','Study AI took too long to start','toggleStudyTransport','waitForNativeStudyEnd','state.audio.studyPhase','never exceed 300 words'])if(!app.includes(required))throw new Error('Release84 integration missing '+required);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 84: Explain That cannot lock transport; completed-event + timeout + native-end polling applied');
