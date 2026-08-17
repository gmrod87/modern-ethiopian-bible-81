const {execFileSync}=require('child_process');
const fs=require('fs');
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
execFileSync('tar',['-xzf','native-bible-app.tar.gz','-C','dist'],{stdio:'inherit'});

const release='9';
fs.copyFileSync('study-v2.js','dist/study.js');
fs.copyFileSync('study.css','dist/study.css');
fs.copyFileSync('curated-notes.js','dist/curated-notes.js');
fs.copyFileSync('natural-audio.js','dist/natural-audio.js');
const dataFiles=fs.readdirSync('.').filter(x=>/^study-data-\d+\.js$/.test(x)).sort();
for(const f of dataFiles) fs.copyFileSync(f,`dist/${f}`);

let study=fs.readFileSync('dist/study.js','utf8');
const missingFetch="      const b=await fetch(`/data/${slug}.json`).then(r=>r.json()),chapter=b.chapters.find(x=>x.n===c)||b.chapters[0],sec=sectionFor(a,c);";
const nativeSource="      const sec=sectionFor(a,c),verseMap=new Map([...article.querySelectorAll('.verse')].map(p=>{const q=p.cloneNode(true);q.querySelector('.vnum')?.remove();const v=+p.dataset.v;return [v,{v,t:q.textContent.trim()}]}));";
if(!study.includes(missingFetch)) throw new Error('Study patch target not found');
study=study.replace(missingFetch,nativeSource);
study=study.replaceAll('chapter.verses.find(x=>x.v===v)','verseMap.get(v)');

const marker='  async function enhance()';
const selective=`
  const curated=(meta,c,v)=>window.MEB_CURATED_NOTES?.[\`${'${meta.slug}'}:\${c}:\${v}\`]||'';
  function worthStudy(meta,a,sec,c,v,text){
    if(curated(meta,c,v)) return true;
    const ks=terms.filter(x=>x[0].test(text));
    const obs=literary(a,text);
    const sectionOpening=!!sec && c===sec.start && v===1;
    const historicallyDense=/\\b(?:Pharaoh|Caesar|Herod|Pilate|Assyria|Babylon|Persia|Rome|Jerusalem|temple|high priest|synagogue|Sabbath|Passover|covenant|circumcision|resurrection|Messiah|Christ|Son of Man|YHWH|Nephilim|Watchers|Melchizedek)\\b/i.test(text);
    return sectionOpening || ks.length>=2 || (ks.length>=1 && obs.length>=1) || (historicallyDense && text.length>55);
  }
  function substantialPanel(meta,a,sec,c,v,text){
    const ref=studyRef(meta.title,c,v),is=saved(ref),special=curated(meta,c,v);
    const ks=terms.filter(x=>x[0].test(text)).slice(0,2),obs=literary(a,text).slice(0,2);
    let paragraphs=[];
    if(special) paragraphs=[special];
    else {
      const opening=sec?.note?sec.note+' ':'';
      const term=ks[0]?ks[0][2]+' ':'';
      const lit=obs[0]?obs[0]+' ':'';
      const critical=a?.scholarship?`From a historical-critical perspective, ${a.scholarship.charAt(0).toLowerCase()+a.scholarship.slice(1)}`:'';
      const p=(opening+term+lit+critical).replace(/\\s+/g,' ').trim();
      if(p) paragraphs=[p];
    }
    return \`<div class="studyVerseInner"><div class="studyTop"><span>STUDY NOTE</span><b>\${esc(meta.title)} \${c}:\${v}</b></div>\${paragraphs.map(p=>\`<div class="studyBlock"><p>\${esc(p)}</p></div>\`).join('')}\${ks.length&&!special?\`<div class="studyTerms">\${ks.map(x=>\`<div><small>KEY TERM</small><b>\${esc(x[1])}</b><p>\${esc(x[2])}</p></div>\`).join('')}</div>\`:''}<button class="studySave verseStudySave" data-ref="\${esc(ref)}" data-v="\${v}">\${is?'♥ Saved study note':'♡ Save study note'}</button><p class="studyDisclaimer">Editorial study note — not part of the biblical text.</p></div>\`;
  }
`;
if(!study.includes(marker)) throw new Error('Enhance marker not found');
study=study.replace(marker,selective+'\n'+marker);
study=study.replace('box.innerHTML=versePanel(meta,a,sec,c,v,verse.t);','box.innerHTML=substantialPanel(meta,a,sec,c,v,verse.t);');
study=study.replace("      const head=article.previousElementSibling;","      const head=article.previousElementSibling;\n      const eligibleCount=[...article.querySelectorAll('.verse')].filter(p=>{const v=+p.dataset.v,verse=verseMap.get(v);return verse&&worthStudy(meta,a,sec,c,v,verse.t)}).length;\n      if(eligibleCount&&!document.querySelector('.studyAvailable'))article.insertAdjacentHTML('beforebegin',`<div class=\"studyAvailable\"><span>✦</span><div><b>Selective study notes</b><small>Only verses with useful historical, textual, linguistic, or interpretive context are annotated.</small></div></div>`);");
study=study.replace("      $$('.verse').forEach(p=>{if(p.dataset.studyAttached)return;p.dataset.studyAttached='1';const v=+p.dataset.v,verse=verseMap.get(v);if(!verse)return;", "      $$('.verse').forEach(p=>{if(p.dataset.studyAttached)return;p.dataset.studyAttached='1';const v=+p.dataset.v,verse=verseMap.get(v);if(!verse||!worthStudy(meta,a,sec,c,v,verse.t))return;");
fs.writeFileSync('dist/study.js',study);

fs.appendFileSync('dist/study.css',`\n.studyAvailable{display:flex;gap:12px;align-items:center;margin:14px 0 18px;padding:13px 14px;border:1px solid rgba(137,94,29,.42);border-radius:14px;background:rgba(175,124,46,.10)}.studyAvailable>span{font-size:24px;color:#9a681f}.studyAvailable div{display:flex;flex-direction:column;gap:3px}.studyAvailable b{font-size:15px}.studyAvailable small{font-size:12px;line-height:1.45;opacity:.78}.studyToggle{display:flex!important;width:max-content!important;border:1px solid rgba(154,104,31,.36)!important;background:rgba(175,124,46,.10)!important;border-radius:999px!important;padding:6px 11px!important;margin:3px 0 10px!important;font-size:11px!important;font-weight:800!important}.studyVerseInner .studyBlock p{font-size:14px;line-height:1.72;margin:0}.studyVerseInner{padding:18px!important}\n`);

let html=fs.readFileSync('dist/index.html','utf8');
if(!html.includes('/study.css')) html=html.replace('</head>',`  <link rel="stylesheet" href="/study.css?v=${release}" />\n</head>`);
if(!html.includes('/study.js')){
  const scripts=dataFiles.map(f=>`  <script src="/${f}?v=${release}"></script>`).join('\n')+`\n  <script src="/curated-notes.js?v=${release}"></script>\n  <script src="/study.js?v=${release}"></script>\n  <script src="/natural-audio.js?v=${release}"></script>\n`;
  html=html.replace('</body>',scripts+'</body>');
}
fs.writeFileSync('dist/index.html',html);

const swPath='dist/sw.js';
if(fs.existsSync(swPath)){
  let sw=fs.readFileSync(swPath,'utf8');
  sw=sw.replace(/const V=['\"][^'\"]+['\"]/,"const V='meb-native-v9-selective-natural-audio'");
  const add=['/study.js','/study.css','/curated-notes.js','/natural-audio.js',...dataFiles.map(f=>'/'+f)];
  sw=sw.replace("'/manifest.webmanifest'",`'/manifest.webmanifest',${add.map(x=>`'${x}'`).join(',')}`);
  fs.writeFileSync(swPath,sw);
}
console.log(`Native 81-book Bible app + selective study + natural narration release ${release} built`);