(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  let books=[],chronoMode=false;
  const categoryLabel={ot:'Old Testament',eth:'Ethiopian canon',nt:'New Testament'};

  // Approximate scholarly composition/final-form dating. Many biblical books are
  // composite, so these labels intentionally use ranges rather than pretending
  // there is one uncontested year of authorship.
  const dates={
    'genesis':{label:'Final form c. 6th–5th c. BCE',sort:-550},
    'exodus':{label:'Final form c. 6th–5th c. BCE',sort:-545},
    'leviticus':{label:'Final form c. 6th–5th c. BCE',sort:-535},
    'numbers':{label:'Final form c. 6th–5th c. BCE',sort:-530},
    'deuteronomy':{label:'Core/final form c. 7th–6th c. BCE',sort:-620},
    'joshua':{label:'Final form c. 7th–6th c. BCE',sort:-610},
    'judges':{label:'Final form c. 7th–6th c. BCE',sort:-605},
    'ruth':{label:'Often dated c. 5th–4th c. BCE',sort:-450},
    '1-samuel':{label:'Final form c. 7th–6th c. BCE',sort:-600},
    '2-samuel':{label:'Final form c. 7th–6th c. BCE',sort:-598},
    '1-kings':{label:'Final form c. 6th c. BCE',sort:-570},
    '2-kings':{label:'Final form c. 6th c. BCE',sort:-565},
    '1-chronicles':{label:'c. 4th c. BCE',sort:-350},
    '2-chronicles':{label:'c. 4th c. BCE',sort:-348},
    'ezra':{label:'c. 5th–4th c. BCE',sort:-430},
    'nehemiah':{label:'c. 5th–4th c. BCE',sort:-425},
    'esther':{label:'c. 4th–2nd c. BCE',sort:-300},
    'job':{label:'Date debated; often c. 7th–4th c. BCE',sort:-500},
    'psalms':{label:'Collection c. 10th–3rd c. BCE',sort:-700},
    'proverbs':{label:'Collection c. 10th–4th c. BCE',sort:-650},
    'ecclesiastes':{label:'c. 3rd c. BCE',sort:-250},
    'song-of-songs':{label:'Collection c. 10th–3rd c. BCE',sort:-640},
    'isaiah':{label:'Material c. 8th–6th c. BCE',sort:-740},
    'jeremiah':{label:'Late 7th–6th c. BCE',sort:-625},
    'lamentations':{label:'Soon after 586 BCE',sort:-585},
    'ezekiel':{label:'c. 593–571 BCE',sort:-580},
    'daniel':{label:'Final form c. 167–164 BCE',sort:-165},
    'hosea':{label:'c. 8th c. BCE',sort:-750},
    'amos':{label:'c. 760s–750s BCE',sort:-760},
    'micah':{label:'c. 8th c. BCE',sort:-735},
    'joel':{label:'Date debated; often c. 5th–4th c. BCE',sort:-440},
    'obadiah':{label:'Often c. 6th c. BCE',sort:-560},
    'jonah':{label:'Often c. 5th–4th c. BCE',sort:-420},
    'nahum':{label:'c. 7th c. BCE',sort:-650},
    'habakkuk':{label:'Late 7th c. BCE',sort:-610},
    'zephaniah':{label:'Late 7th c. BCE',sort:-630},
    'haggai':{label:'520 BCE',sort:-520},
    'zechariah':{label:'520 BCE onward; later material debated',sort:-518},
    'malachi':{label:'c. 5th c. BCE',sort:-460},

    'jubilees':{label:'Mid-2nd c. BCE',sort:-155},
    '1-enoch':{label:'Composite c. 3rd c. BCE–1st c. CE',sort:-250},
    '2-ezra-1-esdras':{label:'Often c. 2nd–1st c. BCE',sort:-120},
    'ezra-sutuel-4-ezra-apocalyptic-core':{label:'c. 100 CE',sort:100},
    'tobit':{label:'Often c. 3rd–2nd c. BCE',sort:-200},
    'judith':{label:'Often c. 2nd–1st c. BCE',sort:-100},
    '1-meqabyan':{label:'Composition date uncertain; Geʽez tradition',sort:9000,uncertain:true},
    '2-meqabyan':{label:'Composition date uncertain; Geʽez tradition',sort:9001,uncertain:true},
    '3-meqabyan':{label:'Composition date uncertain; Geʽez tradition',sort:9002,uncertain:true},
    'wisdom-of-solomon':{label:'Late 1st c. BCE–early 1st c. CE',sort:-25},
    'sirach-ecclesiasticus':{label:'c. 180 BCE',sort:-180},
    'baruch-and-letter-of-jeremiah':{label:'Parts likely 2nd–1st c. BCE',sort:-110},
    '4-baruch-paralipomena-of-jeremiah':{label:'Early 2nd c. CE',sort:125},
    'prayer-of-manasseh':{label:'Date debated; late Jewish/early Christian era',sort:-20},
    'daniel-greek-additions':{label:'Hellenistic era, c. 2nd–1st c. BCE',sort:-140},

    'matthew':{label:'c. 70–90 CE',sort:80},
    'mark':{label:'c. 65–75 CE',sort:70},
    'luke':{label:'c. 70–90 CE',sort:82},
    'john':{label:'c. 90–100 CE',sort:95},
    'acts':{label:'c. 80–90 CE',sort:85},
    'romans':{label:'c. 56–58 CE',sort:57},
    '1-corinthians':{label:'c. 53–55 CE',sort:54},
    '2-corinthians':{label:'c. 55–56 CE',sort:55},
    'galatians':{label:'c. 48–55 CE',sort:52},
    'ephesians':{label:'c. 60–90 CE; authorship debated',sort:75},
    'philippians':{label:'c. 55–62 CE',sort:60},
    'colossians':{label:'c. 60–80 CE; authorship debated',sort:68},
    '1-thessalonians':{label:'c. 49–51 CE',sort:50},
    '2-thessalonians':{label:'c. 50–90 CE; authorship debated',sort:65},
    '1-timothy':{label:'c. 80–100 CE; authorship debated',sort:90},
    '2-timothy':{label:'c. 80–100 CE; authorship debated',sort:91},
    'titus':{label:'c. 80–100 CE; authorship debated',sort:92},
    'philemon':{label:'c. 55–62 CE',sort:59},
    'hebrews':{label:'c. 60–90 CE',sort:76},
    'james':{label:'c. 50–100 CE; date debated',sort:72},
    '1-peter':{label:'c. 60–90 CE',sort:78},
    '2-peter':{label:'c. 100–130 CE',sort:115},
    '1-john':{label:'c. 90–110 CE',sort:100},
    '2-john':{label:'c. 90–110 CE',sort:101},
    '3-john':{label:'c. 90–110 CE',sort:102},
    'jude':{label:'c. 60–100 CE',sort:88},
    'revelation':{label:'c. 90–96 CE',sort:94}
  };

  const researchDates={
    'testament-abraham':{label:'c. 1st–2nd c. CE; date debated',sort:120},
    '2-enoch':{label:'Often dated c. 1st c. CE; highly debated',sort:70},
    '1-clement':{label:'c. 96 CE',sort:96},
    'didache':{label:'Late 1st–early 2nd c. CE',sort:105},
    'odes-solomon':{label:'Late 1st–2nd c. CE',sort:115},
    'shepherd-hermas':{label:'Early–mid 2nd c. CE',sort:140},
    'gospel-thomas':{label:'Final form often dated 2nd c. CE; debated',sort:150},
    '3-enoch':{label:'Late antique, commonly c. 5th–6th c. CE',sort:550}
  };

  const dateFor=slug=>dates[slug]||{label:'Dating debated',sort:8999,uncertain:true};
  const researchFor=id=>researchDates[id]||{label:'Dating debated',sort:8999,uncertain:true};

  function addChronologyTab(){
    const filters=$('#filters');if(!filters||$('#chronoFilter'))return;
    const b=document.createElement('button');b.id='chronoFilter';b.type='button';b.textContent='Chronological';filters.appendChild(b);
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();chronoMode=true;$$('#filters button').forEach(x=>x.classList.toggle('active',x===b));renderChronological()});
    [...filters.querySelectorAll('button:not(#chronoFilter)')].forEach(x=>x.addEventListener('click',()=>{chronoMode=false;setTimeout(decorateRegular,0)}));
  }

  function decorateRegular(){
    if(chronoMode)return;
    $$('#drawerBooks .drawerBook').forEach(el=>{
      const href=el.getAttribute('href')||'',m=href.match(/#read\/([^/]+)/);if(!m)return;
      const d=dateFor(m[1]),title=el.querySelector(':scope > span');if(!title||title.querySelector('.bookDate'))return;
      const em=document.createElement('em');em.className='bookDate';em.textContent=d.label;em.title='Approximate composition/final-form dating; scholarly estimates can vary.';title.appendChild(em);
    });
  }

  function renderChronological(){
    const box=$('#drawerBooks');if(!box)return;
    const canon=books.map((b,index)=>({kind:'canon',title:b.title,slug:b.slug,category:b.category,chapters:b.chapters?.length||0,index,date:dateFor(b.slug)}));
    const research=(window.MEB_RESEARCH_DATA?.researchBooks||[]).map(x=>({kind:'research',title:x.title,id:x.id,status:x.status,date:researchFor(x.id)}));
    const all=[...canon,...research].sort((a,b)=>a.date.sort-b.date.sort||(a.index??999)-(b.index??999));
    box.innerHTML=`<div class="chronoNote"><b>Approximate composition timeline</b><span>Dates refer to composition or final literary form, not the time in which the story is set. Composite and disputed works are shown as ranges. Research Library works are marked separately from the 81-book canon.</span></div>${all.map((x,i)=>x.kind==='canon'?`<a class="drawerBook chronoBook" data-chrono-canon="1" href="#read/${x.slug}/1"><i>${String(i+1).padStart(2,'0')}</i><span><b>${escapeHtml(x.title)}</b><em>${categoryLabel[x.category]||'Canon'}</em></span><small>${escapeHtml(x.date.label)}</small></a>`:`<button class="drawerBook chronoBook chronoResearch" type="button" data-chrono-research="${escapeAttr(x.id)}"><i>${String(i+1).padStart(2,'0')}</i><span><b>${escapeHtml(x.title)}</b><em>Research Library · not part of the 81-book canon</em></span><small>${escapeHtml(x.date.label)}</small></button>`).join('')}`;
    $$('[data-chrono-research]').forEach(b=>b.onclick=()=>openResearch(b.dataset.chronoResearch));
  }

  function openResearch(id){
    $('#closeDrawer')?.click();
    let tries=0;
    const open=()=>{
      tries++;
      const tab=$('#researchTabs [data-tab="library"]');
      if(tab){tab.click();setTimeout(()=>{const target=document.querySelector(`[data-rbook="${CSS.escape(id)}"]`);target?.click()},100);return}
      if(tries<20)setTimeout(open,100);
    };
    open();
  }

  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function escapeAttr(s){return escapeHtml(s).replace(/`/g,'&#96;')}

  async function init(){
    try{books=await fetch('/books.json').then(r=>r.json())}catch{return}
    addChronologyTab();decorateRegular();
    const box=$('#drawerBooks');if(box)new MutationObserver(()=>{if(!chronoMode)decorateRegular()}).observe(box,{childList:true,subtree:true});
    new MutationObserver(()=>{addChronologyTab();if(!chronoMode)decorateRegular()}).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
