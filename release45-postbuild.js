const fs=require('fs');

const v='45';
fs.copyFileSync('release45-theme.css','dist/release45-theme.css');

const htmlPath='dist/index.html';
let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/\s*<link[^>]+href=["']\/release44-contrast\.css[^"']*["'][^>]*>/gi,'');
html=html.replace(/\s*<link[^>]+href=["']\/release45-theme\.css[^"']*["'][^>]*>/gi,'');
html=html.replace('</head>',`  <link rel="stylesheet" href="/release45-theme.css?v=${v}" />\n</head>`);
html=html.replace(/<meta name="theme-color" content="[^"]*"\s*\/?\s*>/i,'<meta name="theme-color" content="#f3ead8" />');
fs.writeFileSync(htmlPath,html);

const manifest='dist/manifest.webmanifest';
if(fs.existsSync(manifest)){
  try{
    const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
    m.theme_color='#f3ead8';
    m.background_color='#f3ead8';
    fs.writeFileSync(manifest,JSON.stringify(m));
  }catch{}
}

const sw='dist/sw.js';
if(fs.existsSync(sw)){
  let s=fs.readFileSync(sw,'utf8');
  s=s.replace(/const V=['"][^'"]+['"]/,"const V='the81-v45-red-cream-final'");
  fs.writeFileSync(sw,s);
}

fs.writeFileSync('dist/recovery.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f3ead8"><title>Refresh The 81</title><style>html,body{margin:0;min-height:100%;background:#f3ead8;color:#1c140f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:28px;box-sizing:border-box;text-align:center}.box{max-width:420px;padding:28px 24px;border:1px solid #5a4638;border-radius:24px;background:#fbf5e9}h1{font-family:Georgia,serif;font-size:28px;margin:0 0 10px;color:#7f2f22}p{line-height:1.55;margin:0;color:#4f443e}</style></head><body><main><div class="box"><h1>Refreshing The 81</h1><p>Loading the red + cream edition…</p></div></main><script>(async()=>{try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(e){}location.replace('/?fresh=45&t='+Date.now()+'#home')})()</script></body></html>`);

console.log('The 81 Release 45 final red + cream theme applied');
