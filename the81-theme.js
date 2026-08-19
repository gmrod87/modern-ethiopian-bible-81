(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const A='/assets/the81/';
  const art={creation:A+'creation.svg',exodus:A+'exodus.svg',babel:A+'babel.svg',esther:A+'esther.svg',psalms:A+'psalms.svg',gospel:A+'gospel.svg'};
  const groups={
    creation:new Set(['genesis','jubilees','1-enoch','ezra-sutuel-4-ezra-apocalyptic-core','ezekiel','daniel','daniel-greek-additions','revelation']),
    exodus:new Set(['exodus','leviticus','numbers','deuteronomy','joshua','judges','1-meqabyan','2-meqabyan','3-meqabyan','prayer-of-manasseh']),
    esther:new Set(['ruth','esther','tobit','judith','song-of-songs','wisdom-of-solomon','sirach-ecclesiasticus','philemon']),
    psalms:new Set(['job','psalms','proverbs','ecclesiastes','lamentations','james']),
    gospel:new Set(['matthew','mark','luke','john','acts','romans','1-corinthians','2-corinthians','galatians','ephesians','philippians','colossians','1-thessalonians','2-thessalonians','1-timothy','2-timothy','titus','hebrews','1-peter','2-peter','1-john','2-john','3-john','jude'])
  };
  const slugFromHref=href=>{const m=String(href||'').match(/#(?:read|book)\/([^/]+)/);return m?.[1]||''};
  function artFor(slug){for(const [name,set] of Object.entries(groups))if(set.has(slug))return art[name];return art.babel}
  function currentSlug(){const m=location.hash.match(/^#(?:read|book)\/([^/]+)/);return m?.[1]||'genesis'}
  function brand(){document.title='The 81';const b=$('#homeBtn');if(b){b.setAttribute('aria-label','The 81 home');b.innerHTML='<span class="brandTitle"><b>The 81</b><small>The Complete 81 Books</small></span>'}const meta=document.querySelector('meta[name="description"]');if(meta)meta.content='The 81 — read, listen, search and study the complete 81-book Ethiopian Bible edition.';const search=$('#searchInput');if(search)search.placeholder='Search The 81…'}
  function decorateHome(){const hero=$('.hero');if(!hero)return;hero.style.setProperty('--card-art',`url('${art.creation}')`);const eye=hero.querySelector('.eyebrow');if(eye)eye.textContent='THE COMPLETE 81 BOOKS';const h=hero.querySelector('h1');if(h&&!h.querySelector('.theNumber'))h.innerHTML='<span class="theWord">The</span><span class="theNumber">81</span>';const p=hero.querySelector('p');if(p)p.textContent='The Word. The Story. The Way. Read, listen, search and study all 81 books in a clean, immersive edition.';const badge=hero.querySelector('.nativeBadge span');if(badge)badge.textContent='81 books · natural narration · Study AI · historical context';$$('.bookTile,.featureCard').forEach(el=>{const s=slugFromHref(el.getAttribute('href'));if(s)el.style.setProperty('--card-art',`url('${artFor(s)}')`)});const catArts={ot:art.babel,eth:art.creation,nt:art.gospel,all:art.esther};$$('.category').forEach(el=>el.style.setProperty('--card-art',`url('${catArts[el.dataset.cat]||art.creation}')`))}
  function decorateReader(){const slug=currentSlug(),img=artFor(slug);document.body.style.setProperty('--book-art',`url('${img}')`);const reader=$('.reader');if(reader){reader.dataset.bookArt=slug;reader.style.setProperty('--card-art',`url('${img}')`)}}
  function decorateDrawer(){$$('.drawerBook').forEach(el=>{const s=slugFromHref(el.getAttribute('href'));el.style.setProperty('--card-art',`url('${artFor(s)}')`)})}
  function decorate(){brand();decorateReader();decorateDrawer();if(location.hash==='#home'||!location.hash)decorateHome()}
  const app=$('#app');if(app)new MutationObserver(()=>requestAnimationFrame(decorate)).observe(app,{childList:true,subtree:true});
  const drawer=$('#drawerBooks');if(drawer)new MutationObserver(decorateDrawer).observe(drawer,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(decorate,30));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate);else decorate();
})();
