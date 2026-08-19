const fs=require('fs');
const v='47';
const brand='Codex 81';
const subtitle='Ethiopian Canon • 81 Books';
const desc='Codex 81 — read, listen, search and study the complete 81-book Ethiopian Bible edition.';

for(const f of ['release47-codex.css','release47-codex.js']) fs.copyFileSync(f,'dist/'+f);

const htmlPath='dist/index.html';
let h=fs.readFileSync(htmlPath,'utf8');
h=h.replace(/\s*<link[^>]+href=["']\/(?:release39-clean|release44-contrast|release45-theme|release46-theme|release47-codex)\.css[^"']*["'][^>]*>/gi,'');
h=h.replace(/\s*<script[^>]+src=["']\/release47-codex\.js[^"']*["'][^>]*><\/script>/gi,'');
h=h.replace(/<title>[\s\S]*?<\/title>/i,`<title>${brand}</title>`);
h=h.replace(/<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?\s*>/i,`<meta name="apple-mobile-web-app-title" content="${brand}" />`);
h=h.replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/i,`<meta name="description" content="${desc}" />`);
h=h.replace(/<meta name="theme-color" content="[^"]*"\s*\/?\s*>/i,'<meta name="theme-color" content="#EEECE5" />');
h=h.replace(/<meta name="apple-mobile-web-app-status-bar-style" content="[^"]*"\s*\/?\s*>/i,'<meta name="apple-mobile-web-app-status-bar-style" content="default" />');
h=h.replaceAll('Modern Ethiopian Bible',brand).replaceAll('The 81',brand).replaceAll('The Complete 81 Books',subtitle).replaceAll('THE COMPLETE 81 BOOKS','THE ETHIOPIAN CANON • 81 BOOKS');
h=h.replace('placeholder="Search all 81 books…"','placeholder="Search Codex 81…"');
h=h.replace('<div><small>THE COMPLETE EDITION</small><h2>Books</h2></div>','<div><small>CODEX LIBRARY</small><h2>81 Books</h2></div>');
h=h.replace('<section class="hero the81Hero" id="bootFallback"><span class="eyebrow">THE ETHIOPIAN CANON • 81 BOOKS</span><h1><span class="theWord">The</span><span class="theNumber">81</span></h1><p>The Word. The Story. The Way.</p></section>','<section class="hero the81Hero" id="bootFallback"><span class="eyebrow">THE ETHIOPIAN CANON • 81 BOOKS</span><h1>Codex 81</h1><p>Read. Listen. Search. Study.</p></section>');
h=h.replace('</head>',`  <link rel="icon" href="/codex81-icon.svg" type="image/svg+xml" />\n  <link rel="stylesheet" href="/release47-codex.css?v=${v}" />\n</head>`);
h=h.replace('</body>',`  <script src="/release47-codex.js?v=${v}" defer></script>\n</body>`);
fs.writeFileSync(htmlPath,h);

const appPath='dist/app.js';
if(fs.existsSync(appPath)){
  let a=fs.readFileSync(appPath,'utf8');
  a=a.replaceAll('Modern Ethiopian Bible',brand)
     .replaceAll('The 81',brand)
     .replaceAll('The Complete 81 Books',subtitle)
     .replaceAll('THE COMPLETE 81 BOOKS','THE ETHIOPIAN CANON • 81 BOOKS')
     .replaceAll('Search all 81 books…','Search Codex 81…');
  fs.writeFileSync(appPath,a);
}

fs.writeFileSync('dist/codex81-icon.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="116" fill="#244D45"/><path d="M104 118h304v276H104z" fill="#FCFBF8" opacity=".98"/><path d="M135 118v276M377 118v276" stroke="#C56F4C" stroke-width="12"/><text x="256" y="310" text-anchor="middle" font-family="Georgia,serif" font-size="176" font-weight="700" fill="#13231E">81</text><circle cx="256" cy="94" r="18" fill="#C56F4C"/></svg>`);

const manifest='dist/manifest.webmanifest';
if(fs.existsSync(manifest)){
  try{
    const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
    m.name=brand;m.short_name=brand;m.description=desc;m.theme_color='#EEECE5';m.background_color='#EEECE5';m.display='standalone';
    const old=Array.isArray(m.icons)?m.icons:[];
    m.icons=[{src:'/codex81-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'},...old.filter(x=>x&&x.src!=='/codex81-icon.svg')];
    fs.writeFileSync(manifest,JSON.stringify(m));
  }catch{}
}

const sw='dist/sw.js';
if(fs.existsSync(sw)){
  let s=fs.readFileSync(sw,'utf8');
  s=s.replace(/const V=['"][^'"]+['"]/,"const V='codex81-v47-ui-reset'");
  s+=`\nself.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==V).map(k=>caches.delete(k)));await self.clients.claim()})()));\n`;
  fs.writeFileSync(sw,s);
}

fs.writeFileSync('dist/recovery.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#EEECE5"><title>Updating Codex 81</title><style>html,body{margin:0;min-height:100%;background:#EEECE5;color:#13231E;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:28px;box-sizing:border-box}.box{width:min(420px,100%);padding:30px 26px;border:1px solid #D9D7CE;border-radius:26px;background:#FCFBF8;box-shadow:0 18px 55px rgba(19,35,30,.10)}i{display:block;width:38px;height:4px;background:#C56F4C;border-radius:999px;margin-bottom:22px}h1{font-family:Georgia,serif;font-size:34px;letter-spacing:-.04em;margin:0 0 10px}p{line-height:1.55;margin:0;color:#637069}</style></head><body><main><div class="box"><i></i><h1>Updating Codex 81</h1><p>Clearing the previous interface and loading the new edition…</p></div></main><script>(async()=>{try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(e){}location.replace('/?fresh=47&t='+Date.now()+'#home')})()</script></body></html>`);

console.log('Codex 81 Release 47 complete UI reset applied');
