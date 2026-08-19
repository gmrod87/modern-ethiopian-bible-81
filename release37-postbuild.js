const fs=require('fs'),cp=require('child_process');
const v='42';
for(const f of ['release39-clean.css','release39-runtime.js'])fs.copyFileSync(f,'dist/'+f);
let h=fs.readFileSync('dist/index.html','utf8');

h=h.replace(/\s*<link[^>]+href=["']\/(?:release35\.css|release36\.css|release37\.css|release38-clean\.css|the81-theme\.css|the81-fast\.css)[^"']*["'][^>]*>/gi,'');
h=h.replace(/\s*<script[^>]+src=["']\/(?:release35-runtime\.js|release36-runtime\.js|release37-runtime\.js|the81-theme\.js|the81-fast\.js)[^"']*["'][^>]*><\/script>/gi,'');
h=h.replace(/<meta name="theme-color" content="[^"]*"\s*\/?\s*>/i,'<meta name="theme-color" content="#f3ead8" />');
h=h.replace(/<meta name="apple-mobile-web-app-status-bar-style" content="[^"]*"\s*\/?\s*>/i,'<meta name="apple-mobile-web-app-status-bar-style" content="default" />');
h=h.replace(/\/recovery\.html\?v=\d+/g,'/recovery.html?v=42');
h=h.replace(/<div class="heroActions"><a class="primary" href="\/recovery\.html\?v=42">Repair app<\/a><\/div>/i,'');
h=h.replace('</head>',`  <link rel="stylesheet" href="/release39-clean.css?v=${v}" />\n</head>`);
h=h.replace('</body>',`  <script src="/release39-runtime.js?v=${v}" defer></script>\n</body>`);
fs.writeFileSync('dist/index.html',h);

const m='dist/manifest.webmanifest';
if(fs.existsSync(m))try{const j=JSON.parse(fs.readFileSync(m,'utf8'));j.name='The 81';j.short_name='The 81';j.theme_color='#f3ead8';j.background_color='#f3ead8';fs.writeFileSync(m,JSON.stringify(j))}catch{}

const sw='dist/sw.js';
if(fs.existsSync(sw)){
  let s=fs.readFileSync(sw,'utf8').replace(/const V=['"][^'"]+['"]/ ,"const V='the81-v42-hard-contrast'");
  s+=`\nself.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==V).map(k=>caches.delete(k)));await self.clients.claim()})()));\n`;
  fs.writeFileSync(sw,s)
}

fs.writeFileSync('dist/recovery.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f3ead8"><title>Refresh The 81</title><style>html,body{margin:0;min-height:100%;background:#f3ead8;color:#17120f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:28px;box-sizing:border-box;text-align:center}.box{max-width:420px;padding:28px 24px;border:1px solid rgba(45,31,24,.22);border-radius:24px;background:#fbf5e9;box-shadow:0 10px 30px rgba(59,38,28,.07)}h1{font-family:Georgia,serif;font-size:28px;margin:0 0 10px}p{line-height:1.55;margin:0;color:#4f443e}</style></head><body><main><div class="box"><h1>Refreshing The 81</h1><p>Loading the corrected high-contrast edition…</p></div></main><script>(async()=>{try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(e){}location.replace('/?fresh=42&t='+Date.now()+'#home')})()</script></body></html>`);
cp.execFileSync(process.execPath,['--check','dist/release39-runtime.js'],{stdio:'inherit'});
console.log('The 81 Release 42 hard contrast reset applied');