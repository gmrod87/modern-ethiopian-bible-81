const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release87: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='86';"))throw new Error('Release87: runtime version 86 not found');
app=app.replace("const V='86';","const V='87';");
const broken="function openSettings(){\n  $('.bottomNav button').forEach(b=>b.classList.remove('active'));const nav=document.getElementById('bottomSettings');if(nav)nav.classList.add('active');\n  const d=ensureSettingsDialog(),voice=document.getElementById('settingsVoiceEnabled'),night=document.getElementById('settingsNightMode');\n  voice.checked=voicePreferenceEnabled();night.checked=nightModeEnabled();syncSettingsVoiceUI();\n  if(!d.open)d.showModal();\n}";
const fixed="function openSettings(){\n  const d=ensureSettingsDialog();\n  document.querySelectorAll('.bottomNav button').forEach(b=>b.classList.remove('active'));\n  const nav=document.getElementById('bottomSettings');if(nav)nav.classList.add('active');\n  const voice=document.getElementById('settingsVoiceEnabled'),night=document.getElementById('settingsNightMode');\n  if(voice)voice.checked=voicePreferenceEnabled();if(night)night.checked=nightModeEnabled();syncSettingsVoiceUI();\n  if(!d.open){try{d.showModal()}catch(e){console.warn('Settings modal fallback',e);d.setAttribute('open','')}}\n}";
if(!app.includes(broken))throw new Error('Release87: exact broken Settings opener not found');
app=app.replace(broken,fixed);
// Release 86 injected the same invalid single-element iteration in more than one generated path.
// Remove every remaining copy in the final runtime so native/web fallbacks cannot hit it.
app=app.replaceAll("$('.bottomNav button').forEach","document.querySelectorAll('.bottomNav button').forEach");
if(app.includes("$('.bottomNav button').forEach"))throw new Error('Release87: broken single-element forEach still present');
if(!app.includes("document.querySelectorAll('.bottomNav button').forEach"))throw new Error('Release87: safe nav iteration missing');
fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/app.js?v=86','/app.js?v=87').replace('/manifest.webmanifest?v=86','/manifest.webmanifest?v=87').replace('/release85-settings.css?v=86','/release85-settings.css?v=87');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=87#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 87: Settings opener fixed to use querySelectorAll + modal fallback');
