const fs=require('fs');
const {execFileSync}=require('child_process');
const p='dist/app.js';
if(!fs.existsSync(p))throw new Error('Release52b: dist/app.js missing');
let app=fs.readFileSync(p,'utf8');
app=app.replace("$('#filters button').forEach",()=>"$$('#filters button').forEach");
fs.writeFileSync(p,app);
for(const f of ['dist/app.js','dist/feature-loader.js','dist/sw.js'])execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
console.log('Hobah Release 52b filter binding fixed and runtime syntax verified');
