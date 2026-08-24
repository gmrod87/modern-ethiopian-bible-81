const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const sharp=require('sharp');
const D='dist',V='112',p=f=>path.join(D,f);
for(const f of ['app.js','index.html','styles.css','manifest.webmanifest','release94-ancient-library.js'])if(!fs.existsSync(p(f)))throw new Error('Release112 missing '+f);
const iconSource=path.join('native-ios','assets','hobah-icon.svg');
const crossSource=path.join('native-ios','assets','hobah-cross-mark.svg');
if(!fs.existsSync(iconSource)||!fs.existsSync(crossSource))throw new Error('Release112 Hobah brand source missing');

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='111';"))throw new Error('Release112 expected app runtime v111');
app=app.replace("const V='111';","const V='112';");
fs.writeFileSync(p('app.js'),app);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(lib.includes("const LIB_VERSION='111';"))lib=lib.replace("const LIB_VERSION='111';","const LIB_VERSION='112';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

const cross=fs.readFileSync(crossSource,'utf8');
const icon=fs.readFileSync(iconSource);
fs.writeFileSync(p('hobah-cross.svg'),cross);

(async()=>{
  const renders=[
    ['hobah-icon-180-v112.png',180],
    ['hobah-icon-192-v112.png',192],
    ['hobah-icon-512-v112.png',512],
    ['hobah-favicon-v112.png',64]
  ];
  for(const [name,size] of renders){
    await sharp(icon).resize(size,size).flatten({background:'#0D4C3F'}).removeAlpha().png({palette:false}).toFile(p(name));
  }

  let html=fs.readFileSync(p('index.html'),'utf8');
  html=html.replaceAll('v=111','v=112');
  html=html.replace(/<link rel="apple-touch-icon" href="[^"]+">/,'<link rel="apple-touch-icon" href="/hobah-icon-180-v112.png">');
  html=html.replace(/<link rel="icon" href="[^"]+" type="image\/svg\+xml">/,'<link rel="icon" href="/hobah-cross.svg?v=112" type="image/svg+xml">');
  const oldBrand='<a class="brand" id="homeBtn" href="#home" aria-label="Hobah home">H</a>';
  const newBrand='<a class="brand" id="homeBtn" href="#home" aria-label="Hobah home"><img src="/hobah-cross.svg?v=112" alt="" aria-hidden="true"></a>';
  if(!html.includes(oldBrand))throw new Error('Release112 header brand mount missing');
  html=html.replace(oldBrand,newBrand);
  fs.writeFileSync(p('index.html'),html);

  fs.appendFileSync(p('styles.css'),`\n/* Hobah Release 112 — one cross, one palette, everywhere */\n.brand{width:50px!important;height:50px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important;display:grid!important;place-items:center!important;}\n.brand img{display:block!important;width:38px!important;height:38px!important;object-fit:contain!important;filter:drop-shadow(0 4px 3px rgba(7,30,24,.38)) drop-shadow(0 1px 1px rgba(141,100,33,.42))!important;transform:translateY(-1px);}\n.brand:active img{transform:translateY(0) scale(.965);}\n@media(max-width:430px){.brand img{width:36px!important;height:36px!important;}}\n`);

  const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));
  m.start_url='/?v=112#home';
  m.background_color='#0D4C3F';
  m.theme_color='#f3efe5';
  m.icons=[
    {src:'/hobah-icon-192-v112.png',sizes:'192x192',type:'image/png'},
    {src:'/hobah-icon-512-v112.png',sizes:'512x512',type:'image/png'}
  ];
  fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m));

  for(const required of ["const V='112';",'hobah-cross.svg?v=112']){
    const hay=required.startsWith('const V')?app:html;if(!hay.includes(required))throw new Error('Release112 integration missing '+required);
  }
  execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
  execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
  console.log('Hobah Release 112: unified green/gold cross applied to header, PWA icon and brand assets');
})().catch(e=>{console.error(e);process.exit(1)});
