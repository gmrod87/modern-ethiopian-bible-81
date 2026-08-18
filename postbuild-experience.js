const {execFileSync}=require('child_process');
const fs=require('fs');
const release='27';
for(const f of ['experience.js','experience.css','ambient-audio.js'])fs.copyFileSync(f,'dist/'+f);

// Keep the mobile Home control in the header flow so it can never cover the other top icons.
fs.appendFileSync('dist/styles.css',`\n/* Release 27: compact non-overlapping mobile Home button */\n@media(max-width:900px){\n  .topbar #homeBtn{\n    position:static!important;\n    inset:auto!important;\n    left:auto!important;\n    top:auto!important;\n    transform:none!important;\n    z-index:auto!important;\n    display:grid!important;\n    place-items:center!important;\n    flex:0 0 44px!important;\n    width:44px!important;\n    min-width:44px!important;\n    max-width:44px!important;\n    height:44px!important;\n    min-height:44px!important;\n    padding:0!important;\n    margin:0!important;\n    gap:0!important;\n    border:1px solid var(--line)!important;\n    border-radius:50%!important;\n    background:var(--paper)!important;\n    color:var(--ink)!important;\n    box-shadow:none!important;\n  }\n  .topbar #homeBtn .mobileHomeIcon{display:grid!important;place-items:center!important;font-size:22px!important;line-height:1!important}\n  .topbar #homeBtn .mobileHomeText{display:none!important}\n}\n`);

// Put Ambient Music inside Read Aloud without a MutationObserver feedback loop.
{
  const ambientPath='dist/ambient-audio.js';
  let ambient=fs.readFileSync(ambientPath,'utf8');
  const before=ambient;
  ambient=ambient.replace(/  function ensureControl\(\)\{[\s\S]*?\n  \}\n  function init\(\)\{/,
`  function ensureControl(){
    const modes=$('#audioModes'),ctr=$('.audioControls');
    let b=$('#audioAmbient');
    if(!b){
      if(!modes&&!ctr)return;
      b=document.createElement('button');b.id='audioAmbient';b.className='audioExtra audioAmbient';b.type='button';
    }
    b.onclick=toggleAmbient;
    if(modes){
      let row=$('#audioAmbientSetting');
      if(!row){row=document.createElement('div');row.id='audioAmbientSetting';row.className='audioAmbientSetting';row.innerHTML='<div class="audioAmbientCopy"><span>AMBIENT MUSIC</span><small>Quiet adaptive music behind Read Aloud</small></div>';modes.appendChild(row)}
      if(b.parentElement!==row)row.appendChild(b);
    }else if(ctr&&b.parentElement!==ctr){
      const sleep=$('#audioSleep'),close=$('#audioClose');ctr.insertBefore(b,sleep||close);
    }
    updateButton();
  }
  function init(){`);
  ambient=ambient.replace(
    "    ensureControl();new MutationObserver(ensureControl).observe(document.body,{childList:true,subtree:true});",
    "    ensureControl();let ambientObserver=null;if(!$('#audioModes')){ambientObserver=new MutationObserver(()=>{if($('#audioModes')){ambientObserver.disconnect();ambientObserver=null;ensureControl()}});ambientObserver.observe(document.body,{childList:true,subtree:true})}"
  );
  if(ambient===before||ambient.includes('new MutationObserver(ensureControl)'))throw new Error('Ambient Read Aloud loop fix patch target not found');
  fs.writeFileSync(ambientPath,ambient);
}

fs.appendFileSync('dist/experience.css',`\n/* Release 27: visible Ambient Music setting in Read Aloud */\n.audioAmbientSetting{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:11px;border-top:1px solid var(--line)}\n.audioAmbientCopy{min-width:0;display:flex;flex-direction:column;gap:3px}\n.audioAmbientCopy>span{font-size:10px;font-weight:900;letter-spacing:.14em;opacity:.72}\n.audioAmbientCopy>small{display:block!important;font-size:10px;line-height:1.35;opacity:.58}\n.audioAmbientSetting .audioAmbient{flex:0 0 auto;min-width:112px;justify-content:center;white-space:nowrap}\n@media(max-width:520px){.audioAmbientSetting{align-items:flex-start}.audioAmbientSetting .audioAmbient{min-width:104px;font-size:10px!important;padding-left:8px!important;padding-right:8px!important}}\n`);

let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/\?v=\d+/g,`?v=${release}`);
if(!html.includes('/experience.css'))html=html.replace('</head>',`  <link rel="stylesheet" href="/experience.css?v=${release}" />\n</head>`);
if(!html.includes('/experience.js')){
  const chrono=html.match(/\s*<script src="\/chronology\.js\?v=\d+"><\/script>/);
  const scripts=`\n  <script src="/experience.js?v=${release}"></script>\n  <script src="/ambient-audio.js?v=${release}"></script>`;
  if(chrono)html=html.replace(chrono[0],scripts+chrono[0]);else html=html.replace('</body>',scripts+'\n</body>');
}
fs.writeFileSync('dist/index.html',html);
for(const f of ['dist/experience.js','dist/ambient-audio.js'])execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
const swPath='dist/sw.js';
if(fs.existsSync(swPath)){
  let sw=fs.readFileSync(swPath,'utf8');
  sw=sw.replace(/const V=['"][^'"]+['"]/,`const V='meb-native-v${release}-ambient-loop-fix'`);
  if(!sw.includes("'/experience.js'"))sw=sw.replace("'/manifest.webmanifest'","'/manifest.webmanifest','/experience.js','/experience.css','/ambient-audio.js'");
  fs.writeFileSync(swPath,sw);
}
console.log('Modern Ethiopian Bible experience release '+release+' applied');
