(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let feelingMode=false;
  const moods=[
    {icon:'☀',title:'Grateful',line:'Slow down and notice what is good.',tone:'Warm · major',passages:[['Psalm 100','psalms',100],['Psalm 103','psalms',103],['Psalm 136','psalms',136]]},
    {icon:'◌',title:'Anxious or overwhelmed',line:'Quiet passages about safety, presence and trust.',tone:'Calm · major',passages:[['Psalm 23','psalms',23],['Psalm 46','psalms',46],['Matthew 6','matthew',6],['Philippians 4','philippians',4]]},
    {icon:'✦',title:'Curious / intrigued',line:'Enter the visionary, symbolic and apocalyptic side of Scripture.',tone:'Mysterious · minor',passages:[['Daniel 7','daniel',7],['1 Enoch 6','1-enoch',6],['1 Enoch 46','1-enoch',46],['Revelation 12','revelation',12]]},
    {icon:'♡',title:'Need love or comfort',line:'Read about being known, loved and held close.',tone:'Tender · major',passages:[['Psalm 139','psalms',139],['John 15','john',15],['1 Corinthians 13','1-corinthians',13],['1 John 4','1-john',4]]},
    {icon:'↟',title:'Need hope',line:'Passages that look beyond the present moment.',tone:'Hopeful · major',passages:[['Isaiah 40','isaiah',40],['Romans 8','romans',8],['Revelation 21','revelation',21]]},
    {icon:'☾',title:'Sad or grieving',line:'Scripture that makes room for sorrow without rushing it.',tone:'Reflective · minor',passages:[['Psalm 13','psalms',13],['Psalm 42','psalms',42],['Lamentations 3','lamentations',3],['John 11','john',11]]},
    {icon:'♢',title:'Need wisdom',line:'Practical and reflective writing for decisions and perspective.',tone:'Clear · major',passages:[['Proverbs 3','proverbs',3],['Ecclesiastes 3','ecclesiastes',3],['Sirach 2','sirach-ecclesiasticus',2],['Sirach 6','sirach-ecclesiasticus',6]]},
    {icon:'⚑',title:'Need courage',line:'For steadiness when something difficult is in front of you.',tone:'Steady · major',passages:[['Joshua 1','joshua',1],['Psalm 27','psalms',27],['2 Timothy 1','2-timothy',1]]},
    {icon:'↺',title:'Want to reset',line:'Repentance, return and starting again.',tone:'Penitent · minor → major',passages:[['Psalm 51','psalms',51],['Prayer of Manasseh','prayer-of-manasseh',1],['Luke 15','luke',15]]}
  ];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const route=(slug,c)=>`#read/${slug}/${c}`;

  function renderFeelings(){
    feelingMode=true;
    const box=$('#drawerBooks');if(!box)return;
    box.innerHTML=`<section class="feelingGuide"><div class="feelingIntro"><span>HOW ARE YOU ARRIVING?</span><h3>What are you feeling?</h3><p>Choose a feeling and go straight to a few passages that fit the moment. There is no wrong choice — this is simply a gentler way into the library.</p></div><div class="feelingGrid">${moods.map(m=>`<article class="feelingCard"><div class="feelingCardHead"><i>${m.icon}</i><div><h4>${esc(m.title)}</h4><small>${esc(m.tone)}</small></div></div><p>${esc(m.line)}</p><div class="feelingPassages">${m.passages.map(p=>`<a href="${route(p[1],p[2])}">${esc(p[0])}<span>→</span></a>`).join('')}</div></article>`).join('')}</div><p class="feelingFoot">These suggestions are devotional pathways, not claims that one passage has only one meaning or purpose.</p></section>`;
    box.querySelectorAll('.feelingPassages a').forEach(a=>a.addEventListener('click',()=>$('#closeDrawer')?.click()));
  }

  function bindFilterResets(){
    $$('#filters button:not(#feelingFilter)').forEach(b=>{if(b.dataset.feelingReset)return;b.dataset.feelingReset='1';b.addEventListener('click',()=>{feelingMode=false})});
  }
  function addFeelingTab(){
    const filters=$('#filters');if(!filters)return;
    if(!$('#feelingFilter')){
      const b=document.createElement('button');b.id='feelingFilter';b.type='button';b.textContent='What are you feeling?';filters.appendChild(b);
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();$$('#filters button').forEach(x=>x.classList.toggle('active',x===b));renderFeelings()});
    }
    bindFilterResets();
  }
  function openFeelingGuide(){
    $('#menuBtn')?.click();
    setTimeout(()=>$('#feelingFilter')?.click(),60);
  }
  function addHomeEntry(){
    const hero=$('.heroActions');if(hero&&!$('#homeFeelingBtn')){const b=document.createElement('button');b.id='homeFeelingBtn';b.className='pill';b.innerHTML='♡ What are you feeling?';b.onclick=openFeelingGuide;hero.appendChild(b)}
  }
  function init(){
    addFeelingTab();addHomeEntry();
    new MutationObserver(()=>{addFeelingTab();addHomeEntry();if(feelingMode&&$('#drawer')?.getAttribute('aria-hidden')==='false'&&!$('#drawerBooks .feelingGuide'))renderFeelings()}).observe(document.body,{childList:true,subtree:true});
    addEventListener('hashchange',()=>setTimeout(addHomeEntry,80));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
