const fs=require('fs'),z=require('zlib'),p=require('path');
let b='';for(let i=0;i<32;i++)b+=fs.readFileSync(`native60_${String(i).padStart(2,'0')}.txt`,'utf8');
const files=JSON.parse(z.brotliDecompressSync(Buffer.from(b,'base64')).toString('utf8'));
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist',{recursive:true});
for(const [name,data] of Object.entries(files)){const out=p.join('dist',name);fs.mkdirSync(p.dirname(out),{recursive:true});fs.writeFileSync(out,data)}
console.log('Built native Bible app:',Object.keys(files).length,'files');
