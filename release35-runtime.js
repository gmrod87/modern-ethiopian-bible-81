(()=>{
  const cache=new Map();
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const slugFrom=href=>{const m=String(href||'').match(/#(?:read|book)\/([^/]+)/);return m?.[1]||''};
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function key(slug,title){const t=(slug+' '+title).toLowerCase();
    if(/genesis|jubilee/.test(t))return'creation';
    if(/exodus/.test(t))return'exodus';
    if(/leviticus/.test(t))return'altar';
    if(/numbers/.test(t))return'camp';
    if(/deuteronomy|ezra|baruch|timothy|letter/.test(t))return'scroll';
    if(/joshua|nehemiah/.test(t))return'walls';
    if(/judges|judith|meqabyan/.test(t))return'sword';
    if(/ruth/.test(t))return'wheat';
    if(/samuel|psalm/.test(t))return'harp';
    if(/kings|chronicles|esther/.test(t))return'crown';
    if(/job/.test(t))return'whirlwind';
    if(/proverbs|wisdom|sirach/.test(t))return'lamp';
    if(/ecclesiastes|malachi/.test(t))return'sun';
    if(/song.of.songs/.test(t))return'garden';
    if(/isaiah/.test(t))return'wing';
    if(/jeremiah|lamentations/.test(t))return'jar';
    if(/ezekiel/.test(t))return'wheel';
    if(/daniel/.test(t))return'lions';
    if(/enoch|revelation/.test(t))return'stars';
    if(/jonah|tobit/.test(t))return'fish';
    if(/matthew|mark|luke|john|gospel/.test(t))return'gospel';
    if(/acts|joel/.test(t))return'flame';
    if(/romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|titus|philemon|hebrews|james|peter|jude/.test(t))return'epistle';
    if(/ethiop|meqabyan|manasseh|4.baruch|2.enoch/.test(t))return'ethiopic';
    return'manuscript';
  }
  function scene(k,ink,gold,cream){
    const S=`stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    const G=`stroke="${gold}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    const human=(x,y,s=1)=>`<circle cx="${x}" cy="${y}" r="${18*s}" fill="${ink}"/><path d="M${x} ${y+20*s}v${80*s}M${x} ${y+45*s}l-${32*s} ${45*s}M${x} ${y+45*s}l${32*s} ${45*s}M${x} ${y+100*s}l-${24*s} ${55*s}M${x} ${y+100*s}l${24*s} ${55*s}" ${S}/>`;
    const waves=`<path d="M135 610q55-42 110 0t110 0t110 0t110 0t110 0" ${G}/><path d="M120 655q62-44 124 0t124 0t124 0t124 0" ${G} opacity=".72"/>`;
    const stars=`<g fill="${gold}"><circle cx="205" cy="210" r="8"/><circle cx="300" cy="160" r="5"/><circle cx="410" cy="205" r="7"/><circle cx="565" cy="165" r="6"/><circle cx="630" cy="250" r="5"/></g>`;
    const map={
      creation:`${stars}<circle cx="220" cy="300" r="54" fill="${gold}" opacity=".9"/><path d="M535 255a76 76 0 1 0 0 152a58 58 0 1 1 0-152Z" fill="${cream}" opacity=".86"/><path d="M125 635 285 420l90 118 90-155 210 252Z" ${S}/><path d="M395 650V405M395 470q-95-12-122-92q95-4 122 92M395 480q98-18 128-96q-98 0-128 96" ${G}/>${waves}<path d="M170 395q40-40 80 0M560 410q35-35 70 0" ${S}/>` ,
      exodus:`${stars}<path d="M165 590q72-135 160-215q-5 145 58 260M635 590q-72-135-160-215q5 145-58 260" ${G}/>${waves}<path d="M300 585 405 335 520 585" ${S}/><path d="M405 335v-100M365 270l40-45 40 45" ${G}/>${human(400,455,.7)}<path d="M435 500l55-115" ${S}/>` ,
      altar:`<path d="M180 600h440M235 600V355h330v245M200 355h400L400 215Z" ${S}/><path d="M325 600V430h150v170" ${G}/><path d="M300 500h200l-35-110H335Z" ${S}/><path d="M395 390q-55-72 10-135q-7 62 40 86q-2-62 44-91q45 102-44 140" ${G}/><circle cx="260" cy="300" r="10" fill="${gold}"/><circle cx="540" cy="300" r="10" fill="${gold}"/>` ,
      camp:`${stars}<path d="M135 620 255 420l120 200ZM330 620l105-180 115 180ZM520 620l80-135 90 135Z" ${S}/><path d="M160 620h520" ${G}/><path d="M400 245v125" ${G}/><circle cx="400" cy="225" r="26" fill="${gold}" opacity=".9"/>` ,
      scroll:`<path d="M255 250q-65 0-65 65t65 65v260q70-50 145 0q75-50 145 0V380q65 0 65-65t-65-65Z" fill="${cream}" opacity=".28" ${S}/><path d="M300 355h200M300 425h200M300 495h155M300 565h175" ${G}/><path d="M235 250h330M235 640h330" ${S}/>` ,
      walls:`${stars}<path d="M140 625V390h95v70h80v-115h95v115h80v-70h105v235Z" ${S}/><path d="M330 625V510h140v115" ${G}/><path d="M150 625h500" ${G}/><path d="M215 330q185-115 370 0" ${G}/><circle cx="400" cy="255" r="55" fill="${gold}" opacity=".34"/>` ,
      sword:`<path d="M400 195v330M335 525h130M360 525l40 130 40-130M365 195h70l-35-85Z" ${S}/><path d="M250 285q150 115 300 0M245 580q155-85 310 0" ${G}/><circle cx="235" cy="265" r="12" fill="${gold}"/><circle cx="565" cy="265" r="12" fill="${gold}"/>` ,
      wheat:`<path d="M400 650V250" ${S}/><path d="M400 350q-105-18-130-100q102 4 130 100M400 425q105-18 130-100q-102 4-130 100M400 500q-105-18-130-100q102 4 130 100M400 575q105-18 130-100q-102 4-130 100" ${G}/><path d="M140 650q110-140 220-20M660 650q-110-140-220-20" ${S}/>${human(240,475,.55)}${human(560,500,.5)}` ,
      harp:`${stars}<path d="M255 235q205 42 305 385M255 235v385h305" ${S}/><path d="M300 305v270M345 330v245M390 360v215M435 395v180M480 435v140" ${G}/><path d="M160 650q240-90 480 0" ${G}/>` ,
      crown:`<path d="M210 520 260 285l140 130 140-130 50 235Z" fill="${cream}" opacity=".2" ${S}/><path d="M230 570h340" ${G}/><circle cx="260" cy="285" r="16" fill="${gold}"/><circle cx="400" cy="415" r="16" fill="${gold}"/><circle cx="540" cy="285" r="16" fill="${gold}"/><path d="M170 650q230-80 460 0" ${G}/>` ,
      whirlwind:`<path d="M155 285q300-125 485 25q-225-70-440 72q255-52 400 82q-210-65-365 58q170-30 270 80" ${S}/><path d="M250 650q150-110 300 0" ${G}/>${stars}` ,
      lamp:`<path d="M315 535h170l-38-145h-94Z" ${S}/><path d="M400 390q-85-80 0-180q85 100 0 180Z" fill="${gold}" opacity=".6" ${G}/><path d="M345 585h110M270 645h260" ${G}/><path d="M220 300q180-90 360 0" ${S}/>` ,
      sun:`<circle cx="400" cy="390" r="110" fill="${gold}" opacity=".2" ${S}/><path d="M400 180v-70M400 670v-70M190 390h-70M680 390h-70M250 240l-55-55M605 595l-55-55M550 240l55-55M195 595l55-55" ${G}/><path d="M165 650q235-115 470 0" ${S}/>` ,
      garden:`<path d="M400 650V390M400 390q-125-8-165-130q130-15 165 130M400 390q125-8 165-130q-130-15-165 130M400 390q-78-115 0-205q78 90 0 205" ${G}/><path d="M160 650q80-135 160-35M640 650q-80-135-160-35" ${S}/><circle cx="220" cy="500" r="18" fill="${gold}"/><circle cx="590" cy="470" r="14" fill="${gold}"/>` ,
      wing:`<path d="M400 535q-175-35-225-225q145 18 225 145q80-127 225-145q-50 190-225 225Z" fill="${cream}" opacity=".18" ${S}/><circle cx="400" cy="285" r="52" ${G}/><path d="M400 337v255M315 650q85-95 170 0" ${S}/>${stars}` ,
      jar:`<path d="M300 300h200l-32 72q60 60 40 230H292q-20-170 40-230Z" fill="${cream}" opacity=".2" ${S}/><path d="M340 300v-62h120v62M330 455q70 65 140 0" ${G}/><path d="M190 650q210-80 420 0" ${S}/>` ,
      wheel:`<circle cx="400" cy="420" r="165" ${S}/><circle cx="400" cy="420" r="82" ${G}/><path d="M400 255v330M235 420h330M285 305l230 230M515 305 285 535" ${S}/><g fill="${gold}"><circle cx="400" cy="255" r="9"/><circle cx="565" cy="420" r="9"/><circle cx="400" cy="585" r="9"/><circle cx="235" cy="420" r="9"/></g>` ,
      lions:`<circle cx="285" cy="430" r="100" ${S}/><circle cx="515" cy="430" r="100" ${S}/><path d="M220 380q65-65 130 0M450 380q65-65 130 0M245 480q40 35 80 0M475 480q40 35 80 0" ${G}/><circle cx="265" cy="420" r="6" fill="${ink}"/><circle cx="305" cy="420" r="6" fill="${ink}"/><circle cx="495" cy="420" r="6" fill="${ink}"/><circle cx="535" cy="420" r="6" fill="${ink}"/>${human(400,500,.55)}` ,
      stars:`${stars}<path d="m400 235 42 118 125 3-100 75 36 120-103-70-103 70 36-120-100-75 125-3Z" ${G}/><path d="M165 650h470M235 650V520h80v130M355 650V470h90v180M485 650V535h80v115" ${S}/>` ,
      fish:`${waves}<path d="M210 435q170-170 370 0q-200 170-370 0Zm370 0 110-95v190Z" ${S}/><circle cx="305" cy="410" r="10" fill="${gold}"/><path d="M160 295q240-105 480 0" ${G}/>` ,
      gospel:`${stars}<path d="M400 195v410M285 330h230" ${S}/><path d="M255 570q-110-90-55-220q120 35 165 160M545 570q110-90 55-220q-120 35-165 160" ${G}/><circle cx="400" cy="410" r="150" ${G} opacity=".45"/>` ,
      flame:`<path d="M400 625q-155-90-75-245q32-62 88-140q-10 95 62 140q5-88 58-132q85 245-133 377Z" fill="${gold}" opacity=".28" ${S}/><path d="M170 650q230-85 460 0" ${G}/>` ,
      epistle:`<path d="M205 295h390v310H205Z" fill="${cream}" opacity=".16" ${S}/><path d="m205 295 195 170 195-170" ${G}/><path d="M545 210q-85 105-125 265M500 250l70 38" ${S}/><circle cx="560" cy="205" r="18" fill="${gold}"/>` ,
      ethiopic:`<path d="M400 180v420M285 325h230M335 245h130M335 520h130" ${G}/><path d="M400 180 330 245l70 80 70-80Z" ${S}/><path d="M400 600 330 520l70-80 70 80Z" ${S}/><path d="M210 650q190-110 380 0" ${G}/>${stars}` ,
      manuscript:`<path d="M250 245q-55 0-55 55t55 55v280q75-45 150 0q75-45 150 0V355q55 0 55-55t-55-55Z" fill="${cream}" opacity=".18" ${S}/><path d="M300 345h200M300 415h200M300 485h145M300 555h175" ${G}/>`
    };
    return map[k]||map.manuscript;
  }
  function make(slug,title){
    const id=slug+'|'+title;if(cache.has(id))return cache.get(id);
    const h=hash(id),pal=[['#263c40','#7f9da0','#d3ae79'],['#314843','#98a98f','#c99a69'],['#28383f','#8da5aa','#d4b48a'],['#3a4038','#9da28a','#c89267']][h%4];
    const ink='#18282b',gold='#c99b55',cream='#fff1c9';
    let corner='';for(let i=0;i<4;i++){const x=i%2?690:110,y=i>1?835:165;corner+=`<g transform="translate(${x} ${y}) rotate(${i%2?90:0})"><path d="M0 0q35-62 70 0q-35 62-70 0Z" fill="none" stroke="${cream}" stroke-width="2" opacity=".72"/><circle cx="35" cy="0" r="7" fill="${gold}"/></g>`}
    const rosette=`<g stroke="${gold}" fill="none" opacity=".82"><circle cx="400" cy="118" r="28"/><path d="M400 82v72M364 118h72M374 92l52 52M426 92l-52 52"/></g>`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${pal[0]}"/><stop offset=".52" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[2]}"/></linearGradient><pattern id="pat" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M17 2 32 17 17 32 2 17Z" fill="none" stroke="${cream}" stroke-width="1" opacity=".12"/></pattern><filter id="soft"><feGaussianBlur stdDeviation="18"/></filter></defs><rect width="800" height="1000" fill="url(#bg)"/><circle cx="650" cy="180" r="145" fill="${cream}" opacity=".08" filter="url(#soft)"/><rect width="800" height="1000" fill="url(#pat)"/><path d="M84 930V170q0-82 82-82h468q82 0 82 82v760" fill="none" stroke="${cream}" stroke-width="3" opacity=".62"/><path d="M112 930V186q0-62 62-62h452q62 0 62 62v744" fill="none" stroke="${ink}" stroke-width="2" opacity=".4"/><path d="M145 775q255 92 510 0" fill="none" stroke="${gold}" stroke-width="3" opacity=".78"/>${corner}${rosette}<g opacity=".95">${scene(key(slug,title),ink,gold,cream)}</g><rect x="48" y="48" width="704" height="904" rx="34" fill="none" stroke="${cream}" stroke-width="2" opacity=".42"/><rect x="62" y="62" width="676" height="876" rx="28" fill="none" stroke="${gold}" stroke-width="1.5" opacity=".55"/><text x="400" y="855" text-anchor="middle" fill="${cream}" font-family="Georgia,serif" font-size="31" letter-spacing="1.5">${esc(title.toUpperCase().slice(0,28))}</text><text x="400" y="895" text-anchor="middle" fill="${cream}" opacity=".68" font-family="Arial,sans-serif" font-size="13" letter-spacing="5">ILLUMINATED EDITION</text></svg>`;
    const uri=`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;cache.set(id,uri);return uri;
  }
  const io='IntersectionObserver'in window?new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){paint(e.target);io.unobserve(e.target)}},{rootMargin:'280px 0px'}):null;
  function paint(el){if(!el)return;const slug=el.dataset.r35Slug||'the-81',title=el.dataset.r35Title||'The 81';el.style.setProperty('--card-art',make(slug,title));el.dataset.r35Painted='1'}
  function queue(el,slug,title){if(!el)return;el.dataset.r35Slug=slug||'the-81';el.dataset.r35Title=title||slug||'The 81';if(el.dataset.r35Queued)return;el.dataset.r35Queued='1';if(io)io.observe(el);else paint(el)}
  function decorate(){
    $$('.bookTile').forEach(el=>queue(el,slugFrom(el.getAttribute('href')),el.querySelector('b')?.textContent?.replace(/\s+\d+$/,'')||'Book'));
    $$('.drawerBook').forEach(el=>queue(el,slugFrom(el.getAttribute('href')),el.querySelector('span')?.textContent||'Book'));
    $$('.featureCard[href]').forEach(el=>queue(el,slugFrom(el.getAttribute('href')),el.querySelector('b')?.textContent||'The 81'));
    $$('.category').forEach((el,i)=>queue(el,'collection-'+(el.dataset.cat||i),el.querySelector('b')?.textContent||'Collection'));
    const hero=$('.hero');if(hero)queue(hero,'genesis','The 81');
    const m=location.hash.match(/^#(?:read|book)\/([^/]+)/);if(m){const title=$('.readerHead h1')?.textContent||m[1];document.body.style.setProperty('--book-art',make(m[1],title))}
  }
  const app=$('#app'),drawer=$('#drawerBooks');
  if(app)new MutationObserver(()=>requestAnimationFrame(decorate)).observe(app,{childList:true,subtree:true});
  if(drawer)new MutationObserver(()=>requestAnimationFrame(decorate)).observe(drawer,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(decorate,20));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();
