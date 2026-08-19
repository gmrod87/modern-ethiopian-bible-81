const fs=require('fs');
const path=require('path');
const v='52';
const D='dist';
const read=f=>fs.existsSync(path.join(D,f))?fs.readFileSync(path.join(D,f),'utf8'):'';
const write=(f,s)=>fs.writeFileSync(path.join(D,f),s);
const copy=(src,dst)=>{const s=path.join(D,src),d=path.join(D,dst);if(fs.existsSync(s))fs.copyFileSync(s,d)};

/* Cache-safe brand assets. */
for(const n of ['favicon','icon-180','icon-192','icon-512','share']){
  const base=n==='favicon'?'hobah-favicon.png':n==='share'?'hobah-share.png':`hobah-${n}.png`;
  const out=n==='favicon'?`hobah-favicon-v${v}.png`:n==='share'?`hobah-share-v${v}.png`:`hobah-${n}-v${v}.png`;
  copy(base,out);
}

/* Make the desired home/header markup native to app.js so no DOM observers are needed. */
let app=read('app.js');
if(app){
  app=app.replace("let corpora={ot:null,eth:null,nt:null}, speech={token:0,index:0,playing:false,paused:false,verses:[]};","let corpora={ot:null,eth:null,nt:null}, speech={token:0,index:0,playing:false,paused:false,verses:[]}, drawerFilter=null;");
  app=app.replace("window.MEB_BOOKS_PROMISE=window.MEB_BOOKS_PROMISE||fetch('/books.json').then(r=>r.json());","window.MEB_BOOKS_PROMISE=window.MEB_BOOKS_PROMISE||fetch('/books.json',{cache:'force-cache'}).then(r=>r.json());");
  app=app.replace("const b=await fetch('/data/'+encodeURIComponent(slug)+'.json').then(r=>{if(!r.ok)throw Error('Book unavailable');return r.json()});","const b=await fetch('/data/'+encodeURIComponent(slug)+'.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Book unavailable');return r.json()});");
  app=app.replace("const b64=await fetch(`/${cat}.b64`).then(r=>{if(!r.ok)throw Error('Corpus unavailable');return r.text()});","const b64=await fetch(`/${cat}.b64`,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Corpus unavailable');return r.text()});");
  app=app.replace("function renderDrawer(filter='all'){\n  const list=books.filter(b=>filter==='all'||b.category===filter);","function renderDrawer(filter='all'){\n  const box=$('#drawerBooks');\n  if(drawerFilter===filter&&box.children.length)return;\n  drawerFilter=filter;\n  const list=books.filter(b=>filter==='all'||b.category===filter);");
  app=app.replace("  $('#drawerBooks').innerHTML=list.map(b=>`<a class=\"drawerBook\" href=\"${route(b.slug,1)}\"><i>${String(b.order).padStart(2,'0')}</i><span>${esc(b.title)}</span><small>${b.chapters.length} ch.</small></a>`).join('');\n  $$('#drawerBooks a').forEach(a=>a.addEventListener('click',closeDrawer));","  box.innerHTML=list.map(b=>`<a class=\"drawerBook\" href=\"${route(b.slug,1)}\"><i>${String(b.order).padStart(2,'0')}</i><span>${esc(b.title)}</span><small>${b.chapters.length} ch.</small></a>`).join('');");
  app=app.replace('    <div class="ornament"><span>✦</span><i></i><b>፨</b><i></i><span>✦</span></div>\n','');
  app=app.replace('<h1>Modern<br><em>Ethiopian</em> Bible</h1>','<h1 class="ancientCanonTitle"><span class="ancientLine1">The</span><span class="ancientLine2">Ancient</span><span class="ancientLine3">Canon</span></h1>');
  app=app.replace("artist:'Modern Ethiopian Bible'","artist:'Hobah'");
  app=app.replace("$('#menuBtn').onclick=()=>openDrawer('all');const homeBtn=$('#homeBtn');if(homeBtn)homeBtn.onclick=e=>{e.preventDefault();closeDrawer();if(location.hash==='#home')renderHome();else location.hash='#home'};$('#closeDrawer').onclick=closeDrawer;$('#backdrop').onclick=closeDrawer;$$('#filters button').forEach(b=>b.onclick=()=>setFilter(b.dataset.filter));","$('#menuBtn').onclick=()=>openDrawer('all');const homeBtn=$('#homeBtn');if(homeBtn)homeBtn.onclick=e=>{e.preventDefault();closeDrawer();if(location.hash==='#home'||!location.hash){scrollTo({top:0});return}else location.hash='#home'};$('#closeDrawer').onclick=closeDrawer;$('#backdrop').onclick=closeDrawer;$('#drawerBooks').onclick=e=>{if(e.target.closest('a'))closeDrawer()};$$('#filters button').forEach(b=>b.onclick=()=>setFilter(b.dataset.filter));");
  write('app.js',app);
}

/* Use the lean route-aware feature loader. */
if(fs.existsSync('release52-feature-loader.js'))fs.copyFileSync('release52-feature-loader.js',path.join(D,'feature-loader.js'));
if(fs.existsSync('release52-performance.css'))fs.copyFileSync('release52-performance.css',path.join(D,'release52-performance.css'));

/* One service worker lifecycle; fast static/data cache, network-first navigation, API bypass. */
const sw=`const V='hobah-v52-fast';\nconst CORE='hobah-core-v52';\nconst DATA='hobah-data-v52';\nconst shell=['/','/index.html','/hobah-v52.css','/app.js?v=29','/feature-loader.js?v=52','/natural-audio.js?v=29','/read-aloud-v2.js?v=29','/books.json','/hobah-mark.svg?v=52'];\nself.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(CORE);await Promise.allSettled(shell.map(u=>c.add(u)));await self.skipWaiting()})())});\nself.addEventListener('activate',event=>{event.waitUntil((async()=>{const keep=new Set([CORE,DATA]);for(const k of await caches.keys())if(!keep.has(k))await caches.delete(k);await self.clients.claim()})())});\nself.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const u=new URL(req.url);if(u.origin!==location.origin||u.pathname.startsWith('/api/'))return;if(req.mode==='navigate'){event.respondWith((async()=>{try{const fresh=await fetch(req);const c=await caches.open(CORE);c.put('/index.html',fresh.clone());return fresh}catch{return (await caches.match('/index.html'))||Response.error()}})());return;}const data=/\\.(json|b64)(?:$|\\?)/.test(u.pathname)||u.pathname.startsWith('/data/');event.respondWith((async()=>{const cache=await caches.open(data?DATA:CORE);const hit=await cache.match(req);if(hit)return hit;const fresh=await fetch(req);if(fresh.ok)cache.put(req,fresh.clone());return fresh})())});\n`;
write('sw.js',sw);

/* Collapse render-blocking CSS into one file in the same cascade order. */
const cssFiles=['styles.css','study.css','study-hub.css','research-suite.css','chronology.css','experience.css','read-aloud-v2.css','release47-codex.css','release48-hobah.css','release51-ancient-canon.css','release52-performance.css'];
const bundle=cssFiles.filter(f=>fs.existsSync(path.join(D,f))).map(f=>`/* ${f} */\n${read(f)}`).join('\n');
write(`hobah-v${v}.css`,bundle);

let html=read('index.html');
if(html){
  /* Remove obsolete runtime layers that repeatedly mutate the header/app. */
  html=html.replace(/\s*<script[^>]+src=["']\/release39-runtime\.js[^"']*["'][^>]*><\/script>/g,'');
  html=html.replace(/\s*<script[^>]+src=["']\/release47-codex\.js[^"']*["'][^>]*><\/script>/g,'');
  html=html.replace(/\s*<script[^>]+src=["']\/release48-hobah\.js[^"']*["'][^>]*><\/script>/g,'');
  html=html.replace(/\s*<script[^>]+src=["']\/release51-ancient-canon\.js[^"']*["'][^>]*><\/script>/g,'');
  /* Replace all render-blocking style links with the single ordered bundle. */
  html=html.replace(/\s*<link[^>]+rel=["']stylesheet["'][^>]*>/g,'');
  html=html.replace('</head>',`  <link rel="preload" href="/hobah-mark.svg?v=${v}" as="image" type="image/svg+xml" />\n  <link rel="stylesheet" href="/hobah-v${v}.css" />\n</head>`);
  html=html.replace(/<span class="brandCross">[\s\S]*?<\/span>/,'<span class="brandCross"><img class="hobahHeaderMark" src="/hobah-mark.svg?v=52" alt="" width="42" height="42" decoding="async" fetchpriority="high" /></span>');
  html=html.replace(/placeholder="Search[^\"]*"/,'placeholder="Search…"');
  html=html.replace(/hobah-icon-180-v\d+\.png/g,`hobah-icon-180-v${v}.png`);
  html=html.replace(/hobah-share-v\d+\.png\?v=\d+/g,`hobah-share-v${v}.png?v=${v}`);
  html=html.replace(/hobah-favicon-v\d+\.png\?v=\d+/g,`hobah-favicon-v${v}.png?v=${v}`);
  html=html.replace(/hobah-mark\.svg\?v=\d+/g,`hobah-mark.svg?v=${v}`);
  html=html.replace(/feature-loader\.js\?v=\d+/g,`feature-loader.js?v=${v}`);
  write('index.html',html);
}

/* Update manifest/cache-safe icons. */
const mp=path.join(D,'manifest.webmanifest');
if(fs.existsSync(mp))try{const m=JSON.parse(fs.readFileSync(mp,'utf8'));m.icons=[{src:`/hobah-icon-192-v${v}.png`,sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:`/hobah-icon-512-v${v}.png`,sizes:'512x512',type:'image/png',purpose:'any maskable'}];fs.writeFileSync(mp,JSON.stringify(m))}catch(e){console.warn('Release52 manifest skipped',e.message)}

const rp=path.join(D,'recovery.html');
if(fs.existsSync(rp)){let r=fs.readFileSync(rp,'utf8');r=r.replace(/fresh=\d+/g,`fresh=${v}`).replace(/v=\d+/g,`v=${v}`);fs.writeFileSync(rp,r)}

console.log('Hobah Release 52 performance, cache and header responsiveness pass applied');
