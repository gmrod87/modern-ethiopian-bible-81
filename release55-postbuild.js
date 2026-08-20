const fs=require('fs');
const {execFileSync}=require('child_process');
const D='dist',V='55';
const p=f=>`${D}/${f}`;
const read=f=>fs.existsSync(p(f))?fs.readFileSync(p(f),'utf8'):'';
const write=(f,s)=>fs.writeFileSync(p(f),s);

// Remove the older private hands-free controller; Release 55 supplies one low-latency controller only.
let experience=read('experience.js');
if(experience){const marker='// Hands-free Read Aloud controls.';if(experience.includes(marker))experience=experience.split(marker)[0].trimEnd()+'\n';write('experience.js',experience)}

// Ambient music accidentally carried a second Study AI narration bridge. Keep ambient audio only.
let ambient=read('ambient-audio.js');
if(ambient){const marker='// Read Aloud UI cleanup + Study AI narration bridge.';if(ambient.includes(marker))ambient=ambient.split(marker)[0].trimEnd()+'\n';write('ambient-audio.js',ambient)}

// Replace the Study AI narration bridge and add the new hands-free controller.
fs.copyFileSync('release55-study-audio.js',p('read-aloud-v2.js'));
fs.copyFileSync('release55-voice.js',p('release55-voice.js'));

let html=read('index.html');
if(!html)throw new Error('Release55: dist/index.html missing');
html=html.replace(/\/natural-audio\.js\?v=\d+/g,`/natural-audio.js?v=${V}`);
html=html.replace(/\/read-aloud-v2\.js\?v=\d+/g,`/read-aloud-v2.js?v=${V}`);
html=html.replace(/\s*<script src=["']\/release55-voice\.js(?:\?v=\d+)?["']><\/script>/g,'');
html=html.replace('</body>',`  <script src="/release55-voice.js?v=${V}"></script>\n</body>`);
write('index.html',html);

let sw=read('sw.js');
if(sw){sw=sw.replace(/hobah-v\d+(?:-[a-z0-9-]+)?/gi,'hobah-v55-voice-flow').replace(/the81-v\d+(?:-[a-z0-9-]+)?/gi,'hobah-v55-voice-flow');write('sw.js',sw)}

for(const f of ['experience.js','ambient-audio.js','read-aloud-v2.js','release55-voice.js','app.js','feature-loader.js','sw.js'])if(fs.existsSync(p(f)))execFileSync(process.execPath,['--check',p(f)],{stdio:'inherit'});
console.log('Hobah Release 55 voice flow applied');
