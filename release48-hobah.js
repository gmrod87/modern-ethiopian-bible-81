(()=>{
  const brand='Hobah';
  function apply(){
    document.title=brand;
    const homeBtn=document.querySelector('#homeBtn');
    if(!homeBtn)return;
    homeBtn.setAttribute('aria-label','Hobah home');
    const cross=homeBtn.querySelector('.brandCross');
    if(cross){
      cross.textContent='';
      let mark=cross.querySelector('.hobahHeaderMark');
      if(!mark){mark=document.createElement('img');mark.className='hobahHeaderMark';cross.appendChild(mark)}
      mark.src='/hobah-mark.svg?v=51';mark.alt='';mark.width=42;mark.height=42;mark.decoding='async';
    }
  }
  addEventListener('hashchange',()=>requestAnimationFrame(apply));
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,250);setTimeout(apply,900);
})();