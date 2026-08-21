const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='83',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release83: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release83 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='82';","const V='83';",'runtime version');

// Voice-triggered Study AI no longer uses the realtime/WebRTC audio path. Build one
// bounded text answer first, store that exact answer, then read the exact same text.
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
    buffer+=decoder.decode();if(buffer)for(const line of buffer.split('\\n'))consume(line);
  }else{buffer=await r.text();for(const line of buffer.split('\\n'))consume(line)}
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

// Native TestFlight builds must not rely on WKWebView autoplay for a voice-triggered
// explanation. Use AVFoundation through HobahNativeAudio, chunk by chunk, and wait for
// each native ended event before continuing. The existing web TTS queue remains fallback.
const partsLine="  const parts=splitForTTS(text,650);if(!parts.length){if(autoResume)resumeScriptureAfterStudy();return}";
swap(partsLine,partsLine+`\n  if(window.HobahNativeAudio){
    const prepared=parts.map(part=>window.HobahNativeAudio.prepare({text:part,mode:'normal'}).catch(()=>{}));
    for(let i=0;i<parts.length;i++){
      const part=parts[i];await prepared[i];setAudioStatus('Study AI • reading '+(i+1)+' of '+parts.length);
      const id=window.HobahNativeAudio.keyFor(part,'normal');let played=false;
      try{
        await new Promise(async(resolve,reject)=>{
          let settled=false;
          const finish=err=>{if(settled)return;settled=true;clearTimeout(timer);document.removeEventListener('hobah:native-audio-ended',ended);err?reject(err):resolve()};
          const ended=e=>{if(e.detail?.id===id)finish()};
          const timer=setTimeout(()=>finish(new Error('Native Study audio timed out')),65000);
          document.addEventListener('hobah:native-audio-ended',ended);
          try{await window.HobahNativeAudio.play({text:part,mode:'normal',title:'Study AI',subtitle:'Explanation',rate:1})}catch(e){finish(e)}
        });
        played=true;
      }catch(e){console.warn('Native Study narration '+(i+1),e)}
      if(!played){claimVoiceChannel(null);played=await browserSpeakStudyPart(part);if(!played)console.warn('Study narration skipped one failed chunk')}
    }
    setStudyReadButton(state.audio.studyManualButton,'play');setAudioStatus('Study AI • finished');if(autoResume)resumeScriptureAfterStudy();return;
  }`,'native Study explanation playback');

// Realtime Study is no longer pre-warmed with Voice Commands, avoiding a competing
// WebRTC audio session during the deterministic text -> native TTS handoff.
const prewarm='ensureStudyRealtime().catch(()=>{});';
if(!app.includes(prewarm))throw new Error('Release83 patch missing: realtime prewarm');
app=app.replaceAll(prewarm,'');

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=82','/styles.css?v=83').replace('/app.js?v=82','/app.js?v=83').replace('/manifest.webmanifest?v=82','/manifest.webmanifest?v=83');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=83#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const V='83';",'requestVoiceExplanation','Aim for about 220 to 280 words and never exceed 300 words','state.studyHistory.push({role:\'user\',text:displayQuestion},{role:\'assistant\',text:ans})','await narrateStudyAnswer(ans,false)','window.HobahNativeAudio.play({text:part','resumeScriptureAfterStudy();resumeRecognitionAfterStudy();'])if(!app.includes(required))throw new Error('Release83 integration missing '+required);
if(app.includes('try{ans=await realtimeStudyExplain(ref)'))throw new Error('Release83: realtime explain path still active');
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 83: Explain That saves and natively reads <=300 words, then resumes Scripture');
