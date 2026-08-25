const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const D='dist',p=f=>path.join(D,f);
for(const f of ['app.js','release94-ancient-library.js','index.html'])if(!fs.existsSync(p(f)))throw new Error('Release117 missing '+f);

let app=fs.readFileSync(p('app.js'),'utf8');
if(!app.includes("const V='116';"))throw new Error('Release117 expected app runtime v116');
const oldHome=`    const label=clean(progress.chapterLabel||'');
    hero.textContent='Continue reading';hero.setAttribute('href','#');hero.dataset.ancientContinue='1';hero.onclick=e=>openAncientProgress(progress,e);
    card.setAttribute('href','#');card.dataset.ancientContinue='1';card.onclick=e=>openAncientProgress(progress,e);`;
const newHome=`    const label=clean(progress.chapterLabel||''),signature=[progress.workId,progress.chapterIndex||0,label].join('|');
    if(hero.dataset.ancientContinue===signature&&card.dataset.ancientContinue===signature)return;
    hero.textContent='Continue reading';hero.setAttribute('href','#');hero.dataset.ancientContinue=signature;hero.onclick=e=>openAncientProgress(progress,e);
    card.setAttribute('href','#');card.dataset.ancientContinue=signature;card.onclick=e=>openAncientProgress(progress,e);`;
if(!app.includes(oldHome))throw new Error('Release117 Home progress patch target missing');
app=app.replace(oldHome,newHome).replace("const V='116';","const V='117';");
fs.writeFileSync(p('app.js'),app);

let lib=fs.readFileSync(p('release94-ancient-library.js'),'utf8');
if(!lib.includes("const LIB_VERSION='116';"))throw new Error('Release117 expected Ancient Library v116');
const oldLoader=`    const work=findWork(workId),chapter=work?.chapters?.[chapterIndex];`;
const newLoader=`    const work=await loadAncientWork(workId),chapter=work?.chapters?.[chapterIndex];`;
if(!lib.includes(oldLoader))throw new Error('Release117 Ancient progress loader patch target missing');
lib=lib.replace(oldLoader,newLoader).replace("const LIB_VERSION='116';","const LIB_VERSION='117';");
fs.writeFileSync(p('release94-ancient-library.js'),lib);

let html=fs.readFileSync(p('index.html'),'utf8').replace(/\?v=116\b/g,'?v=117');
fs.writeFileSync(p('index.html'),html);
if(fs.existsSync(p('manifest.webmanifest'))){const m=JSON.parse(fs.readFileSync(p('manifest.webmanifest'),'utf8'));m.start_url='/?v=117#home';fs.writeFileSync(p('manifest.webmanifest'),JSON.stringify(m))}

for(const required of ["const V='117';",'ancientContinue===signature'])if(!app.includes(required))throw new Error('Release117 app hardening missing '+required);
for(const required of ["const LIB_VERSION='117';",'await loadAncientWork(workId)'])if(!lib.includes(required))throw new Error('Release117 Ancient hardening missing '+required);
execFileSync(process.execPath,['--check',p('app.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',p('release94-ancient-library.js')],{stdio:'inherit'});
console.log('Hobah Release 117: Ancient progress uses the direct work loader and Home Continue redraws are guarded');
