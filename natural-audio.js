(()=>{
  let enabled=false,audio=null,chunks=[],idx=0,busy=false;
  const $=s=>document.querySelector(s);
  const setState=t=>{const e=$('#audioState');if(e)e.textContent=t};
  const setPlay=t=>{const e=$('#audioPlay');if(e)e.textContent=t};
  const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
  const splitText=t=>{const parts=[],sent=clean(t).split(/(?<=[.!?])\s+/);let cur='';for(const s of sent){if((cur+' '+s).length>3200&&cur){parts.push(cur.trim());cur=s}else cur+=(cur?' ':'')+s}if(cur)parts.push(cur.trim());return parts};
  async function speak(text,start=0){if(!enabled||busy)return;chunks=splitText(text);idx=Math.min(start,chunks.length-1);await playChunk()}
  async function playChunk(){if(!chunks[idx])return;busy=true;setState(`Loading natural voice ${idx+1}/${chunks.length}…`);setPlay('…');try{
    const r=await fetch('/api/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:chunks[idx],voice:'marin'})});
    if(!r.ok)throw new Error(await r.text());const blob=await r.blob();if(audio){audio.pause();URL.revokeObjectURL(audio.src)}audio=new Audio(URL.createObjectURL(blob));
    audio.onplay=()=>{setState(`Natural voice • Marin • ${idx+1}/${chunks.length}`);setPlay('❚❚')};
    audio.onpause=()=>setPlay('▶');
    audio.onended=()=>{if(idx<chunks.length-1){idx++;playChunk()}else{setState('Finished');setPlay('▶')}};
    await audio.play();
  }catch(e){console.warn('Natural narration unavailable',e);setState('Natural voice unavailable');setPlay('▶')}finally{busy=false}}
  function chapterText(){const vs=[...document.querySelectorAll('#chapterText .verse')];return vs.map(v=>clean(v.textContent)).join(' ')}
  function verseText(){return clean($('#verseDialogText')?.textContent)}
  document.addEventListener('click',e=>{
    if(!enabled)return;const id=e.target?.id;
    if(id==='audioPlay'){
      e.preventDefault();e.stopImmediatePropagation();window.speechSynthesis?.cancel();
      if(audio&&!audio.ended&&audio.src){audio.paused?audio.play():audio.pause();return}
      const t=chapterText();if(t)speak(t);return
    }
    if(id==='listenVerse'){
      e.preventDefault();e.stopImmediatePropagation();window.speechSynthesis?.cancel();const t=verseText();if(t)speak(t);return
    }
    if(id==='audioClose'){
      e.preventDefault();e.stopImmediatePropagation();window.speechSynthesis?.cancel();if(audio){audio.pause();audio.currentTime=0}setState('Ready');setPlay('▶');return
    }
    if(id==='audioPrev'&&chunks.length){e.preventDefault();e.stopImmediatePropagation();if(idx>0){idx--;playChunk()}return}
    if(id==='audioNext'&&chunks.length){e.preventDefault();e.stopImmediatePropagation();if(idx<chunks.length-1){idx++;playChunk()}return}
  },true);
  addEventListener('DOMContentLoaded',async()=>{try{const r=await fetch('/api/tts?health=1',{cache:'no-store'});enabled=r.ok;if(enabled){const v=$('#voiceSelect');if(v){v.innerHTML='<option>Natural · Marin</option>';v.disabled=true}setState('Natural voice ready')}}catch{enabled=false}});
})();