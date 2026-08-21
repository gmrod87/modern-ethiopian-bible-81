const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
if(!fs.existsSync(p('app.js'))||!fs.existsSync(p('index.html')))throw new Error('Release86: build output missing');
let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='85';"))throw new Error('Release86: runtime version 85 not found');
app=app.replace("const V='85';","const V='86';");

const settingsRe=/function openSettings\(\)\{[\s\S]*?\n\}\nfunction initGlobalSettings\(\)\{/;
if(!settingsRe.test(app))throw new Error('Release86: Release85 Settings block not found');
const replacement=`function ensureSettingsDialog(){
  let d=document.getElementById('settingsDialog');if(d)return d;
  d=document.createElement('dialog');d.id='settingsDialog';d.className='sheet settingsSheet';
  d.innerHTML='<div class="sheetWrap"><div class="sheetCard settingsCard"><div class="sheetHead"><h2>Settings</h2><button class="sheetClose" id="settingsClose" aria-label="Close">×</button></div><div class="settingsPanel"><section class="settingsGroup"><span class="settingsGroupTitle">Voice & listening</span><label class="settingsRow"><span class="settingsText"><b>Voice Commands</b><small id="settingsVoiceStatus">Always listening while Hobah is open</small></span><span class="settingsStatus"><i id="settingsVoiceDot" class="settingsDot"></i><span class="settingsSwitch"><input id="settingsVoiceEnabled" type="checkbox"><span></span></span></span></label></section><section class="settingsGroup"><span class="settingsGroupTitle">Appearance</span><label class="settingsRow"><span class="settingsText"><b>Night Mode</b><small>Use Hobah\'s dark reading theme.</small></span><span class="settingsSwitch"><input id="settingsNightMode" type="checkbox"><span></span></span></label></section><section class="settingsGroup"><span class="settingsGroupTitle">Hobah</span><button class="settingsRow" id="settingsPrivacy"><span class="settingsText"><b>Privacy & Policies</b><small>Read Hobah\'s privacy policy.</small></span><span class="settingsChevron">›</span></button><button class="settingsRow" id="settingsSupport"><span class="settingsText"><b>Support</b><small>Help and support information.</small></span><span class="settingsChevron">›</span></button><div class="settingsAbout"><h3>About Hobah</h3><p>Hobah — The Ancient Canon. An 81-book Ethiopian Bible reading, listening, search and Study AI edition for iPhone, iPad and the web.</p></div></section></div></div></div>';
  document.body.appendChild(d);
  document.getElementById('settingsClose').onclick=()=>d.close();
  d.addEventListener('click',e=>{if(e.target===d)d.close()});
  const voice=document.getElementById('settingsVoiceEnabled'),night=document.getElementById('settingsNightMode');
  voice.onchange=()=>setPersistentVoiceEnabled(voice.checked).catch(e=>{console.warn('Voice setting',e);syncSettingsVoiceUI()});
  night.onchange=()=>applyNightMode(night.checked);
  document.getElementById('settingsPrivacy').onclick=()=>openSettingsExternal('/privacy.html');
  document.getElementById('settingsSupport').onclick=()=>openSettingsExternal('/support.html');
  return d;
}
function openSettings(){
  $$('.bottomNav button').forEach(b=>b.classList.remove('active'));const nav=document.getElementById('bottomSettings');if(nav)nav.classList.add('active');
  const d=ensureSettingsDialog(),voice=document.getElementById('settingsVoiceEnabled'),night=document.getElementById('settingsNightMode');
  voice.checked=voicePreferenceEnabled();night.checked=nightModeEnabled();syncSettingsVoiceUI();
  if(!d.open)d.showModal();
}
window.HobahSettings={open:openSettings,sync:syncSettingsVoiceUI};
document.addEventListener('hobah:open-settings',openSettings);
function initGlobalSettings(){`;
app=app.replace(settingsRe,replacement);

// Make the nav binding resilient even if another renderer replaces the bottom nav node.
const bindMarker="  $('#bottomLibrary').onclick=openLibrary;$('#bottomSettings').onclick=openSettings;initGlobalSettings();";
if(app.includes(bindMarker))app=app.replace(bindMarker,"  $('#bottomLibrary').onclick=openLibrary;const settingsNav=$('#bottomSettings');if(settingsNav)settingsNav.onclick=openSettings;initGlobalSettings();");
if(!app.includes("document.addEventListener('hobah:settings-nav'")){
  app=app.replace("document.addEventListener('hobah:open-settings',openSettings);","document.addEventListener('hobah:open-settings',openSettings);document.addEventListener('hobah:settings-nav',openSettings);");
}

fs.writeFileSync(p('app.js'),app);
let html=fs.readFileSync(p('index.html'),'utf8');
html=html.replace('/styles.css?v=85','/styles.css?v=86').replace('/app.js?v=85','/app.js?v=86').replace('/manifest.webmanifest?v=85','/manifest.webmanifest?v=86').replace('/release85-settings.css?v=85','/release85-settings.css?v=86');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=86#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}
for(const required of ["const V='86';",'ensureSettingsDialog','settingsDialog','window.HobahSettings','hobah:open-settings','hobah:settings-nav'])if(!app.includes(required))throw new Error('Release86 integration missing '+required);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
console.log('Hobah Release 86: dedicated Settings sheet + resilient Settings nav applied');
