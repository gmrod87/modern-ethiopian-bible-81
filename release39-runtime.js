(()=>{
  const cleanHeader=()=>{
    const bar=document.querySelector('.topbar');
    if(!bar)return;
    const menu=bar.querySelector('#menuBtn');
    const home=bar.querySelector('#homeBtn');
    const saved=bar.querySelector('#savedBtn');
    const theme=bar.querySelector('#themeBtn');
    if(theme)theme.remove();
    const children=[...bar.children];
    const ai=children.find(el=>el!==menu&&el!==home&&el!==saved&&(/ai/i.test(el.id||'')||/ai/i.test(el.getAttribute('aria-label')||'')||/✦|✧|★|☆/.test(el.textContent||'')));
    for(const el of [...bar.children]){
      if(el!==menu&&el!==home&&el!==saved&&el!==ai) el.remove();
    }
    [menu,home,saved,ai].filter(Boolean).forEach(el=>bar.appendChild(el));
    bar.classList.toggle('hasHeaderAi',!!ai);
  };
  const init=()=>{
    cleanHeader();
    const bar=document.querySelector('.topbar');
    if(bar)new MutationObserver(()=>requestAnimationFrame(cleanHeader)).observe(bar,{childList:true});
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
