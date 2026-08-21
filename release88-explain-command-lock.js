const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release88: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='87';"))throw new Error('Release88: runtime version 87 not found');
app=app.replace("const V='87';","const V='88';");

// Always-listening speech recognition emits several interim versions of the same phrase.
// Never let a duplicate "explain" transcript abort/restart the request that already owns Study AI.
const oldBusy="  if(state.audio.studyBusy){abortStudyRequest('recover');state.audio.studyBusy=false;setStudyPhase('idle');if(window.HobahNativeAudio)await window.HobahNativeAudio.stop().catch(()=>{})}";
const newBusy="  if(state.audio.studyBusy)return;\n  if(Date.now()<(state.audio.studyExplainCooldownUntil||0))return;";
if(!app.includes(oldBusy))throw new Error('Release88: Explain That busy recovery block not found');
app=app.replace(oldBusy,newBusy);

// Do not immediately re-trigger from the stale final/partial transcript when recognition resumes.
const oldFinish="    if(state.audio.resumeAfterStudy)resumeScriptureAfterStudy();else state.audio.resumeAfterStudy=false;\n    resumeRecognitionAfterStudy();";
const newFinish="    if(state.audio.resumeAfterStudy)resumeScriptureAfterStudy();else state.audio.resumeAfterStudy=false;\n    state.audio.studyExplainCooldownUntil=Date.now()+2200;\n    resumeRecognitionAfterStudy();";
if(!app.includes(oldFinish))throw new Error('Release88: Explain That completion handoff not found');
app=app.replace(oldFinish,newFinish);

// The native Study narrator should not race Capacitor listener/plugin initialization.
const nativeStart="  if(window.HobahNativeAudio){\n    const prepared=parts.map(part=>window.HobahNativeAudio.prepare({text:part,mode:'normal'}).catch(()=>{}));";
const nativeReady="  if(window.HobahNativeAudio){\n    await Promise.resolve(window.HobahNativeAudioReady);\n    const prepared=parts.map(part=>window.HobahNativeAudio.prepare({text:part,mode:'normal'}).catch(()=>{}));";
if(!app.includes(nativeStart))throw new Error('Release88: native Study narration block not found');
app=app.replace(nativeStart,nativeReady);

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/app.js?v=87','/app.js?v=88').replace('/manifest.webmanifest?v=87','/manifest.webmanifest?v=88').replace('/release85-settings.css?v=87','/release85-settings.css?v=88');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=88#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ["const V='88';","if(state.audio.studyBusy)return;","studyExplainCooldownUntil=Date.now()+2200","await Promise.resolve(window.HobahNativeAudioReady)"]){if(!app.includes(required))throw new Error('Release88 integration missing '+required)}
if(app.includes("abortStudyRequest('recover')"))throw new Error('Release88: duplicate Explain That can still abort the active request');
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 88: Explain That ignores duplicate interim commands and waits for native audio readiness');
