(()=>{
  const cleanHeader=()=>{
    const bar=document.querySelector('.topbar');
    if(!bar)return;
    const menu=bar.querySelector('#menuBtn');
    const home=bar.querySelector('#homeBtn');
    const saved=bar.querySelector('#savedBtn');
    const theme=bar.querySelector('#themeBtn');
    // Keep themeBtn in the DOM because the native app binds to it during startup.
    // CSS hides it completely in the fixed cream edition.
    const children=[...bar.children];
    const ai=children.find(el=>el!==menu&&el!==home&&el!==saved&&el!==theme&&(/ai/i.test(el.id||'')||/ai/i.test(el.getAttribute('aria-label')||'')||/✦|✧|★|☆/.test(el.textContent||'')));
    for(const el of [...bar.children]){
      if(el!==menu&&el!==home&&el!==saved&&el!==theme&&el!==ai) el.remove();
    }
    [menu,home,saved,ai,theme].filter(Boolean).forEach(el=>bar.appendChild(el));
    bar.classList.toggle('hasHeaderAi',!!ai);
  };

  const escapeHtml=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  let fallbackBooks=null;
  async function loadFallbackBooks(){
    if(fallbackBooks)return fallbackBooks;
    try{
      const r=await fetch('/books.json',{cache:'force-cache'});
      if(!r.ok)throw new Error('books.json '+r.status);
      fallbackBooks=await r.json();
      return fallbackBooks;
    }catch(e){return[]}
  }
  function drawFallbackBooks(filter='all'){
    const box=document.querySelector('#drawerBooks');
    if(!box||!fallbackBooks?.length)return;
    const books=filter==='all'?fallbackBooks:fallbackBooks.filter(b=>b.category===filter);
    box.innerHTML=books.map((b,i)=>`<a class="drawerBook r40FallbackBook" href="#read/${encodeURIComponent(b.slug)}/${b.chapters?.[0]?.n||1}" data-category="${escapeHtml(b.category)}"><i>${i+1}</i><span>${escapeHtml(b.title)}</span><small>${b.chapters?.length||0} chapters</small></a>`).join('');
  }
  async function ensureBooks(){
    const box=document.querySelector('#drawerBooks');
    if(!box)return;
    if(box.children.length)return;
    const books=await loadFallbackBooks();
    if(!books.length)return;
    if(!box.children.length)drawFallbackBooks('all');
    document.querySelectorAll('#filters [data-filter]').forEach(btn=>{
      if(btn.dataset.r40Bound)return;
      btn.dataset.r40Bound='1';
      btn.addEventListener('click',()=>{
        document.querySelectorAll('#filters [data-filter]').forEach(x=>x.classList.toggle('active',x===btn));
        drawFallbackBooks(btn.dataset.filter||'all');
      });
    });
  }

  const removeFallbackRepair=()=>{
    document.querySelectorAll('#bootFallback a[href*="recovery.html"],#bootFallback button').forEach(el=>{
      if(/repair app/i.test(el.textContent||'')||/recovery\.html/i.test(el.getAttribute('href')||''))el.remove();
    });
  };

  const init=()=>{
    cleanHeader();
    removeFallbackRepair();
    const bar=document.querySelector('.topbar');
    if(bar)new MutationObserver(()=>requestAnimationFrame(cleanHeader)).observe(bar,{childList:true});
    setTimeout(ensureBooks,250);
    setTimeout(ensureBooks,900);
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
