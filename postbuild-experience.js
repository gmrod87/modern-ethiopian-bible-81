const {execFileSync}=require('child_process');
const fs=require('fs');
const release='29';
for(const f of ['experience.js','experience.css','ambient-audio.js'])fs.copyFileSync(f,'dist/'+f);

// Keep the mobile Home control in the normal header flow so it can never cover other icons.
fs.appendFileSync('dist/styles.css',`\n/* Release 28: compact non-overlapping mobile Home button */\n@media(max-width:900px){\n  .topbar #homeBtn{position:static!important;inset:auto!important;left:auto!important;top:auto!important;transform:none!important;z-index:auto!important;display:grid!important;place-items:center!important;flex:0 0 44px!important;width:44px!important;min-width:44px!important;max-width:44px!important;height:44px!important;min-height:44px!important;padding:0!important;margin:0!important;gap:0!important;border:1px solid var(--line)!important;border-radius:50%!important;background:var(--paper)!important;color:var(--ink)!important;box-shadow:none!important}\n  .topbar #homeBtn .mobileHomeIcon{display:grid!important;place-items:center!important;font-size:22px!important;line-height:1!important}\n  .topbar #homeBtn .mobileHomeText{display:none!important}\n}\n`);

// Put Ambient Music inside Read Aloud without any observer feedback loop.
{
  const ambientPath='dist/ambient-audio.js';
  let ambient=fs.readFileSync(ambientPath,'utf8');
  ambient=ambient.replace(/  function ensureControl\(\)\{[\s\S]*?\n  \}\n  function init\(\)\{/,
`  function ensureControl(){
    const modes=$('#audioModes'),ctr=$('.audioControls');
    let b=$('#audioAmbient');
    if(!b){
      if(!modes&&!ctr)return;
      b=document.createElement('button');b.id='audioAmbient';b.className='audioExtra audioAmbient';b.type='button';
    }
    b.onclick=toggleAmbient;
    if(modes){
      let row=$('#audioAmbientSetting');
      if(!row){row=document.createElement('div');row.id='audioAmbientSetting';row.className='audioAmbientSetting';row.innerHTML='<div class="audioAmbientCopy"><span>AMBIENT MUSIC</span><small>Quiet adaptive music behind Read Aloud</small></div>';modes.appendChild(row)}
      if(b.parentElement!==row)row.appendChild(b);
    }else if(ctr&&b.parentElement!==ctr){
      const sleep=$('#audioSleep'),close=$('#audioClose');ctr.insertBefore(b,sleep||close);
    }
    updateButton();
  }
  function init(){`);
  ambient=ambient.replace(
    "    ensureControl();new MutationObserver(ensureControl).observe(document.body,{childList:true,subtree:true});",
    "    ensureControl();let ambientObserver=null;if(!$('#audioModes')){ambientObserver=new MutationObserver(()=>{if($('#audioModes')){ambientObserver.disconnect();ambientObserver=null;ensureControl()}});ambientObserver.observe(document.body,{childList:true,subtree:true})}"
  );
  if(ambient.includes('new MutationObserver(ensureControl)'))throw new Error('Ambient observer loop still present');
  fs.writeFileSync(ambientPath,ambient);
}

fs.appendFileSync('dist/experience.css',`\n/* Release 28: visible Ambient Music setting in Read Aloud */\n.audioAmbientSetting{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}\n.audioAmbientCopy{min-width:0;display:flex;flex-direction:column;gap:3px}\n.audioAmbientCopy>span{font-size:10px;font-weight:900;letter-spacing:.14em;opacity:.72}\n.audioAmbientCopy>small{display:block!important;font-size:10px;line-height:1.35;opacity:.58}\n.audioAmbientSetting .audioAmbient{flex:0 0 auto;min-width:112px;justify-content:center;white-space:nowrap}\n@media(max-width:520px){.audioAmbientSetting{align-items:flex-start}.audioAmbientSetting .audioAmbient{min-width:104px;font-size:10px!important;padding-left:8px!important;padding-right:8px!important}}\n`);

let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/\?v=\d+/g,`?v=${release}`);
// Cache-bust the core app module too. Older builds left this URL unversioned.
html=html.replace(/src=["']\/app\.js(?:\?v=\d+)?["']/,`src="/app.js?v=${release}"`);
if(!html.includes('/experience.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/experience.css?v=${release}" />\n</head>`);
if(!html.includes('/experience.js')){
  const chrono=html.match(/\s*<script src="\/chronology\.js\?v=\d+"><\/script>/);
  const scripts=`\n  <script src="/experience.js?v=${release}"></script>\n  <script src="/ambient-audio.js?v=${release}"></script>`;
  if(chrono)html=html.replace(chrono[0],scripts+chrono[0]);else html=html.replace('</body>',scripts+'\n</body>');
}
// Never show a totally blank screen, even if a client script fails.
html=html.replace('<main id="app" class="app"></main>',`<main id="app" class="app"><section class="hero" id="bootFallback"><span class="eyebrow">MODERN ETHIOPIAN BIBLE</span><h1>Loading your<br><em>Bible</em>…</h1><p>If this screen does not change, use the repair button below to clear an old app cache safely.</p><div class="heroActions"><a class="primary" href="/recovery.html?v=${release}">Repair app</a></div></section></main>`);
fs.writeFileSync('dist/index.html',html);

// A clean recovery page that old service workers cannot already have cached.
fs.writeFileSync('dist/recovery.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#6f1d1d"><title>Repairing Bible App</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3eee5;color:#211a16;font-family:Georgia,serif;padding:24px;box-sizing:border-box}.card{width:min(92vw,520px);background:#fffaf2;border:1px solid #d9cdbc;border-radius:24px;padding:30px;box-shadow:0 20px 70px rgba(54,32,19,.13);text-align:center}.mark{font-size:42px;color:#751d1d}.spin{width:32px;height:32px;border:3px solid #d9cdbc;border-top-color:#751d1d;border-radius:50%;margin:20px auto;animation:s .8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}h1{font-size:34px;margin:8px 0 10px}p{line-height:1.55;color:#796d63}.go{display:inline-block;margin-top:10px;background:#751d1d;color:#fff;text-decoration:none;border-radius:999px;padding:12px 18px}</style></head><body><main class="card"><div class="mark">☩</div><h1>Repairing your Bible app</h1><div class="spin"></div><p id="status">Clearing the broken cached version…</p><a class="go" id="go" href="/?fresh=${release}#home" hidden>Open Bible</a></main><script>(async()=>{const s=document.getElementById('status'),g=document.getElementById('go');try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}s.textContent='Repair complete. Opening the fresh Bible…';setTimeout(()=>location.replace('/?fresh=${release}#home'),350)}catch(e){s.textContent='Repair complete enough to continue. Tap Open Bible.';g.hidden=false}})();</script></body></html>`);

for(const f of ['dist/app.js','dist/experience.js','dist/ambient-audio.js'])execFileSync(process.execPath,['--check',f],{stdio:'inherit'});

// Replace the old cache-first worker entirely. Network-first avoids trapping future releases.
fs.writeFileSync('dist/sw.js',`const V='meb-v${release}-network-first';\nself.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html'))))});\n`);
console.log('Modern Ethiopian Bible recovery release '+release+' applied');
