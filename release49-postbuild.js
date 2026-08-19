const fs=require('fs');
const v='49';

function copy(src,dst){if(fs.existsSync(src))fs.copyFileSync(src,dst)}
copy('dist/hobah-favicon.png','dist/hobah-favicon-v49.png');
copy('dist/hobah-icon-180.png','dist/hobah-icon-180-v49.png');
copy('dist/hobah-icon-192.png','dist/hobah-icon-192-v49.png');
copy('dist/hobah-icon-512.png','dist/hobah-icon-512-v49.png');
copy('dist/hobah-share.png','dist/hobah-share-v49.png');

const htmlPath='dist/index.html';
if(fs.existsSync(htmlPath)){
  let h=fs.readFileSync(htmlPath,'utf8');
  h=h.replace('/hobah-icon-180.png','/hobah-icon-180-v49.png');
  h=h.replace(/hobah-share\.png\?v=48/g,'hobah-share-v49.png?v=49');
  h=h.replace(/hobah-mark\.svg\?v=48/g,'hobah-mark.svg?v=49');
  h=h.replace(/hobah-favicon\.png\?v=48/g,'hobah-favicon-v49.png?v=49');
  h=h.replace(/release48-hobah\.css\?v=48/g,'release48-hobah.css?v=49');
  h=h.replace(/release48-hobah\.js\?v=48/g,'release48-hobah.js?v=49');
  fs.writeFileSync(htmlPath,h);
}

const manifest='dist/manifest.webmanifest';
if(fs.existsSync(manifest)){
  try{
    const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
    m.icons=[
      {src:'/hobah-icon-192-v49.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},
      {src:'/hobah-icon-512-v49.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}
    ];
    fs.writeFileSync(manifest,JSON.stringify(m));
  }catch(e){console.warn('Release49 manifest update skipped',e.message)}
}

const sw='dist/sw.js';
if(fs.existsSync(sw)){
  let s=fs.readFileSync(sw,'utf8');
  s=s.replace(/const V=['\"][^'\"]+['\"]/,"const V='hobah-v49-emblem'");
  fs.writeFileSync(sw,s);
}

const recovery='dist/recovery.html';
if(fs.existsSync(recovery)){
  let r=fs.readFileSync(recovery,'utf8');
  r=r.replace(/fresh=48/g,'fresh=49').replace(/identity and artwork/g,'H emblem and updated artwork');
  fs.writeFileSync(recovery,r);
}
console.log('Hobah Release 49 H emblem assets applied');
