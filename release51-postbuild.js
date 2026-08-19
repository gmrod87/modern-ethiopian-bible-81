const fs=require('fs');
const sharp=require('sharp');
const v='51';
async function main(){
  for(const f of ['release51-ancient-canon.css','release51-ancient-canon.js','hobah-mark.svg']) if(fs.existsSync(f))fs.copyFileSync(f,'dist/'+f);

  await Promise.all([
    sharp('hobah-mark.svg').resize(64,64).png({compressionLevel:9}).toFile('dist/hobah-favicon-v51.png'),
    sharp('hobah-mark.svg').resize(180,180).png({compressionLevel:9}).toFile('dist/hobah-icon-180-v51.png'),
    sharp('hobah-mark.svg').resize(192,192).png({compressionLevel:9}).toFile('dist/hobah-icon-192-v51.png'),
    sharp('hobah-mark.svg').resize(512,512).png({compressionLevel:9}).toFile('dist/hobah-icon-512-v51.png')
  ]);

  const shareMark=await sharp('hobah-mark.svg').resize(280,280).png().toBuffer();
  const shareText=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#EEECE5"/><text x="470" y="285" font-family="Georgia,serif" font-size="132" font-weight="700" fill="#12362f">Hobah</text><text x="475" y="352" font-family="Arial,sans-serif" font-size="27" font-weight="700" letter-spacing="5" fill="#A95635">THE ANCIENT CANON</text><path d="M475 389h420" stroke="#D9D7CE" stroke-width="2"/><path d="M475 389h118" stroke="#A95635" stroke-width="6" stroke-linecap="round"/></svg>`);
  await sharp(shareText).composite([{input:shareMark,left:105,top:175}]).png({compressionLevel:9}).toFile('dist/hobah-share-v51.png');

  const htmlPath='dist/index.html';
  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\s*<link[^>]+href=["']\/release51-ancient-canon\.css[^"']*["'][^>]*>/gi,'');
    h=h.replace(/\s*<script[^>]+src=["']\/release51-ancient-canon\.js[^"']*["'][^>]*><\/script>/gi,'');
    h=h.replace(/hobah-icon-180-v50\.png/g,'hobah-icon-180-v51.png');
    h=h.replace(/hobah-share-v50\.png\?v=50/g,'hobah-share-v51.png?v=51');
    h=h.replace(/hobah-mark\.svg\?v=50/g,'hobah-mark.svg?v=51');
    h=h.replace(/hobah-favicon-v50\.png\?v=50/g,'hobah-favicon-v51.png?v=51');
    h=h.replace(/release48-hobah\.css\?v=50/g,'release48-hobah.css?v=51');
    h=h.replace(/release48-hobah\.js\?v=50/g,'release48-hobah.js?v=51');
    h=h.replace(/placeholder="Search Hobah…"/g,'placeholder="Search…"');
    h=h.replace('</head>','  <link rel="stylesheet" href="/release51-ancient-canon.css?v=51" />\n</head>');
    h=h.replace('</body>','  <script src="/release51-ancient-canon.js?v=51" defer></script>\n</body>');
    fs.writeFileSync(htmlPath,h);
  }

  const manifest='dist/manifest.webmanifest';
  if(fs.existsSync(manifest)){
    try{
      const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
      m.icons=[
        {src:'/hobah-icon-192-v51.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},
        {src:'/hobah-icon-512-v51.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}
      ];
      fs.writeFileSync(manifest,JSON.stringify(m));
    }catch(e){console.warn('Release51 manifest update skipped',e.message)}
  }

  const sw='dist/sw.js';
  if(fs.existsSync(sw)){
    let s=fs.readFileSync(sw,'utf8');
    s=s.replace(/const V=['\"][^'\"]+['\"]/,"const V='hobah-v51-ancient-canon'");
    fs.writeFileSync(sw,s);
  }

  const recovery='dist/recovery.html';
  if(fs.existsSync(recovery)){
    let r=fs.readFileSync(recovery,'utf8');
    r=r.replace(/fresh=50/g,'fresh=51').replace(/visible H emblem and updated branding/g,'Ancient Canon home design and exact Hobah emblem');
    fs.writeFileSync(recovery,r);
  }
  console.log('Hobah Release 51 Ancient Canon home design applied');
}
main().catch(e=>{console.error(e);process.exit(1)});
