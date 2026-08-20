const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',V='75',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release75: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='74';"))throw new Error('Release75: expected Release 74 runtime');
app=app.replace("const V='74';","const V='75';");
fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=74','/styles.css?v=75').replace('/app.js?v=74','/app.js?v=75').replace('/manifest.webmanifest?v=74','/manifest.webmanifest?v=75');
fs.writeFileSync(p('index.html'),html);
for(const f of ['privacy.html','support.html']){
  if(!fs.existsSync(f))throw new Error('Release75: missing '+f);
  fs.copyFileSync(f,p(f));
}
if(fs.existsSync(p('manifest.webmanifest'))){
  const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));
  m.start_url='/?v=75#home';
  fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m));
}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 75: App Store privacy/support readiness applied');
