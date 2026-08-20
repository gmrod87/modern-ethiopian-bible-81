const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='72',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js')))throw new Error('Release72: dist/app.js missing');
let app=fs.readFileSync(p('app.js'),'utf8');
const swap=(from,to,label)=>{if(!app.includes(from))throw new Error('Release72 patch missing: '+label);app=app.replace(from,()=>to)};

swap("const V='71';","const V='72';",'runtime version');

const studyHelpers=`function compactStudyAnswer(text,maxWords=300){
  const t=clean(text);if(!t)return'';const words=t.split(/\\s+/);if(words.length<=maxWords)return t;
  let out=words.slice(0,maxWords).join(' '),cut=-1;
  for(const mark of ['. ','? ','! '])cut=Math.max(cut,out.lastIndexOf(mark));
  if(cut>out.length*.62)out=out.slice(0,cut+1);
  else out=out.replace(/[,:;\\-–—]+$/,'').trim()+'.';
  return out;
}
function currentStudyLocation(){
  const h=location.hash.match(/^#read\\/([^/]+)\\/(\\d+)(?:\\/(\\d+))?/),last=lastRead()||{};
  return{slug:h?.[1]||state.currentBook?.slug||last.slug||'genesis',chapter:+(h?.[2]||state.currentChapter?.n||last.chapter||1),verse:h?.[3]?+h[3]:null};
}
function rememberStudyAnswer(text,question='',ref=''){
  text=clean(text);if(!text)return null;const loc=currentStudyLocation(),ctx=currentContext();
  const item={text,question:clean(question),ref:ref||ctx.currentReference||'Study AI',slug:loc.slug,chapter:loc.chapter,verse:loc.verse,savedAt:Date.now()};
  state.lastStudyExplanation=item;return item;
}
function saveStudyExplanation(item=state.lastStudyExplanation){
  if(!item?.text){const last=[...state.studyHistory].reverse().find(x=>x.role==='assistant');if(last)item=rememberStudyAnswer(last.text,'')}
  if(!item?.text){toast('No Study AI explanation to save yet');return false}
  const p=profile(),duplicate=p.study.some(x=>x.ref===item.ref&&x.text===item.text);
  if(!duplicate)p.study.unshift({ref:item.ref,slug:item.slug,chapter:item.chapter,verse:item.verse||'',text:item.text,question:item.question||'',savedAt:item.savedAt||Date.now()});
  saveProfile(p);toast(duplicate?'Already saved':'Saved to Study Library');return true;
}
function studyActionHTML(i){return '<div class="studyMsgActions"><button type="button" data-study-read="'+i+'">▶ Read aloud</button><button type="button" data-study-save="'+i+'">♡ Save to library</button></div>'}
function studyHistoryHTML(){return state.studyHistory.map((m,i)=>'<div class="studyMsg '+m.role+'" data-study-index="'+i+'"><p>'+esc(m.text)+'</p>'+(m.role==='assistant'?studyActionHTML(i):'')+'</div>').join('')}
function decorateStudyMessage(el,i){if(!el||el.querySelector('.studyMsgActions'))return;el.dataset.studyIndex=String(i);el.insertAdjacentHTML('beforeend',studyActionHTML(i))}
async function readStudyAnswer(text){
  text=clean(text);if(!text)return;if(state.audio.studyBusy){toast('Study AI is already speaking');return}
  const a=ensureScriptureAudio(),resume=!!(state.audio.playing&&a&&!a.paused);
  if(resume){a.pause();state.audio.resumeAfterStudy=true}
  state.audio.studyBusy=true;suspendRecognitionForStudy();claimVoiceChannel(null);
  try{await narrateStudyAnswer(text,false)}catch(e){console.warn('Study read aloud',e);toast('Read aloud was interrupted')}
  finally{state.audio.studyBusy=false;if(resume)resumeScriptureAfterStudy();resumeRecognitionAfterStudy()}
}
function wireStudyActions(body){
  if(!body||body.dataset.studyActions==='1')return;body.dataset.studyActions='1';
  body.addEventListener('click',async e=>{
    const rb=e.target.closest('[data-study-read]'),sb=e.target.closest('[data-study-save]');
    if(rb){const i=+rb.dataset.studyRead,m=state.studyHistory[i];if(!m||m.role!=='assistant')return;rememberStudyAnswer(m.text,state.studyHistory[i-1]?.role==='user'?state.studyHistory[i-1].text:'');const old=rb.textContent;rb.disabled=true;rb.textContent='Reading…';try{await readStudyAnswer(m.text)}finally{rb.disabled=false;rb.textContent=old}return}
    if(sb){const i=+sb.dataset.studySave,m=state.studyHistory[i];if(!m||m.role!=='assistant')return;saveStudyExplanation(rememberStudyAnswer(m.text,state.studyHistory[i-1]?.role==='user'?state.studyHistory[i-1].text:''))}
  });
}
`;
const studyMarker="async function openStudy(mode='study',preset=''){";
if(!app.includes(studyMarker))throw new Error('Release72 patch missing: Study AI opener');
app=app.replace(studyMarker,()=>studyHelpers+studyMarker);

swap(
"    <div id=\"studyMessages\" class=\"studyMessages\">${state.studyHistory.map(m=>`<div class=\"studyMsg ${m.role}\"><p>${esc(m.text)}</p></div>`).join('')}</div>",
"    <div id=\"studyMessages\" class=\"studyMessages\">${studyHistoryHTML()}</div>",
'Study AI message actions'
);
swap(
"  syncStudyTabs(body);\n  $$('[data-mode]',body).forEach(b=>b.onclick=()=>{state.studyMode=b.dataset.mode;syncStudyTabs(body)});",
"  syncStudyTabs(body);wireStudyActions(body);\n  $$('[data-mode]',body).forEach(b=>b.onclick=()=>{state.studyMode=b.dataset.mode;syncStudyTabs(body)});",
'wire Study AI action buttons'
);
swap(
"    answer=clean(answer)||'I could not produce an explanation for that request.';\n    state.studyHistory.push({role:'assistant',text:answer});if(pending){pending.classList.remove('pending');pending.querySelector('p').textContent=answer}\n    if(speak){if(narrator)await narrator.finish();else await narrateStudyAnswer(answer,autoResume);}",
"    answer=clean(answer)||'I could not produce an explanation for that request.';if(quick)answer=compactStudyAnswer(answer,300);\n    state.studyHistory.push({role:'assistant',text:answer});const studyIndex=state.studyHistory.length-1;if(pending){pending.classList.remove('pending');pending.querySelector('p').textContent=answer;decorateStudyMessage(pending,studyIndex)}rememberStudyAnswer(answer,question);\n    if(speak){if(narrator)await narrator.finish();else await narrateStudyAnswer(answer,autoResume);}",
'remember and decorate Study AI answers'
);

const oldVoice=`function handleVoice(text,final){
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
}`;
const newVoice=`function handleVoice(text,final){
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
swap(oldVoice,newVoice,'save-that voice commands');
app=app.replace(/Listening • say stop, play, continue, or explain that/g,'Listening • say explain that, save that, stop, or play');

swap(
"instructions:'Answer immediately with no preamble. Give the direct answer in the first sentence, then fully explain the verse and its immediate context before stopping. Do not cut the explanation short just to be concise. Use roughly 220 to 320 spoken words when the passage needs it, with a natural complete ending. Speak at a steady, even volume and calm pace. Do not read verse numbers aloud.'",
"instructions:'Answer immediately with no preamble. Give the direct answer in the first sentence, then explain the verse and its immediate context clearly. HARD LIMIT: never exceed 300 spoken words. Aim for about 220 to 280 words when useful, and always finish with a complete sentence rather than being cut off. Speak at a steady, even volume and calm pace. Do not read verse numbers aloud.'",
'300-word realtime explanation limit'
);

swap(
"    if(ans&&state.studyHistory.at(-1)?.text!==ans)state.studyHistory.push({role:'assistant',text:ans});\n    return ans;",
"    ans=compactStudyAnswer(ans,300);if(ans){const last=state.studyHistory.at(-1);if(last?.role==='assistant')last.text=ans;else state.studyHistory.push({role:'assistant',text:ans});rememberStudyAnswer(ans,`Explain ${ref}`,ref)}\n    return ans;",
'capture last voice explanation'
);

fs.writeFileSync(p('app.js'),app);
fs.appendFileSync(p('styles.css'),`\n/* Hobah Release 72 — Study AI answer actions */\n.studyMsgActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.studyMsgActions button{min-height:36px;padding:0 12px;border:1px solid rgba(20,46,40,.16);border-radius:999px;background:rgba(255,255,255,.72);color:#143d35;font:750 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.studyMsgActions button:disabled{opacity:.55;cursor:default}@media(max-width:560px){.studyMsgActions{gap:6px}.studyMsgActions button{min-height:34px;padding:0 10px}}\n`);

let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=71','/styles.css?v=72').replace('/app.js?v=71','/app.js?v=72').replace('/manifest.webmanifest?v=71','/manifest.webmanifest?v=72');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=72#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 72: Study AI read aloud, save-that notes, and 300-word voice explanations applied');
