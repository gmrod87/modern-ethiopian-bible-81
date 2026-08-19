(()=>{
  const EDITION='81-BOOK RESEARCH EDITION • SEARCH • READ • LISTEN';
  function header(){
    const home=document.querySelector('#homeBtn');
    if(!home)return;
    const cross=home.querySelector('.brandCross');
    if(cross){
      cross.textContent='';
      let mark=cross.querySelector('.hobahHeaderMark');
      if(!mark){mark=document.createElement('img');mark.className='hobahHeaderMark';cross.appendChild(mark)}
      mark.src='/hobah-mark.svg?v=51';mark.alt='Hobah';mark.width=42;mark.height=42;mark.decoding='async';
    }
    const title=home.querySelector('.brandTitle');if(title)title.hidden=true;
  }
  function hero(){
    const isHome=!location.hash||location.hash==='#home'||location.hash.startsWith('#home');
    if(!isHome)return;
    const el=document.querySelector('#app .the81Hero, #app .hero');
    if(!el)return;
    el.classList.remove('hobahBranded');
    el.querySelectorAll('.hobahHomeBrand,.heroDecor,.hero-decoration,.heroDecoration,.ornaments,.ornament,.flourish,.heroFlourish,.heroLines,.heroSymbols,.editionMark,.heroMark,.sigil,.decorRow').forEach(n=>n.remove());
    const eyebrow=el.querySelector('.eyebrow');
    if(eyebrow){
      if(eyebrow.textContent.trim()!==EDITION)eyebrow.textContent=EDITION;
      const kids=[...el.children];
      const idx=kids.indexOf(eyebrow);
      if(idx>0){
        kids.slice(0,idx).forEach(n=>{
          if(!n.matches('h1,p,.heroActions,.homeActions,.nativeBadge,button,a'))n.remove();
        });
      }
    }
    const h1=el.querySelector('h1');
    if(h1&&h1.dataset.ancientCanon!=='1'){
      h1.dataset.ancientCanon='1';
      h1.classList.add('ancientCanonTitle');
      h1.innerHTML='<span class="ancientLine1">The</span><span class="ancientLine2">Ancient</span><span class="ancientLine3">Canon</span>';
    }
    const search=document.querySelector('#searchInput');if(search)search.placeholder='Search…';
  }
  function apply(){header();hero()}
  const app=document.querySelector('#app');
  if(app)new MutationObserver(()=>requestAnimationFrame(apply)).observe(app,{childList:true,subtree:true});
  addEventListener('hashchange',()=>requestAnimationFrame(apply));
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,100);setTimeout(apply,350);setTimeout(apply,1000);
})();