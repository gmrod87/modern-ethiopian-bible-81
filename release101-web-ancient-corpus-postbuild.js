const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['release94-ancient-library.js','app.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release101 missing '+f);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='100';"))throw new Error('Release101 expected Ancient runtime v100');
lib=lib.replace("const LIB_VERSION='100';","const LIB_VERSION='101';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='100';"))throw new Error('Release101 expected app runtime v100');
app=app.replace("const V='100';","const V='101';");
fs.writeFileSync(p('app.js'),app);

let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=100','v=101');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){
  const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));
  m.start_url='/?v=101#home';
  fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m));
}

const ancient=JSON.parse(fs.readFileSync(p('ancient-library.json'),'utf8'));
const sections=Array.isArray(ancient.sections)?ancient.sections:[];
const chars=Number(ancient.total_characters||ancient.total_chars||sections.reduce((n,s)=>n+Number(s.chars||String(s.text||'').length),0));
if(process.env.VERCEL&&(sections.length<180||chars<10000000))throw new Error(`Release101 refuses empty/incomplete Vercel Ancient Library: ${sections.length} sections / ${chars} chars`);

execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log(`Hobah Release 101: web Ancient Library cache-busted with ${sections.length} sections / ${chars.toLocaleString()} chars`);