const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release90: build output missing');
const runtime=['release90-voice-runtime-1.js','release90-voice-runtime-2.js','release90-voice-runtime-3.js'].map(f=>fs.readFileSync(f,'utf8').trim()).join('\n');
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='89';"))throw new Error('Release90: runtime version 89 not found');
app=app.replace("const V='89';","const V='90';");
const anchor='bindAudio();\nbootstrap();';
if(!app.includes(anchor))throw new Error('Release90: runtime injection anchor missing');
app=app.replace(anchor,runtime+'\n'+anchor);
fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8').replaceAll('v=89','v=90');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=90#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ["const V='90';",'Hobah Release 90 — clean voice engine',"channel:'study'",'voice90PauseScripture','voice90ResumeScripture'])if(!app.includes(required))throw new Error('Release90 integration missing '+required);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 90: voice software rebuilt as a clean state machine with separate Scripture and Study audio channels');