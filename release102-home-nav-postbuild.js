const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const p=f=>path.join('dist',f);
if(!fs.existsSync(p('app.js')))throw new Error('Release102 home nav requires app.js');
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='102';"))throw new Error('Release102 home nav expected runtime v102');
if(!app.includes('__hobahHomeNav102')){
app+=String.raw`
;(()=>{
  if(window.__hobahHomeNav102)return;
  window.__hobahHomeNav102=true;
  let lastHomeTap=0;
  const findHome=t=>t?.closest?.('#homeBtn,#bottomHome,a[href="#home"],nav button[aria-label="Home"],nav [data-nav="home"]');
  const goHome=e=>{
    const hit=findHome(e.target);if(!hit)return;
    const now=Date.now();if(now-lastHomeTap<250){e.preventDefault();return}lastHomeTap=now;
    e.preventDefault();e.stopPropagation();
    document.querySelector('#drawer')?.classList.remove('open');
    document.querySelector('#backdrop')?.classList.remove('open');
    document.body.classList.remove('locked');
    const same=location.hash==='#home';
    if(!same)location.hash='#home';
    else{
      try{window.dispatchEvent(new HashChangeEvent('hashchange'))}
      catch{window.dispatchEvent(new Event('hashchange'))}
    }
    try{window.scrollTo({top:0,left:0,behavior:'instant'})}catch{window.scrollTo(0,0)}
  };
  document.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse'&&findHome(e.target))goHome(e)},true);
  document.addEventListener('click',goHome,true);
})();
`;
}
fs.writeFileSync(p('app.js'),app);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
if(!app.includes('__hobahHomeNav102')||!app.includes("location.hash='#home'"))throw new Error('Release102 home nav integration missing');
console.log('Hobah Release 102: bottom Home and centered H logo route home on first tap');
