(()=>{
  let enabled=false,audio=null,chunks=[],idx=0,busy=false,books=[],sleepTimer=null,current=null;
  const $=s=>document.querySelector(s), clean=t=>String(t||'').replace(/\s+/g,' ').trim();
  const getBool=(k,d)=>localStorage.getItem(k)==null?d:localStorage.getItem(k)==='1';
  const setState=t=>{const e=$('#audioState');if(e)e.textContent=t};
  const setPlay=t=>{const e=$('#audioPlay');if(e)e.textContent=t};
  const route=(slug,c)=>`#read/${slug}/${c}`;
  const rate=()=>Math.max(.7,Math.min(1.5,+($('#rateSelect')?.value||localStorage.getItem('meb:audioRate')||1)));
  const splitText=t=>{const parts=[],sent=clean(t).split(/(?<=[.!?])\s+/);let cur='';for(const s of sent){if((cur+' '+s).length>3000&&cur){parts.push(cur.trim());cur=s}else cur+=(cur?' ':'')+s}if(cur)parts.push(cur.trim());return parts};
  const hashCtx=()=>{const m=location.hash.match(/^#read\/([^/]+)\/(\d+)/);if(!m)return null;const b=books.find(x=>x.slug===m[1]);return b?{slug:b.slug,title:b.title,chapter:+m[2]}:null};
  const chapterText=()=>[...document.querySelectorAll('#chapterText .verse')].map(v=>clean(v.textContent)).join(' ');
  const verseText=()=>clean($('#verseDialogText')?.textContent);
  function persist(){if(!current)return;localStorage.setItem('meb:audioProgress',JSON.stringify({slug:current.slug,title:current.title,chapter:current.chapter,idx,rate:rate(),time:audio?.currentTime||0,updated:Date.now()}))}
  function clearUrl(){if(audio?.src?.startsWith('blob:'))try{URL.revokeObjectURL(audio.src)}catch{}}
  function ensureControls(){const ctr=$('.audioControls');if(!ctr)return;
    if(!$('#audioAutoNext')){const b=document.createElement('button');b.id='audioAutoNext';b.className='audioExtra';b.title='Continue to the next chapter';b.textContent='Next ch.';const close=$('#audioClose');ctr.insertBefore(b,close);b.onclick=()=>{const v=!getBool('meb:audioAutoNext',true);localStorage.setItem('meb:audioAutoNext',v?'1':'0');syncExtra()}}
    if(!$('#audioSleep')){const b=document.createElement('button');b.id='audioSleep';b.className='audioExtra';b.title='Sleep timer';b.textContent='Sleep';const close=$('#audioClose');ctr.insertBefore(b,close);b.onclick=cycleSleep}
    const rs=$('#rateSelect');if(rs&&!rs.dataset.naturalBound){rs.dataset.naturalBound='1';const saved=localStorage.getItem('meb:audioRate');if(saved&&[...rs.options].some(o=>o.value===saved))rs.value=saved;rs.onchange=()=>{localStorage.setItem('meb:audioRate',rs.value);if(audio)audio.playbackRate=rate();persist()}}
    syncExtra();
  }
  function syncExtra(){const b=$('#audioAutoNext');if(b){const on=getBool('meb:audioAutoNext',true);b.classList.toggle('active',on);b.textContent=on?'Next ✓':'Next ch.'}const s=$('#audioSleep');if(s){const n=+(localStorage.getItem('meb:audioSleepMinutes')||0);s.classList.toggle('active',n>0);s.textContent=n?`${n}m`:'Sleep'}}
  function cycleSleep(){const vals=[0,15,30,60],cur=+(localStorage.getItem('meb:audioSleepMinutes')||0),n=vals[(vals.indexOf(cur)+1)%vals.length];localStorage.setItem('meb:audioSleepMinutes',String(n));if(sleepTimer)clearTimeout(sleepTimer);sleepTimer=null;if(n)sleepTimer=setTimeout(()=>{pause();setState('Sleep timer finished');localStorage.setItem('meb:audioSleepMinutes','0');syncExtra()},n*60000);syncExtra();setState(n?`Sleep timer • ${n} min`:'Sleep timer off')}
  function showBar(){const b=$('#audioBar');if(b)b.classList.remove('hidden');ensureControls()}
  function setMeta(){if(!('mediaSession' in navigator)||!current)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:`${current.title} ${current.chapter}`,artist:'Modern Ethiopian Bible',album:'Scripture read aloud'});navigator.mediaSession.playbackState=audio&&!audio.paused?'playing':'paused'}catch{}}
  async function tts(text){const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:'marin'})});if(!r.ok)throw new Error(await r.text());return r.blob()}
  async function speak(text,start=0,ctx=null){if(!enabled||busy)return;if(ctx)current=ctx;chunks=splitText(text);if(!chunks.length)return;idx=Math.max(0,Math.min(start,chunks.length-1));showBar();$('#audioRef').textContent=current?`${current.title} ${current.chapter}`:'Read aloud';await playChunk()}
  async function playChunk(){if(!enabled||!chunks[idx]||busy)return;busy=true;setState(`Loading natural voice ${idx+1}/${chunks.length}…`);setPlay('…');try{
    const blob=await tts(chunks[idx]);if(audio){audio.pause();clearUrl()}audio=new Audio(URL.createObjectURL(blob));audio.playbackRate=rate();
    audio.onplay=()=>{setState(`Natural voice • ${idx+1}/${chunks.length}`);setPlay('❚❚');setMeta();persist()};
    audio.onpause=()=>{setPlay('▶');setMeta();persist()};
    audio.ontimeupdate=()=>{if(Math.floor(audio.currentTime)%5===0)persist()};
    audio.onended=async()=>{persist();if(idx<chunks.length-1){idx++;await playChunk()}else await finishChapter()};
    audio.onerror=()=>{setState('Audio playback error');setPlay('▶')};
    await audio.play();
  }catch(e){console.warn('Natural narration unavailable',e);setState('Natural voice unavailable');setPlay('▶')}finally{busy=false}}
  async function finishChapter(){setPlay('▶');if(getBool('meb:audioAutoNext',true)&&current){const b=books.find(x=>x.slug===current.slug),i=b?.chapters?.findIndex(x=>x.n===current.chapter)??-1;let next=b?.chapters?.[i+1],nb=b;if(!next){const bi=books.findIndex(x=>x.slug===current.slug);nb=books[bi+1];next=nb?.chapters?.[0]}if(nb&&next){setState('Opening next chapter…');location.hash=route(nb.slug,next.n);const ok=await waitForChapter(nb.slug,next.n);if(ok){current={slug:nb.slug,title:nb.title,chapter:next.n};chunks=splitText(chapterText());idx=0;$('#audioRef').textContent=`${nb.title} ${next.n}`;if(chunks.length)return playChunk()}}}setState('Finished');persist()}
  function waitForChapter(slug,chapter){return new Promise(resolve=>{let n=0;const t=setInterval(()=>{n++;const h=hashCtx(),txt=chapterText();if(h?.slug===slug&&h.chapter===chapter&&txt){clearInterval(t);resolve(true)}else if(n>80){clearInterval(t);resolve(false)}},100)})}
  function pause(){if(audio&&!audio.paused)audio.pause();setPlay('▶');persist()}
  function toggle(){if(audio&&!audio.ended&&audio.src){audio.paused?audio.play():pause();return}const ctx=hashCtx(),t=chapterText();if(t)speak(t,0,ctx)}
  function jump(d){if(!chunks.length)return;idx=Math.max(0,Math.min(chunks.length-1,idx+d));playChunk()}
  function stop(hide=true){if(audio){audio.pause();audio.currentTime=0;clearUrl();audio=null}chunks=[];idx=0;busy=false;setState('Ready');setPlay('▶');if(hide)$('#audioBar')?.classList.add('hidden');if('mediaSession'in navigator)try{navigator.mediaSession.playbackState='none'}catch{}}
  function startChapter(){window.speechSynthesis?.cancel();const t=chapterText(),ctx=hashCtx();if(t&&ctx)speak(t,0,ctx)}
  function startVerse(){window.speechSynthesis?.cancel();const t=verseText(),ctx=hashCtx();if(t){if(ctx)current=ctx;speak(t,0,ctx)}}
  function bindMedia(){if(!('mediaSession'in navigator))return;const a=(name,fn)=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch{}};a('play',()=>audio?.play());a('pause',pause);a('previoustrack',()=>jump(-1));a('nexttrack',()=>jump(1));a('seekbackward',d=>{if(audio)audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||15))});a('seekforward',d=>{if(audio)audio.currentTime=Math.min(audio.duration||1e9,audio.currentTime+(d.seekOffset||15))})}
  document.addEventListener('click',e=>{if(!enabled)return;const id=e.target?.id;
    if(id==='listenChapter'){e.preventDefault();e.stopImmediatePropagation();startChapter();return}
    if(id==='audioPlay'){e.preventDefault();e.stopImmediatePropagation();window.speechSynthesis?.cancel();toggle();return}
    if(id==='listenVerse'){e.preventDefault();e.stopImmediatePropagation();startVerse();return}
    if(id==='audioClose'){e.preventDefault();e.stopImmediatePropagation();window.speechSynthesis?.cancel();stop(true);return}
    if(id==='audioPrev'){e.preventDefault();e.stopImmediatePropagation();jump(-1);return}
    if(id==='audioNext'){e.preventDefault();e.stopImmediatePropagation();jump(1);return}
  },true);
  addEventListener('beforeunload',persist);
  addEventListener('DOMContentLoaded',async()=>{try{books=await fetch('/books.json').then(r=>r.json());const r=await fetch('/api/tts?health=1',{cache:'no-store'});enabled=r.ok;if(enabled){const v=$('#voiceSelect');if(v){v.innerHTML='<option value="marin">Natural · Marin</option>';v.disabled=true}ensureControls();bindMedia();const p=JSON.parse(localStorage.getItem('meb:audioProgress')||'null');const h=hashCtx();if(p&&h&&p.slug===h.slug&&p.chapter===h.chapter)setState(`Resume available • ${p.title||h.title} ${p.chapter}`);else setState('Natural voice ready')}}catch(e){console.warn(e);enabled=false}});
})();
