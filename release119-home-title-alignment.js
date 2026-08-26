const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',VERSION='119',p=f=>path.join(D,f);
for(const f of ['app.js','index.html','styles.css','manifest.webmanifest','release94-ancient-library.js']){
  if(!fs.existsSync(p(f)))throw new Error('Release119 missing '+f);
}

const OLD='THE ETHIOPIAN CANON • 81 BOOKS';
const NEXT='81 Books + Ancient Writings';

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='118';"))throw new Error('Release119 expected app runtime v118');
if(!app.includes(OLD))throw new Error('Release119 home heading target missing from app renderer');
app=app.replaceAll(OLD,NEXT).replace("const V='118';","const V='119';");
fs.writeFileSync(p('app.js'),app);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='118';"))throw new Error('Release119 expected Ancient Library v118');
lib=lib.replace("const LIB_VERSION='118';","const LIB_VERSION='119';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

let html=fs.readFileSync(p('index.html'),'utf8');
if(!html.includes(OLD))throw new Error('Release119 initial home heading target missing');
html=html.replaceAll(OLD,NEXT).replace(/\?v=118\b/g,'?v=119').replace(/\/styles\.css\?v=\d+/,'/styles.css?v=119');
fs.writeFileSync(p('index.html'),html);

fs.appendFileSync(p('styles.css'),String.raw`

/* Hobah Release 119 — whole-app descriptor aligned with the Hobah wordmark */
.homeHero{
  text-align:left!important;
}
.homeHero > .eyebrow{
  display:block!important;
  width:100%!important;
  box-sizing:border-box!important;
  margin-left:0!important;
  margin-right:0!important;
  padding-left:0!important;
  padding-right:0!important;
  text-align:left!important;
  align-self:stretch!important;
}
.homeHero > h1{
  width:100%!important;
  margin-left:0!important;
  margin-right:0!important;
  text-align:left!important;
  align-self:stretch!important;
}
`);

const manifest=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));
manifest.start_url='/?v=119#home';
fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(manifest));

execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});

const finalApp=fs.readFileSync(p('app.js'),'utf8'),finalHtml=fs.readFileSync(p('index.html'),'utf8'),finalCss=fs.readFileSync(p('styles.css'),'utf8');
if(finalApp.includes(OLD)||finalHtml.includes(OLD))throw new Error('Release119 old home heading survived');
if(!finalApp.includes(NEXT)||!finalHtml.includes(NEXT))throw new Error('Release119 new home heading missing');
if(!finalCss.includes('Hobah Release 119')||!finalCss.includes('.homeHero > .eyebrow'))throw new Error('Release119 alignment CSS missing');
if(!finalHtml.includes('/styles.css?v=119'))throw new Error('Release119 stylesheet cache bust missing');
console.log('Hobah Release 119: home descriptor changed to 81 Books + Ancient Writings and aligned left with Hobah');
