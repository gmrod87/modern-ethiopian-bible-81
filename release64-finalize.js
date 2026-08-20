const fs=require('fs'),{execFileSync}=require('child_process');
if(!fs.existsSync('dist'))throw new Error('Release64 finalize: dist missing');
fs.copyFileSync('release64-study-hub.js','dist/study-hub.js');
execFileSync(process.execPath,['--check','dist/study-hub.js'],{stdio:'inherit'});
const html=fs.readFileSync('dist/index.html','utf8');
for(const s of ['/experience.js?v=64','/ambient-audio.js?v=64','/feature-loader.js?v=64','/read-aloud-v2.js?v=64'])if(!html.includes(s))throw new Error(`Release64 finalize: missing ${s}`);
console.log('Hobah Release 64 final: rich Study Library + Study AI tabs restored');
