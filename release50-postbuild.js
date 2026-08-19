const fs=require('fs');
const v='50';
function copy(src,dst){if(fs.existsSync(src))fs.copyFileSync(src,dst)}
copy('dist/hobah-favicon.png','dist/hobah-favicon-v50.png');
copy('dist/hobah-icon-180.png','dist/hobah-icon-180-v50.png');
copy('dist/hobah-icon-192.png','dist/hobah-icon-192-v50.png');
copy('dist/hobah-icon-512.png','dist/hobah-icon-512-v50.png');
copy('dist/hobah-share.png','dist/hobah-share-v50.png');

const htmlPath='dist/index.html';
if(fs.existsSync(htmlPath)){
  let h=fs.readFileSync(htmlPath,'utf8');
  h=h.replace(/hobah-icon-180-v49\.png/g,'hobah-icon-180-v50.png');
  h=h.replace(/hobah-share-v49\.png\?v=49/g,'hobah-share-v50.png?v=50');
  h=h.replace(/hobah-mark\.svg\?v=49/g,'hobah-mark.svg?v=50');
  h=h.replace(/hobah-favicon-v49\.png\?v=49/g,'hobah-favicon-v50.png?v=50');
  h=h.replace(/release48-hobah\.css\?v=49/g,'release48-hobah.css?v=50');
  h=h.replace(/release48-hobah\.js\?v=49/g,'release48-hobah.js?v=50');
  fs.writeFileSync(htmlPath,h);
}

const manifest='dist/manifest.webmanifest';
if(fs.existsSync(manifest)){
  try{
    const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
    m.icons=[
      {src:'/hobah-icon-192-v50.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},
      {src:'/hobah-icon-512-v50.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}
    ];
    fs.writeFileSync(manifest,JSON.stringify(m));
  }catch(e){console.warn('Release50 manifest update skipped',e.message)}
}

const sw='dist/sw.js';
if(fs.existsSync(sw)){
  let s=fs.readFileSync(sw,'utf8');
  s=s.replace(/const V=['\"][^'\"]+['\"]/,"const V='hobah-v50-visible-emblem'");
  fs.writeFileSync(sw,s);
}
const recovery='dist/recovery.html';
if(fs.existsSync(recovery)){
  let r=fs.readFileSync(recovery,'utf8');
  r=r.replace(/fresh=49/g,'fresh=50').replace(/H emblem and updated artwork/g,'visible H emblem and updated branding');
  fs.writeFileSync(recovery,r);
}
console.log('Hobah Release 50 visible H emblem applied');
