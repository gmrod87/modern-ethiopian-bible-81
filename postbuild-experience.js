const {execFileSync}=require('child_process');
const fs=require('fs');
const path=require('path');
const release='30';

for(const f of ['experience.js','experience.css','ambient-audio.js','the81-theme.js','the81-theme.css']){
  if(fs.existsSync(f))fs.copyFileSync(f,'dist/'+f);
}

// Copy The 81 artwork into the actual production output.
const srcArt='the81-assets',dstArt='dist/assets/the81';
fs.mkdirSync(dstArt,{recursive:true});
if(fs.existsSync(srcArt))for(const name of fs.readdirSync(srcArt)){
  const src=path.join(srcArt,name),dst=path.join(dstArt,name);
  if(fs.statSync(src).isFile())fs.copyFileSync(src,dst);
}

// Until all per-book illustrations are uploaded, always fall back to the live Creation artwork.
for(const f of ['dist/the81-theme.css','dist/the81-theme.js'])if(fs.existsSync(f)){
  let s=fs.readFileSync(f,'utf8');
  s=s.replace(/\/assets\/the81\/(creation|exodus|babel|esther|psalms|gospel)\.webp/g,'/assets/the81/creation.svg');
  fs.writeFileSync(f,s);
}

// Keep mobile Home in the header flow so it cannot cover controls.
fs.appendFileSync('dist/styles.css',`\n/* Release ${release}: compact mobile Home */\n@media(max-width:900px){.topbar #homeBtn{position:static!important;inset:auto!important;left:auto!important;top:auto!important;transform:none!important;z-index:auto!important;flex:0 0 auto!important;margin:0!important}}\n`);

// Put Ambient Music inside Read Aloud without the old observer feedback loop.
{
  const p='dist/ambient-audio.js';
  let s=fs.readFileSync(p,'utf8');
  s=s.replace(/  function ensureControl\(\)\{[\s\S]*?\n  \}\n  function init\(\)\{/,
`  function ensureControl(){
    const modes=$('#audioModes'),ctr=$('.audioControls');
    let b=$('#audioAmbient');
    if(!b){if(!modes&&!ctr)return;b=document.createElement('button');b.id='audioAmbient';b.className='audioExtra audioAmbient';b.type='button'}
    b.onclick=toggleAmbient;
    if(modes){let row=$('#audioAmbientSetting');if(!row){row=document.createElement('div');row.id='audioAmbientSetting';row.className='audioAmbientSetting';row.innerHTML='<div class="audioAmbientCopy"><span>AMBIENT MUSIC</span><small>Quiet adaptive music behind Read Aloud</small></div>';modes.appendChild(row)}if(b.parentElement!==row)row.appendChild(b)}
    else if(ctr&&b.parentElement!==ctr){const sleep=$('#audioSleep'),close=$('#audioClose');ctr.insertBefore(b,sleep||close)}
    updateButton();
  }
  function init(){`);
  s=s.replace("    ensureControl();new MutationObserver(ensureControl).observe(document.body,{childList:true,subtree:true});","    ensureControl();let ambientObserver=null;if(!$('#audioModes')){ambientObserver=new MutationObserver(()=>{if($('#audioModes')){ambientObserver.disconnect();ambientObserver=null;ensureControl()}});ambientObserver.observe(document.body,{childList:true,subtree:true})}");
  fs.writeFileSync(p,s);
}

let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/\?v=\d+/g,`?v=${release}`);
html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>The 81</title>');
html=html.replace(/<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/>/,'<meta name="apple-mobile-web-app-title" content="The 81" />');
html=html.replace(/<meta name="description" content="[^"]*"\s*\/>/,'<meta name="description" content="The 81 — read, listen, search and study the complete 81-book Ethiopian Bible edition." />');
html=html.replace(/src=["']\/app\.js(?:\?v=\d+)?["']/,`src="/app.js?v=${release}"`);
if(!html.includes('/the81-theme.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/the81-theme.css?v=${release}" />\n</head>`);
if(!html.includes('/the81-theme.js'))html=html.replace('</body>',`  <script src="/the81-theme.js?v=${release}"></script>\n</body>`);
html=html.replace(/MODERN ETHIOPIAN BIBLE/g,'THE 81');
html=html.replace(/Modern Ethiopian Bible/g,'The 81');
html=html.replace(/Beautified Research Edition/g,'The Complete 81 Books');
html=html.replace(/<main id="app" class="app">[\s\S]*?<\/main>/,`<main id="app" class="app"><section class="hero" id="bootFallback"><span class="eyebrow">THE COMPLETE 81 BOOKS</span><h1><span class="theWord">The</span><span class="theNumber">81</span></h1><p>The Word. The Story. The Way.</p><div class="heroActions"><a class="primary" href="/recovery.html?v=${release}">Repair app</a></div></section></main>`);
fs.writeFileSync('dist/index.html',html);

// Network-first worker so installed PWAs receive redesigns immediately.
fs.writeFileSync('dist/sw.js',`const V='the81-v${release}-network-first';\nself.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html'))))});\n`);

for(const f of ['dist/app.js','dist/experience.js','dist/ambient-audio.js','dist/the81-theme.js'])execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
console.log('The 81 production release '+release+' applied');
