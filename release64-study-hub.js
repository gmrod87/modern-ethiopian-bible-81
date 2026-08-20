(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let books=[],bookMap=new Map(),items=[],chat=[],aiMode=localStorage.getItem('meb:aiMode')||'study';
  const user=()=>{try{return JSON.parse(localStorage.getItem('meb:user')||'{"saved":[],"notes":{},"savedStudy":[]}')}catch{return {saved:[],notes:{},savedStudy:[]}}};
  const saveUser=d=>localStorage.setItem('meb:user',JSON.stringify(d));
  const toast=t=>{const x=$('#toast');if(!x)return;x.textContent=t;x.classList.add('show');clearTimeout(x._t);x._t=setTimeout(()=>x.classList.remove('show'),1800)};
  const route=(slug,c=1,v='')=>`#read/${slug}/${c}${v?'/'+v:''}`;
  const hashContext=()=>{const m=location.hash.match(/^#read\/([^/]+)\/(\d+)(?:\/(\d+))?/);return m?{slug:m[1],chapter:+m[2],verse:m[3]?+m[3]:null}:null};
  const modeInfo={
    study:{label:'Study',intro:'Explain the passage carefully from the text, this edition’s notes, and established scholarship.',placeholder:'Ask about this passage, interpretation, theology, cross-references…',prompts:[['Explain this passage','Explain the current passage clearly, including its immediate context and the main interpretive issues.'],['Key themes','What are the most important themes in this passage and how do they connect to the rest of Scripture?'],['Cross-references','Give me the strongest cross-references for the current passage and explain each connection briefly.']]},
    context:{label:'Historical context',intro:'Focus on authorship traditions, dating, setting, archaeology, canon history, manuscripts, and what scholars actually debate.',placeholder:'Ask about authorship, dating, manuscripts, historical setting…',prompts:[['Who wrote this?','Explain the traditional authorship, modern scholarly views, and the evidence behind each view for the current book.'],['Historical setting','What was happening historically when this passage is set and when it was likely composed or edited?'],['Manuscripts & canon','Explain the manuscript evidence and canon history relevant to this passage or book.']]},
    theory:{label:'Debate & theories',intro:'Test disputed biblical claims without sensationalism. Separate evidence, plausible inference, weak arguments, and unsupported claims.',placeholder:'Ask about a disputed claim, suppressed books, Nicaea, lost texts…',prompts:[['Were books suppressed?','Examine the claim that biblical books were deliberately suppressed. Give the strongest evidence for and against it, and a reasoned verdict.'],['Council of Nicaea','Did the Council of Nicaea choose or remove books from the Bible? Compare the popular claim with the historical evidence.'],['Ethiopian canon','Does the Ethiopian canon preserve material other churches intentionally removed, or is the history more complicated? Debate the strongest case on both sides.'],['Watchers & Nephilim','Compare what the biblical and Enochic texts actually say about the Watchers and Nephilim with later claims. What has real textual support?']]}
  };

  function makeShell(){
    if($('#studyHubDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`
      <dialog id="studyHubDialog" class="dialog studyHubDialog"><div class="studyHubCard">
        <button class="dialogClose" id="studyHubClose" type="button" aria-label="Close">×</button>
        <small class="eyebrow">STUDY LIBRARY</small><h2>Scholar's Desk</h2>
        <p class="studyHubIntro">Browse book backgrounds, section context, and curated verse notes without leaving the Bible.</p>
        <div class="studyHubFilters"><input id="studyHubSearch" placeholder="Search notes, books, topics…"><select id="studyHubType"><option value="all">All study material</option><option value="verse">Curated verse notes</option><option value="section">Section context</option><option value="book">Book backgrounds</option></select><select id="studyHubBook"><option value="all">All books</option></select></div>
        <div id="studyHubCount" class="studyHubCount"></div><div id="studyHubResults" class="studyHubResults"></div>
      </div></dialog>
      <dialog id="studyAiDialog" class="dialog studyAiDialog"><div class="studyAiCard">
        <div class="studyAiHead"><div><small class="eyebrow">STUDY AI</small><h2>Ask the text</h2><p id="studyAiContext">Bible study assistant</p></div><button class="dialogClose" id="studyAiClose" type="button">×</button></div>
        <div class="studyAiModeTabs" id="studyAiModeTabs"><button type="button" data-ai-mode="study">Study</button><button type="button" data-ai-mode="context">Historical context</button><button type="button" data-ai-mode="theory">Debate & theories</button></div>
        <div class="studyAiModeIntro" id="studyAiModeIntro"></div><div class="studyAiModePrompts" id="studyAiModePrompts"></div>
        <div id="studyAiMessages" class="studyAiMessages"><div class="studyAiWelcome"><b>Ask a serious question.</b><p>I can work from the Scripture currently on screen, this edition’s study notes and book context, and broader established scholarship.</p></div></div>
        <form id="studyAiForm" class="studyAiForm"><textarea id="studyAiInput" rows="2"></textarea><button type="submit">Ask</button></form>
        <small class="studyAiDisclaimer">AI-generated study assistance can make mistakes. Disputed views are identified as disputed.</small>
      </div></dialog>
      <button id="studyAiFloat" class="studyAiFloat" type="button" aria-label="Ask Study AI" title="Ask Study AI"><span>✦</span><small>AI</small></button>
      <form id="studyAiDock" class="studyAiDockHidden" aria-hidden="true"><input id="studyAiDockInput"><button type="submit">Ask</button></form>`);

    $('#studyHubClose').onclick=()=>$('#studyHubDialog').close();
    $('#studyAiClose').onclick=()=>$('#studyAiDialog').close();
    $('#studyAiFloat').onclick=()=>openAI();
    $('#studyHubSearch').oninput=renderLibrary;$('#studyHubType').onchange=renderLibrary;$('#studyHubBook').onchange=renderLibrary;
    $$('#studyAiModeTabs [data-ai-mode]').forEach(b=>b.onclick=()=>setAiMode(b.dataset.aiMode));
    $('#studyAiForm').onsubmit=e=>{e.preventDefault();const q=$('#studyAiInput').value.trim();if(q)askAI(q)};
    $('#studyAiDock').onsubmit=e=>{e.preventDefault();const q=$('#studyAiDockInput').value.trim();if(!q)return;$('#studyAiDockInput').value='';openAI(q);setTimeout(()=>$('#studyAiForm')?.requestSubmit(),20)};
    const audio=$('#audioBar');if(audio){const sync=()=>$('#studyAiFloat')?.classList.toggle('audioOpen',!audio.classList.contains('hidden'));new MutationObserver(sync).observe(audio,{attributes:true,attributeFilter:['class']});sync()}
    setAiMode(aiMode,false);
  }

  function setAiMode(m,save=true){
    if(!modeInfo[m])m='study';aiMode=m;if(save)localStorage.setItem('meb:aiMode',m);
    $$('#studyAiModeTabs [data-ai-mode]').forEach(b=>b.classList.toggle('active',b.dataset.aiMode===m));
    const info=modeInfo[m],intro=$('#studyAiModeIntro'),input=$('#studyAiInput'),prompts=$('#studyAiModePrompts');
    if(intro)intro.textContent=info.intro;if(input)input.placeholder=info.placeholder;
    if(prompts){prompts.innerHTML=info.prompts.map((p,i)=>`<button type="button" data-mode-prompt="${i}">${esc(p[0])}</button>`).join('');prompts.querySelectorAll('[data-mode-prompt]').forEach(b=>b.onclick=()=>{input.value=info.prompts[+b.dataset.modePrompt][1];input.focus()})}
  }

  function buildIndex(){
    items=[];const data=window.MEB_STUDY_DATA||{},curated=window.MEB_CURATED_NOTES||{};
    for(const b of books){const a=data[b.slug];if(!a)continue;const bg=[a.overview,a.period&&`Historical period: ${a.period}.`,a.genre&&`Genre: ${a.genre}.`,a.setting&&`Setting: ${a.setting}.`,a.scholarship].filter(Boolean).join(' ');if(bg)items.push({type:'book',slug:b.slug,chapter:1,verse:null,title:`${b.title} — Book Background`,label:b.title,text:bg});for(const s of a.sections||[])items.push({type:'section',slug:b.slug,chapter:s.start||1,verse:null,title:`${b.title} ${s.start}${s.end&&s.end!==s.start?'–'+s.end:''} — ${s.title}`,label:b.title,text:s.note||''})}
    for(const [k,text] of Object.entries(curated)){const [slug,c,v]=k.split(':'),b=bookMap.get(slug);if(b)items.push({type:'verse',slug,chapter:+c,verse:+v,title:`${b.title} ${c}:${v}`,label:b.title,text})}
  }
  function openLibrary(){
    buildIndex();const sel=$('#studyHubBook');if(sel&&sel.options.length===1)for(const b of books){const o=document.createElement('option');o.value=b.slug;o.textContent=b.title;sel.appendChild(o)}
    renderLibrary();const d=$('#studyHubDialog');if(!d.open)d.showModal()
  }
  function renderLibrary(){
    const q=($('#studyHubSearch')?.value||'').toLowerCase().trim(),type=$('#studyHubType')?.value||'all',slug=$('#studyHubBook')?.value||'all';
    const shown=items.filter(x=>(type==='all'||x.type===type)&&(slug==='all'||x.slug===slug)&&(!q||(x.title+' '+x.text).toLowerCase().includes(q)));
    const kinds={verse:'Curated verse note',section:'Section context',book:'Book background'},count=$('#studyHubCount'),box=$('#studyHubResults');if(!count||!box)return;
    count.textContent=`${shown.length} ${shown.length===1?'entry':'entries'} • ${items.filter(x=>x.type==='verse').length} curated verse notes`;
    box.innerHTML=shown.length?shown.slice(0,250).map(x=>{const ref=`${x.type}:${x.slug}:${x.chapter}:${x.verse||''}`,saved=(user().savedStudy||[]).some(s=>s.ref===ref);return `<article class="studyHubItem"><div class="studyHubMeta"><span>${kinds[x.type]}</span><b>${esc(x.title)}</b></div><p>${esc(x.text)}</p><div class="studyHubActions"><a href="${route(x.slug,x.chapter,x.verse||'')}">Open passage</a><button type="button" data-save-study="${esc(ref)}">${saved?'♥ Saved':'♡ Save'}</button><button type="button" data-ask-note="${esc(ref)}">Ask AI</button></div></article>`}).join(''):'<p class="studyHubEmpty">No study notes match that search.</p>';
    $$('[data-save-study]').forEach(b=>b.onclick=()=>toggleSave(b.dataset.saveStudy));$$('[data-ask-note]').forEach(b=>b.onclick=()=>{const x=findItem(b.dataset.askNote);if(x){$('#studyHubDialog')?.close();openAI(`Explain this study note more deeply and tell me what is historically important about it.\n\n${x.title}: ${x.text}`,x)}})
  }
  function findItem(ref){const [type,slug,c,v]=ref.split(':');return items.find(x=>x.type===type&&x.slug===slug&&x.chapter===+c&&(x.verse||0)===+(v||0))}
  function toggleSave(ref){const x=findItem(ref);if(!x)return;const d=user();d.savedStudy=d.savedStudy||[];const i=d.savedStudy.findIndex(s=>s.ref===ref);if(i>=0){d.savedStudy.splice(i,1);toast('Study note removed')}else{d.savedStudy.unshift({type:x.type,ref,slug:x.slug,chapter:x.chapter,verse:x.verse,title:x.title,text:x.text});toast('Study note saved')}saveUser(d);renderLibrary()}

  function injectPageButtons(){
    const hero=$('.heroActions');if(hero&&!$('#homeStudyLibrary')){const b=document.createElement('button');b.id='homeStudyLibrary';b.className='pill';b.type='button';b.innerHTML='✦ Study Library';b.onclick=openLibrary;hero.appendChild(b)}
    const tools=$('.readerTools');if(tools&&!$('#readerStudyLibrary')){const b=document.createElement('button');b.id='readerStudyLibrary';b.type='button';b.textContent='✦ Study';b.title='Open Study Library';b.onclick=openLibrary;tools.appendChild(b)}
  }
  function relevantNotes(question,ctx){const toks=question.toLowerCase().match(/[a-z0-9]{4,}/g)||[],same=items.filter(x=>ctx&&x.slug===ctx.slug&&x.chapter===ctx.chapter),scored=items.map(x=>({x,n:toks.reduce((n,t)=>n+((x.title+' '+x.text).toLowerCase().includes(t)?1:0),0)+(ctx&&x.slug===ctx.slug?2:0)})).filter(z=>z.n>0).sort((a,b)=>b.n-a.n).slice(0,6).map(z=>z.x);return [...new Map([...same,...scored].map(x=>[x.title,x])).values()].slice(0,8)}
  function gatherContext(question,extra){
    buildIndex();const ctx=hashContext(),b=ctx&&bookMap.get(ctx.slug),a=ctx&&(window.MEB_STUDY_DATA||{})[ctx.slug];let sec=null;if(a&&ctx)sec=(a.sections||[]).find(s=>ctx.chapter>=s.start&&ctx.chapter<=s.end)||null;
    const scripture=ctx?$$('#chapterText .verse').map(v=>v.textContent.replace(/\s+/g,' ').trim()).join(' ').slice(0,9000):'',notes=relevantNotes(question,ctx).map(x=>({reference:x.title,type:x.type,text:x.text}));if(extra&&!notes.some(n=>n.reference===extra.title))notes.unshift({reference:extra.title,type:extra.type,text:extra.text});
    return {currentReference:b&&ctx?`${b.title} ${ctx.chapter}${ctx.verse?':'+ctx.verse:''}`:'Study Library',scripture,bookBackground:a?[a.period,a.genre,a.overview,a.scholarship].filter(Boolean).join(' '):'',sectionContext:sec?`${sec.title}: ${sec.note}`:'',studyNotes:notes}
  }
  function openAI(seed='',extra=null){
    const ctx=hashContext(),b=ctx&&bookMap.get(ctx.slug),d=$('#studyAiDialog');$('#studyAiContext').textContent=b&&ctx?`Current context: ${b.title} ${ctx.chapter}${ctx.verse?':'+ctx.verse:''}`:'Ask across the Study Library';if(!d.open)d.showModal();setAiMode(aiMode,false);
    const input=$('#studyAiInput');if(seed){input.value=seed;if(extra)input.dataset.extra=JSON.stringify({type:extra.type,slug:extra.slug,chapter:extra.chapter,verse:extra.verse,title:extra.title,text:extra.text});else delete input.dataset.extra}setTimeout(()=>input?.focus(),50)
  }
  function addMsg(role,text){const box=$('#studyAiMessages'),w=box?.querySelector('.studyAiWelcome');w?.remove();const d=document.createElement('div');d.className='studyAiMsg '+role;d.innerHTML=`<small>${role==='user'?'YOU':modeInfo[aiMode].label.toUpperCase()}</small><p>${esc(text).replace(/\n/g,'<br>')}</p>`;box.appendChild(d);box.scrollTop=box.scrollHeight;return d.querySelector('p')}
  function updateMsg(p,text){p.innerHTML=esc(text).replace(/\n/g,'<br>');const box=$('#studyAiMessages');if(box)box.scrollTop=box.scrollHeight}
  async function streamAnswer(r,p){
    if(!r.ok){let msg='Study AI is unavailable';try{msg=(await r.json()).error||msg}catch{}throw new Error(msg)}
    const type=r.headers.get('content-type')||'';if(!type.includes('text/event-stream')){const data=await r.json().catch(()=>({}));return data.answer||'No answer returned.'}
    const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',answer='';
    while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const lines=buffer.split(/\r?\n/);buffer=lines.pop()||'';for(const line of lines){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;let e;try{e=JSON.parse(raw)}catch{continue}if(e.type==='response.output_text.delta'&&e.delta){answer+=e.delta;updateMsg(p,answer)}else if(typeof e.delta==='string'){answer+=e.delta;updateMsg(p,answer)}else if(e.type==='error')throw new Error(e.message||'Study AI is unavailable')}if(done)break}
    return answer.trim()||'No answer returned.'
  }
  async function askAI(q){
    const input=$('#studyAiInput'),raw=input.dataset.extra;let extra=null;try{extra=raw?JSON.parse(raw):null}catch{}delete input.dataset.extra;input.value='';addMsg('user',q);chat.push({role:'user',text:q});const btn=$('#studyAiForm button');btn.disabled=true;btn.textContent='Answering…';const reply=addMsg('assistant','Starting answer…');
    try{const r=await fetch('/api/study-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:q,mode:aiMode,context:gatherContext(q,extra),history:chat.slice(-6,-1)})});const answer=await streamAnswer(r,reply);updateMsg(reply,answer);chat.push({role:'assistant',text:answer});chat=chat.slice(-10)}catch(e){updateMsg(reply,`I couldn't answer that right now. ${e.message||''}`)}finally{btn.disabled=false;btn.textContent='Ask'}
  }

  async function init(){
    books=window.MEB_BOOKS||await(window.MEB_BOOKS_PROMISE||fetch('/books.json?v=64',{cache:'force-cache'}).then(r=>r.json()));bookMap=new Map(books.map(b=>[b.slug,b]));makeShell();buildIndex();injectPageButtons();
    new MutationObserver(()=>injectPageButtons()).observe($('#app')||document.body,{subtree:true,childList:true});addEventListener('hashchange',()=>setTimeout(injectPageButtons,40));
    const hb=$('#studyAiHeaderBtn');if(hb)hb.onclick=()=>openAI();window.MEB_STUDY_AI={open:openAI,library:openLibrary};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
