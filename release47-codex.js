(()=>{
  const brand='Codex 81';
  const sub='Ethiopian Canon • 81 Books';
  function apply(){
    document.documentElement.dataset.codexUi='47';
    document.body?.classList.remove('dark');
    document.title=brand;
    const home=document.querySelector('#homeBtn');
    if(home){
      home.setAttribute('aria-label','Codex 81 home');
      const b=home.querySelector('b'); if(b)b.textContent=brand;
      const s=home.querySelector('small'); if(s)s.textContent=sub;
    }
    const theme=document.querySelector('#themeBtn'); if(theme)theme.hidden=true;
    const ai=document.querySelector('#studyAiFloat'); if(ai){ai.setAttribute('title','Ask Codex AI');ai.setAttribute('aria-label','Ask Codex AI')}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  addEventListener('hashchange',()=>requestAnimationFrame(apply));
  setTimeout(apply,250);
  setTimeout(apply,900);
})();
