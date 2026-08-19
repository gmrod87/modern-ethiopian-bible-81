(()=>{
  const brand='Hobah';
  function apply(){
    document.title=brand;
    const home=document.querySelector('#homeBtn .brandTitle b');if(home)home.textContent=brand;
    const cross=document.querySelector('#homeBtn .brandCross');
    if(cross&&!cross.querySelector('.hobahHeaderMark')){
      cross.textContent='';
      const mark=document.createElement('img');mark.className='hobahHeaderMark';mark.src='/hobah-mark.svg?v=49';mark.alt='';mark.width=34;mark.height=34;mark.decoding='async';
      cross.appendChild(mark);
    }
    const hero=document.querySelector('#app .the81Hero, #app .hero');
    const isHome=!location.hash||location.hash==='#home'||location.hash.startsWith('#home');
    if(hero&&isHome&&!hero.querySelector('.hobahHomeBrand')){
      const wrap=document.createElement('div');wrap.className='hobahHomeBrand';
      const img=document.createElement('img');img.src='/hobah-logo.svg?v=49';img.alt='Hobah';img.width=1200;img.height=320;img.decoding='async';img.fetchPriority='high';
      wrap.appendChild(img);
      const eyebrow=hero.querySelector('.eyebrow');
      if(eyebrow&&eyebrow.nextSibling)hero.insertBefore(wrap,eyebrow.nextSibling);else hero.prepend(wrap);
      hero.classList.add('hobahBranded');
    }
  }
  const app=document.querySelector('#app');if(app)new MutationObserver(apply).observe(app,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(apply,0));
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();