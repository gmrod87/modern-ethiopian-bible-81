const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist',V='59';
const p=f=>`${D}/${f}`;
const read=f=>fs.readFileSync(p(f),'utf8');
const write=(f,s)=>fs.writeFileSync(p(f),s);

if(!fs.existsSync(D))throw new Error('Release59: dist missing');
for(const f of ['natural-audio.js','release55-voice.js','release55-study-audio.js']){
  if(!fs.existsSync(f))throw new Error(`Release59: ${f} missing`);
  fs.copyFileSync(f,p(f));
}
for(let i=0;i<10;i++){
  const f=`study-data-${String(i).padStart(2,'0')}.js`;
  if(!fs.existsSync(f))throw new Error(`Release59: ${f} missing`);
  fs.copyFileSync(f,p(f));
}

// Restore the server-generated natural narrator without adding a startup health-check round trip.
let natural=read('natural-audio.js');
natural=natural.replace("const r=await fetch('/api/tts?health=1',{cache:'no-store'});enabled=r.ok;if(enabled){","enabled=true;if(enabled){");
natural=natural.replace(
  '<span>READ MODE</span><div><button data-audio-mode="normal">Normal</button><button data-audio-mode="context">Context Added</button><button data-audio-mode="advanced">Advanced</button></div>',
  '<span>CONTEXT</span><div><button data-audio-mode="normal">None</button><button data-audio-mode="context">Context</button><button data-audio-mode="advanced">Advanced</button></div>'
);
natural=natural.replace("mode()==='normal'?'Normal':mode()==='context'?'Context Added':'Advanced'","mode()==='normal'?'None':mode()==='context'?'Context':'Advanced'");
write('natural-audio.js',natural);

// Keep the Release 55 low-latency voice-command controller and make the copy fit the restored player.
let voice=read('release55-voice.js');
voice=voice.replace('Say “stop”, “play”, or “explain that”. “Stop” holds your place so Study AI can explain and resume.','Say “stop”, “play”, “continue”, or “explain that”.');
write('release55-voice.js',voice);

// Add a small compatibility layer so the controls stay readable in the stable Hobah visual system.
let css=read('hobah-core-ui.css');
css+=`\n/* Hobah Release ${V}: natural narration + context + voice commands */\n.audioModes{display:flex;flex-direction:column;gap:10px;margin:12px 0 4px;padding:12px 0 0;border-top:1px solid var(--line)}\n.audioModes>span{font-size:10px;font-weight:900;letter-spacing:.14em;opacity:.7}\n.audioModes>div{display:flex;gap:7px;flex-wrap:wrap}\n.audioModes [data-audio-mode]{min-height:34px;padding:7px 12px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.34);color:inherit;font:inherit;font-size:12px;font-weight:800}\n.audioModes [data-audio-mode].active{background:#1b5146;color:#fff;border-color:#1b5146}\n.audioVoiceSetting{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding-top:11px;border-top:1px solid var(--line)}\n.audioVoiceCopy{min-width:0;display:flex;flex-direction:column;gap:3px}.audioVoiceCopy>span{font-size:10px;font-weight:900;letter-spacing:.14em;opacity:.72}.audioVoiceCopy>small{font-size:10px;line-height:1.35;opacity:.62}.audioVoiceCopy em{font-size:9px;line-height:1.35;opacity:.72;font-style:normal}\n.voiceToggle{position:relative;flex:0 0 48px;width:48px;height:28px;border:0!important;border-radius:999px!important;padding:0!important;background:rgba(120,110,100,.28)!important;box-shadow:none!important}.voiceToggle:after{content:'';position:absolute;width:22px;height:22px;left:3px;top:3px;border-radius:50%;background:#fffdf8;box-shadow:0 1px 5px rgba(0,0,0,.2);transition:transform .18s ease}.voiceToggle.active{background:#1b5146!important}.voiceToggle.active:after{transform:translateX(20px)}\n@media(max-width:520px){.audioVoiceSetting{align-items:flex-start}.audioVoiceCopy small{max-width:220px}}\n`;
write('hobah-core-ui.css',css);

let html=read('index.html');
html=html.replace(/\s*<script[^>]+src=["']\/(?:natural-audio|release55-study-audio|release55-voice|study-data-\d{2})\.js[^"']*["'][^>]*><\/script>/g,'');
const studyTags=Array.from({length:10},(_,i)=>`  <script src="/study-data-${String(i).padStart(2,'0')}.js?v=${V}"></script>`).join('\n');
const audioTags=`${studyTags}\n  <script src="/natural-audio.js?v=${V}"></script>\n  <script src="/release55-study-audio.js?v=${V}"></script>\n  <script src="/release55-voice.js?v=${V}"></script>`;
html=html.replace('</body>',`${audioTags}\n</body>`);
write('index.html',html);

let app=read('app.js');
app=app.replace(/navigator\.serviceWorker\.register\('\/sw\.js\?v=\d+'\)/g,`navigator.serviceWorker.register('/sw.js?v=${V}')`);
write('app.js',app);

for(const f of ['app.js','natural-audio.js','release55-study-audio.js','release55-voice.js','sw.js']){
  execFileSync(process.execPath,['--check',p(f)],{stdio:'inherit'});
}
const out=read('index.html');
if(!out.includes(`/natural-audio.js?v=${V}`)||!out.includes(`/release55-voice.js?v=${V}`))throw new Error('Release59 voice scripts missing from production HTML');
if(!out.includes('/study-data-00.js')||!out.includes('/study-data-09.js'))throw new Error('Release59 context data missing from production HTML');
console.log(`Hobah Release ${V}: natural voice, context modes and voice-command toggle restored`);
