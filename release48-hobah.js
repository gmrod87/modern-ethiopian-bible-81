(()=>{
  const brand='Hobah';
  function ensureHeader(){
    const homeBtn=document.querySelector('#homeBtn');
    if(!homeBtn)return;
    homeBtn.setAttribute('aria-label','Hobah home');
    const title=homeBtn.querySelector('.brandTitle b');if(title)title.textContent=brand;
    const cross=homeBtn.querySelector('.brandCross');
    if(cross&&!cross.querySelector('.hobahHeaderMark')){
      cross.textContent='';
      const mark=document.createElement('img');
      mark.className='hobahHeaderMark';
      mark.src='/hobah-mark.svg?v=50';
      mark.alt='';mark.width=38;mark.height=38;mark.decoding='async';
      cross.appendChild(mark);
    }
  }
  function ensureHomeBrand(){
    const isHome=!location.hash||location.hash==='#home'||location.hash.startsWith('#home');
    if(!isHome)return;
    const hero=document.querySelector('#app .the81Hero, #app .hero');
    if(!hero)return;
    hero.classList.add('hobahBranded');
    let wrap=hero.querySelector('.hobahHomeBrand');
    if(!wrap){
      wrap=document.createElement('div');wrap.className='hobahHomeBrand';
      const img=document.createElement('img');
      img.src='/hobah-mark.svg?v=50';img.alt='Hobah';img.width=512;img.height=512;img.decoding='async';img.fetchPriority='high';
      wrap.appendChild(img);
      const eyebrow=hero.querySelector('.eyebrow');
      if(eyebrow)hero.insertBefore(wrap,eyebrow);else hero.prepend(wrap);
    }
  }
  function apply(){document.title=brand;ensureHeader();ensureHomeBrand()}
  const app=document.querySelector('#app');if(app)new MutationObserver(()=>requestAnimationFrame(apply)).observe(app,{childList:true,subtree:true});
  addEventListener('hashchange',()=>requestAnimationFrame(apply));
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,250);setTimeout(apply,900);
})();