const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const p=f=>path.join('dist',f);
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='85';"))throw new Error('Release85 production Study: runtime missing');

const requestRe=/async function requestVoiceExplanationJSON\(question,reference\)\{[\s\S]*?\n\}\nasync function explainCurrent/;
if(!requestRe.test(app))throw new Error('Release85 production Study: request block missing');
app=app.replace(requestRe,()=>`async function requestVoiceExplanationJSON(question,reference){
  const ctl=new AbortController();state.audio.studyRequestAbort=ctl;state.audio.studyCancelReason='';
  const studyURL=(window.HOBAH_API_BASE?window.HOBAH_API_BASE.replace(/\\/$/,''):'')+'/api/study-chat';
  let answer='',doneText='',buffer='',reader=null,firstText=false,timedOut=false;
  const firstTimer=setTimeout(()=>{if(!firstText){timedOut=true;try{ctl.abort()}catch{}}},10000);
  const hardTimer=setTimeout(()=>{timedOut=true;try{ctl.abort()}catch{}},22000);
  const consume=line=>{
    if(!line.startsWith('data:'))return false;
    const raw=line.slice(5).trim();if(!raw)return false;if(raw==='[DONE]')return true;
    try{
      const ev=JSON.parse(raw);
      if(ev.type==='response.output_text.delta'&&ev.delta){answer+=ev.delta;firstText=true;clearTimeout(firstTimer)}
      if(ev.type==='response.output_text.done'&&ev.text){doneText=ev.text;firstText=true;clearTimeout(firstTimer)}
      if(ev.type==='response.completed'){if(!doneText)doneText=completedResponseText(ev);return true}
      if(ev.type==='error')throw Error(ev.error?.message||'Study AI unavailable');
    }catch(e){if(e instanceof SyntaxError)return false;throw e}
    return false;
  };
  try{
    const r=await fetch(studyURL,{method:'POST',headers:{'content-type':'application/json'},signal:ctl.signal,body:JSON.stringify({question,mode:'study',context:quickStudyContext(),history:[],quick:true})});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.error||'Study AI unavailable')}
    reader=r.body?.getReader?.();
    if(reader){
      const decoder=new TextDecoder();let complete=false;
      while(!complete){
        const {done,value}=await reader.read();if(done)break;
        buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\\n');buffer=lines.pop()||'';
        for(const line of lines){if(consume(line)){complete=true;break}}
      }
      if(!complete){buffer+=decoder.decode();for(const line of buffer.split('\\n'))if(consume(line))break}
      if(complete)reader.cancel().catch(()=>{});
    }else{buffer=await r.text();for(const line of buffer.split('\\n'))if(consume(line))break}
    const final=compactStudyAnswer(clean(doneText||answer),300);
    if(!final)throw Error('Study AI did not return an explanation');
    return final;
  }catch(e){
    if(e?.name==='AbortError'){
      if(state.audio.studyCancelReason==='user')throw Error('Study explanation cancelled');
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

if(app.includes("+'/api/explain'"))throw new Error('Release85 production Study: stale explain endpoint remains in runtime');
for(const required of ["+'/api/study-chat'",'response.completed','quick:true','compactStudyAnswer(clean(doneText||answer),300)','const answerPromise=requestVoiceExplanationJSON(requestQuestion,ref);'])if(!app.includes(required))throw new Error('Release85 production Study missing '+required);
fs.writeFileSync(p('app.js'),app);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 85 production Study: voice explanation uses live production study-chat before mic handoff');
