const fs=require('fs');
const sharp=require('sharp');

const v='48';
const brand='Hobah';
const desc='Hobah — read, listen, search and study the complete 81-book Ethiopian Bible edition.';
const site='https://modern-ethiopian-bible-81.vercel.app';

async function main(){
  for(const f of ['hobah-mark.svg','hobah-logo.svg','hobah-share.svg','release48-hobah.css','release48-hobah.js']) fs.copyFileSync(f,'dist/'+f);

  await Promise.all([
    sharp('hobah-mark.svg').resize(64,64).png({compressionLevel:9,palette:true}).toFile('dist/hobah-favicon.png'),
    sharp('hobah-mark.svg').resize(180,180).png({compressionLevel:9,palette:true}).toFile('dist/hobah-icon-180.png'),
    sharp('hobah-mark.svg').resize(192,192).png({compressionLevel:9,palette:true}).toFile('dist/hobah-icon-192.png'),
    sharp('hobah-mark.svg').resize(512,512).png({compressionLevel:9,palette:true}).toFile('dist/hobah-icon-512.png'),
    sharp('hobah-share.svg').resize(1200,630).png({compressionLevel:9,palette:true}).toFile('dist/hobah-share.png')
  ]);

  const htmlPath='dist/index.html';
  let h=fs.readFileSync(htmlPath,'utf8');
  h=h.replace(/\s*<link[^>]+href=["']\/release48-hobah\.css[^"']*["'][^>]*>/gi,'');
  h=h.replace(/\s*<script[^>]+src=["']\/release48-hobah\.js[^"']*["'][^>]*><\/script>/gi,'');
  h=h.replace(/\s*<link[^>]+rel=["']icon["'][^>]*>/gi,'');
  h=h.replace(/<link rel="apple-touch-icon" href="[^"]*"\s*\/?\s*>/i,'<link rel="apple-touch-icon" href="/hobah-icon-180.png" />');
  h=h.replace(/<title>[\s\S]*?<\/title>/i,`<title>${brand}</title>`);
  h=h.replace(/<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?\s*>/i,`<meta name="apple-mobile-web-app-title" content="${brand}" />`);
  h=h.replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/i,`<meta name="description" content="${desc}" />`);
  h=h.replaceAll('Codex 81',brand).replaceAll('CODEX LIBRARY','HOBAH LIBRARY').replaceAll('Search Hobah…','Search Hobah…');
  h=h.replace('placeholder="Search all 81 books…"','placeholder="Search Hobah…"');
  h=h.replace('placeholder="Search Codex 81…"','placeholder="Search Hobah…"');
  h=h.replace('<section class="hero the81Hero" id="bootFallback"><span class="eyebrow">THE ETHIOPIAN CANON • 81 BOOKS</span><h1>Hobah</h1><p>Read. Listen. Search. Study.</p></section>','<section class="hero the81Hero" id="bootFallback"><span class="eyebrow">THE ETHIOPIAN CANON • 81 BOOKS</span><h1>Hobah</h1><p>Read. Listen. Search. Study.</p></section>');

  h=h.replace(/\s*<meta property="og:[^"]+"[^>]*>/gi,'').replace(/\s*<meta name="twitter:[^"]+"[^>]*>/gi,'');
  const social=`\n  <meta property="og:type" content="website" />\n  <meta property="og:title" content="${brand}" />\n  <meta property="og:description" content="${desc}" />\n  <meta property="og:url" content="${site}/" />\n  <meta property="og:image" content="${site}/hobah-share.png?v=${v}" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />\n  <meta name="twitter:card" content="summary_large_image" />\n  <meta name="twitter:title" content="${brand}" />\n  <meta name="twitter:description" content="${desc}" />\n  <meta name="twitter:image" content="${site}/hobah-share.png?v=${v}" />\n  <link rel="icon" href="/hobah-mark.svg?v=${v}" type="image/svg+xml" />\n  <link rel="icon" href="/hobah-favicon.png?v=${v}" type="image/png" sizes="64x64" />\n  <link rel="stylesheet" href="/release48-hobah.css?v=${v}" />`;
  h=h.replace('</head>',social+'\n</head>');
  h=h.replace('</body>',`  <script src="/release48-hobah.js?v=${v}" defer></script>\n</body>`);
  fs.writeFileSync(htmlPath,h);

  for(const f of fs.readdirSync('dist').filter(x=>x.endsWith('.js'))){
    const p='dist/'+f;let s=fs.readFileSync(p,'utf8');
    s=s.replaceAll('Codex 81',brand).replaceAll('CODEX LIBRARY','HOBAH LIBRARY').replaceAll('Search Codex 81…','Search Hobah…');
    fs.writeFileSync(p,s);
  }

  const manifest='dist/manifest.webmanifest';
  if(fs.existsSync(manifest)){
    try{
      const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
      m.name=brand;m.short_name=brand;m.description=desc;m.theme_color='#EEECE5';m.background_color='#EEECE5';m.display='standalone';
      m.icons=[
        {src:'/hobah-icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},
        {src:'/hobah-icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}
      ];
      fs.writeFileSync(manifest,JSON.stringify(m));
    }catch(e){console.warn('Manifest update skipped',e.message)}
  }

  const sw='dist/sw.js';
  if(fs.existsSync(sw)){
    let s=fs.readFileSync(sw,'utf8');
    s=s.replace(/const V=['"][^'"]+['"]/,"const V='hobah-v48-brand'");
    s+=`\nself.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==V).map(k=>caches.delete(k)));await self.clients.claim()})()));\n`;
    fs.writeFileSync(sw,s);
  }

  fs.writeFileSync('dist/recovery.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#EEECE5"><title>Updating Hobah</title><style>html,body{margin:0;min-height:100%;background:#EEECE5;color:#12362f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:28px;box-sizing:border-box}.box{width:min(420px,100%);padding:30px 26px;border:1px solid #D9D7CE;border-radius:26px;background:#FCFBF8;box-shadow:0 18px 55px rgba(19,35,30,.10)}i{display:block;width:42px;height:4px;background:#b96240;border-radius:999px;margin-bottom:22px}h1{font-family:Georgia,serif;font-size:36px;letter-spacing:-.04em;margin:0 0 10px}p{line-height:1.55;margin:0;color:#637069}</style></head><body><main><div class="box"><i></i><h1>Updating Hobah</h1><p>Loading the new Hobah identity and artwork…</p></div></main><script>(async()=>{try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(e){}location.replace('/?fresh=48&t='+Date.now()+'#home')})()</script></body></html>`);

  console.log('Hobah Release 48 branding, logo, favicon and share image applied');
}
main().catch(e=>{console.error(e);process.exit(1)});
