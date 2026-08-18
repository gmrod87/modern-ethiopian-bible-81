(()=>{
  let enabled=false,audio=null,chunks=[],idx=0,busy=false,books=[],sleepTimer=null,current=null,stopped=false,lastIntroBook=null,lastIntroSection=null;
  let sequenceKind='scripture',returnState=null,lastScripture=null,pendingStartTime=0;
  const ttsRequests=new Map();
  const $=s=>document.querySelector(s), clean=t=>String(t||'').replace(/\s+/g,' ').trim();
  const setState=t=>{const e=$('#audioState');if(e)e.textContent=t},setPlay=t=>{const e=$('#audioPlay');if(e)e.textContent=t};
  const route=(slug,c)=>`#read/${slug}/${c}`,rate=()=>Math.max(.7,Math.min(1.5,+($('#rateSelect')?.value||localStorage.getItem('meb:audioRate')||1))),mode=()=>localStorage.getItem('meb:audioMode')||'normal';
  const splitText=t=>{const parts=[],sent=clean(t).split(/(?<=[.!?])\s+/);let cur='',limit=420;for(const s of sent){if((cur+' '+s).length>limit&&cur){parts.push(cur.trim());cur=s;limit=900}else cur+=(cur?' ':'')+s}if(cur)parts.push(cur.trim());return parts};
  const hashCtx=()=>{const m=location.hash.match(/^#read\/([^/]+)\/(\d+)/);if(!m)return null;const b=books.find(x=>x.slug===m[1]);return b?{slug:b.slug,title:b.title,chapter:+m[2]}:null};
  const chapterText=()=>[...document.querySelectorAll('#chapterText .verse')].map(v=>{const q=v.cloneNode(true);q.querySelectorAll('button').forEach(b=>b.remove());return clean(q.textContent)}).join(' '),verseText=()=>clean($('#verseDialogText')?.textContent);
  const brief=(s,n=250)=>{s=clean(s);if(s.length<=n)return s;const cut=s.slice(0,n),p=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('; '),cut.lastIndexOf(', '));return (p>n*.58?cut.slice(0,p+1):cut.replace(/\s+\S*$/,'')+'.').trim()};
  const study=ctx=>window.MEB_STUDY_DATA?.[ctx?.slug]||null,sectionFor=(a,c)=>a?.sections?.find(s=>c>=s.start&&c<=s.end)||null;
  function resetContextFlow(){lastIntroBook=null;lastIntroSection=null}
  function narrationIntro(ctx){
    if(!ctx)return'';const m=mode(),a=study(ctx),sec=sectionFor(a,ctx.chapter),secKey=sec?`${sec.start}-${sec.end}`:'',newBook=ctx.slug!==lastIntroBook,newSection=newBook||secKey!==lastIntroSection,bits=[`${ctx.title} ${ctx.chapter}.`];
    if(m!=='normal'){
      if(newBook){
        if(['genesis','exodus','leviticus','numbers','deuteronomy'].includes(ctx.slug))bits.push('Traditional Jewish and Christian attribution connects the Pentateuch with Moses.');
        if(m==='context'){
          if(a?.period)bits.push(`Historical setting: ${brief(a.period,170)}.`);
          if(a?.overview)bits.push(brief(a.overview,190));
          if(a?.scholarship)bits.push(`A short scholarly note: ${brief(a.scholarship,220)}`);
        }else{
          if(a?.overview)bits.push(`Book frame: ${brief(a.overview,260)}`);
          if(a?.period)bits.push(`Historical setting: ${brief(a.period,210)}.`);
          if(a?.genre)bits.push(`Literary form: ${brief(a.genre,150)}.`);
          if(a?.scholarship)bits.push(`Scholarship: ${brief(a.scholarship,310)}`);
        }
      }
      if(newSection&&sec?.note)bits.push(`${m==='advanced'?'Literary context':'Section context'}: ${brief(sec.note,m==='advanced'?280:210)}`);
      if(bits.length>1)bits.push('Now, the text.');
    }
    lastIntroBook=ctx.slug;lastIntroSection=secKey;return bits.join(' ');
  }
  const narrationText=(ctx,text)=>`${narrationIntro(ctx)} ${clean(text)}`.trim();
  function scriptureSnapshot(){
    if(sequenceKind!=='scripture')return lastScripture;
    const full=clean(chunks[idx]||lastScripture?.full||'');
    if(!full)return lastScripture;
    let text=full;
    if(audio&&Number.isFinite(audio.duration)&&audio.duration>0){
      const sentences=full.split(/(?<=[.!?])\s+/).filter(Boolean),target=Math.max(0,Math.min(full.length-1,Math.round(full.length*(audio.currentTime/audio.duration))));
      let pos=0,at=0;for(let i=0;i<sentences.length;i++){pos+=sentences[i].length+1;if(pos>=target){at=i;break}}
      text=[sentences[Math.max(0,at-1)],sentences[at]].filter((s,i,a)=>s&&a.indexOf(s)===i).join(' ');
    }
    return {text:clean(text),full,reference:current?`${current.title} ${current.chapter}`:'Read aloud',slug:current?.slug||'',chapter:current?.chapter||0};
  }
  function persist(){if(!current)return;localStorage.setItem('meb:audioProgress',JSON.stringify({slug:current.slug,title:current.title,chapter:current.chapter,idx,rate:rate(),mode:mode(),time:audio?.currentTime||0,updated:Date.now()}))}
  function clearUrl(){if(audio?.src?.startsWith('blob:'))try{URL.revokeObjectURL(audio.src)}catch{}}
  function ensureAudio(){if(audio)return audio;audio=document.createElement('audio');audio.preload='auto';audio.setAttribute('playsinline','');audio.style.display='none';document.body.appendChild(audio);return audio}
  function ensureControls(){
    const bar=$('#audioBar'),ctr=$('.audioControls');if(!bar||!ctr)return;
    if(!$('#audioModes')){const wrap=document.createElement('div');wrap.id='audioModes';wrap.className='audioModes';wrap.innerHTML='<span>READ MODE</span><div><button data-audio-mode="normal">Normal</button><button data-audio-mode="context">Context Added</button><button data-audio-mode="advanced">Advanced</button></div>';bar.insertBefore(wrap,ctr);wrap.querySelectorAll('[data-audio-mode]').forEach(b=>b.onclick=()=>{localStorage.setItem('meb:audioMode',b.dataset.audioMode);resetContextFlow();syncExtra();setState(`${b.textContent} mode • continues chapter to chapter`)})}
    $('#audioAutoNext')?.remove();if(!$('#audioContinuous')){const b=document.createElement('span');b.id='audioContinuous';b.className='audioContinuous';b.textContent='∞ Continuous';ctr.insertBefore(b,$('#audioClose'))}
    if(!$('#audioSleep')){const b=document.createElement('button');b.id='audioSleep';b.className='audioExtra';b.title='Sleep timer';b.textContent='Sleep';ctr.insertBefore(b,$('#audioClose'));b.onclick=cycleSleep}
    const rs=$('#rateSelect');if(rs&&!rs.dataset.naturalBound){rs.dataset.naturalBound='1';const saved=localStorage.getItem('meb:audioRate');if(saved&&[...rs.options].some(o=>o.value===saved))rs.value=saved;rs.onchange=()=>{localStorage.setItem('meb:audioRate',rs.value);if(audio)audio.playbackRate=rate();persist()}}syncExtra()
  }
  function syncExtra(){const m=mode();document.querySelectorAll('[data-audio-mode]').forEach(b=>b.classList.toggle('active',b.dataset.audioMode===m));const s=$('#audioSleep');if(s){const n=+(localStorage.getItem('meb:audioSleepMinutes')||0);s.classList.toggle('active',n>0);s.textContent=n?`${n}m`:'Sleep'}}
  function cycleSleep(){const vals=[0,15,30,60],cur=+(localStorage.getItem('meb:audioSleepMinutes')||0),n=vals[(vals.indexOf(cur)+1)%vals.length];localStorage.setItem('meb:audioSleepMinutes',String(n));if(sleepTimer)clearTimeout(sleepTimer);sleepTimer=null;if(n)sleepTimer=setTimeout(()=>{pause();setState('Sleep timer finished');localStorage.setItem('meb:audioSleepMinutes','0');syncExtra()},n*60000);syncExtra();setState(n?`Sleep timer • ${n} min`:'Sleep timer off')}
  function showBar(){const b=$('#audioBar');if(b)b.classList.remove('hidden');ensureControls()}
  function setMeta(){if(!('mediaSession' in navigator)||!current)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:`${current.title} ${current.chapter}`,artist:'Modern Ethiopian Bible',album:`${mode()==='normal'?'Scripture':mode()==='context'?'Scripture + historical context':'Advanced Scripture study'} read aloud`});navigator.mediaSession.playbackState=audio&&!audio.paused?'playing':'paused'}catch{}}
  const ttsKey=text=>`${mode()}:${text}`;
  function tts(text){const key=ttsKey(text);if(!ttsRequests.has(key)){const request=fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin',mode:mode()})}).then(async r=>{if(!r.ok)throw new Error(await r.text());return r.blob()}).catch(e=>{ttsRequests.delete(key);throw e});ttsRequests.set(key,request)}return ttsRequests.get(key)}
  function warmChunk(i){if(chunks[i])tts(chunks[i]).catch(()=>{})}
  async function speak(text,start=0,ctx=null,includeContext=true){if(!enabled||busy)return;if(ctx)current=ctx;stopped=false;sequenceKind='scripture';returnState=null;window.MEB_NATURAL_AUDIO_ACTIVE=true;const full=includeContext?narrationText(current,text):clean(text);chunks=splitText(full);if(!chunks.length)return;idx=Math.max(0,Math.min(start,chunks.length-1));showBar();$('#audioRef').textContent=current?`${current.title} ${current.chapter}`:'Read aloud';await playChunk()}
  async function playChunk(){if(!enabled||!chunks[idx]||busy||stopped)return;const playingIndex=idx,text=chunks[playingIndex],key=ttsKey(text);busy=true;setState(`${playingIndex?'Loading next part':'Preparing first lines'}…`);setPlay('…');try{const blob=await tts(text);ttsRequests.delete(key);if(stopped||playingIndex!==idx)return;const a=ensureAudio();a.pause();clearUrl();a.src=URL.createObjectURL(blob);a.load();a.playbackRate=rate();const seek=pendingStartTime;pendingStartTime=0;if(seek)a.onloadedmetadata=()=>{try{a.currentTime=Math.min(seek,Math.max(0,(a.duration||seek)-.1))}catch{}};a.onplay=()=>{if(sequenceKind==='scripture')lastScripture={text:clean(text),full:clean(text),reference:current?`${current.title} ${current.chapter}`:'Read aloud',slug:current?.slug||'',chapter:current?.chapter||0};setState(sequenceKind==='explanation'?`Explanation • ${playingIndex+1}/${chunks.length}`:`${mode()==='normal'?'Normal':mode()==='context'?'Context Added':'Advanced'} • ${playingIndex+1}/${chunks.length}`);setPlay('❚❚');setMeta();persist();warmChunk(playingIndex+1)};a.onpause=()=>{if(!busy){setPlay('▶');setMeta();persist()}};a.ontimeupdate=()=>{if(Math.floor(a.currentTime)%5===0)persist()};a.onended=async()=>{persist();if(stopped)return;if(idx<chunks.length-1){idx++;await playChunk()}else if(sequenceKind==='explanation'){sequenceKind='explanation-finished';window.MEB_NATURAL_AUDIO_ACTIVE=false;setState('Explanation finished • say “continue reading”');setPlay('▶')}else await finishChapter()};a.onerror=()=>{setState('Audio playback error');setPlay('▶')};await a.play()}catch(e){console.warn('Natural narration unavailable',e);setState('Natural voice unavailable');setPlay('▶')}finally{busy=false}}
  async function finishChapter(){if(stopped)return;setPlay('▶');if(current){const b=books.find(x=>x.slug===current.slug),i=b?.chapters?.findIndex(x=>x.n===current.chapter)??-1;let next=b?.chapters?.[i+1],nb=b;if(!next){const bi=books.findIndex(x=>x.slug===current.slug);nb=books[bi+1];next=nb?.chapters?.[0]}if(nb&&next){setState(`Continuing to ${nb.title} ${next.n}…`);location.hash=route(nb.slug,next.n);const ok=await waitForChapter(nb.slug,next.n);if(stopped)return;if(ok){current={slug:nb.slug,title:nb.title,chapter:next.n};const text=chapterText();chunks=splitText(narrationText(current,text));idx=0;$('#audioRef').textContent=`${nb.title} ${next.n}`;if(chunks.length){setTimeout(()=>playChunk(),120);return}}}}window.MEB_NATURAL_AUDIO_ACTIVE=false;setState('Finished');persist()}
  function waitForChapter(slug,chapter){return new Promise(resolve=>{let n=0;const t=setInterval(()=>{n++;const h=hashCtx(),txt=chapterText();if(stopped){clearInterval(t);resolve(false)}else if(h?.slug===slug&&h.chapter===chapter&&txt){clearInterval(t);resolve(true)}else if(n>120){clearInterval(t);resolve(false)}},100)})}
  function pause(){const a=ensureAudio();if(sequenceKind==='scripture')lastScripture=scriptureSnapshot()||lastScripture;if(!a.paused)a.pause();setPlay('▶');setState(current?`Paused • ${current.title} ${current.chapter}`:'Paused');persist()}
  async function resume(){
    const a=ensureAudio();
    if(sequenceKind==='explanation-finished'&&returnState){const saved=returnState;returnState=null;sequenceKind='scripture';chunks=saved.chunks;idx=saved.idx;current=saved.current;pendingStartTime=saved.time||0;stopped=false;window.MEB_NATURAL_AUDIO_ACTIVE=true;$('#audioRef').textContent=current?`${current.title} ${current.chapter}`:'Read aloud';busy=false;await playChunk();return}
    if(a.src&&!a.ended&&a.paused){await a.play();return}
    if(chunks[idx]){busy=false;await playChunk();return}
    startChapter()
  }
  function repeat(){const a=ensureAudio();if(sequenceKind==='explanation-finished')sequenceKind='explanation';if(a.src){try{a.currentTime=0}catch{};a.play().catch(()=>{})}else if(chunks[idx]){busy=false;playChunk()}}
  async function speakExplanation(text,label='Explanation'){
    text=clean(text);if(!text)return;
    const a=ensureAudio();
    if(sequenceKind==='scripture')returnState={chunks:[...chunks],idx,current:current?{...current}:current,time:a.currentTime||0};
    pause();sequenceKind='explanation';chunks=splitText(text);idx=0;busy=false;stopped=false;pendingStartTime=0;window.MEB_NATURAL_AUDIO_ACTIVE=true;showBar();$('#audioRef').textContent=current?`${label} • ${current.title} ${current.chapter}`:label;await playChunk()
  }
  function setRateBy(delta){const rs=$('#rateSelect');if(!rs)return;const values=[...rs.options].map(o=>+o.value),now=rate(),next=delta>0?values.find(v=>v>now):[...values].reverse().find(v=>v<now);if(next){rs.value=String(next);localStorage.setItem('meb:audioRate',String(next));if(audio)audio.playbackRate=next;setState(`Reading speed • ${next}×`)}}
  function setReadMode(next){if(!['normal','context','advanced'].includes(next))return;localStorage.setItem('meb:audioMode',next);resetContextFlow();syncExtra();setState(`${next==='context'?'Context Added':next[0].toUpperCase()+next.slice(1)} mode`)}
  function toggle(){const a=ensureAudio();if(a.src&&!a.ended){a.paused?a.play():pause();return}const ctx=hashCtx(),t=chapterText();if(t){resetContextFlow();speak(t,0,ctx,true)}}
  function jump(d){if(!chunks.length)return;idx=Math.max(0,Math.min(chunks.length-1,idx+d));busy=false;playChunk()}
  function stop(hide=true){stopped=true;window.MEB_NATURAL_AUDIO_ACTIVE=false;resetContextFlow();sequenceKind='scripture';returnState=null;ttsRequests.clear();if(audio){audio.pause();audio.currentTime=0;clearUrl();audio.removeAttribute('src');audio.load()}chunks=[];idx=0;busy=false;setState('Ready');setPlay('▶');if(hide)$('#audioBar')?.classList.add('hidden');if('mediaSession'in navigator)try{navigator.mediaSession.playbackState='none'}catch{}}
  function startChapter(){window.speechSynthesis?.cancel();const t=chapterText(),ctx=hashCtx();if(t&&ctx){if(audio&&!audio.paused)audio.pause();busy=false;resetContextFlow();speak(t,0,ctx,true)}}
  function startVerse(){window.speechSynthesis?.cancel();const t=verseText(),ctx=hashCtx();if(t){if(ctx)current=ctx;if(audio&&!audio.paused)audio.pause();busy=false;speak(t,0,ctx,false)}}
  function bindMedia(){if(!('mediaSession'in navigator))return;const a=(name,fn)=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch{}};a('play',()=>audio?.play());a('pause',pause);a('previoustrack',()=>jump(-1));a('nexttrack',()=>jump(1));a('seekbackward',d=>{if(audio)audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||15))});a('seekforward',d=>{if(audio)audio.currentTime=Math.min(audio.duration||1e9,audio.currentTime+(d.seekOffset||15))})}
  window.MEB_NARRATOR={startChapter,startVerse,pause,resume,repeat,next:()=>jump(1),previous:()=>jump(-1),stop:()=>stop(true),speakExplanation,getCurrentSegment:()=>scriptureSnapshot()||lastScripture,setStatus:setState,setRateBy,setReadMode,isPlaying:()=>!!audio&&!audio.paused&&!audio.ended,show:showBar};
  document.dispatchEvent(new CustomEvent('meb:narrator-ready'));
  document.addEventListener('click',e=>{if(!enabled)return;const id=e.target?.id;if(id==='listenChapter'){e.preventDefault();e.stopImmediatePropagation();startChapter();return}if(id==='audioPlay'){e.preventDefault();e.stopImmediatePropagation();window.speechSynthesis?.cancel();toggle();return}if(id==='listenVerse'){e.preventDefault();e.stopImmediatePropagation();window.speechSynthesis?.cancel();startVerse();return}if(id==='audioClose'){e.preventDefault();e.stopImmediatePropagation();window.speechSynthesis?.cancel();stop(true);return}if(id==='audioPrev'){e.preventDefault();e.stopImmediatePropagation();jump(-1);return}if(id==='audioNext'){e.preventDefault();e.stopImmediatePropagation();jump(1);return}},true);
  addEventListener('beforeunload',persist);
  addEventListener('DOMContentLoaded',async()=>{try{books=await fetch('/books.json').then(r=>r.json());const r=await fetch('/api/tts?health=1',{cache:'no-store'});enabled=r.ok;if(enabled){ensureAudio();const v=$('#voiceSelect');if(v){v.innerHTML='<option value="marin">Natural · Marin</option>';v.disabled=true}ensureControls();bindMedia();const p=JSON.parse(localStorage.getItem('meb:audioProgress')||'null'),h=hashCtx();if(p?.mode)localStorage.setItem('meb:audioMode',p.mode);syncExtra();if(p&&h&&p.slug===h.slug&&p.chapter===h.chapter)setState(`Resume available • ${p.title||h.title} ${p.chapter}`);else setState('Natural voice ready • continuous play')}}catch(e){console.warn(e);enabled=false}})
})();
