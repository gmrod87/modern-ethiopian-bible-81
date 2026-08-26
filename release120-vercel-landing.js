const fs=require('fs');
const path=require('path');
const D='dist';
const p=f=>path.join(D,f);
for(const f of ['index.html','hobah-mark.svg']) if(!fs.existsSync(p(f))) throw new Error('Release120 missing built app asset: '+f);
for(const f of ['landing-page.html','landing-page.css']) if(!fs.existsSync(f)) throw new Error('Release120 missing landing source: '+f);

// Preserve the complete web app at /reader.html before replacing only Vercel's public root.
fs.copyFileSync(p('index.html'),p('reader.html'));
fs.copyFileSync('landing-page.html',p('index.html'));
fs.copyFileSync('landing-page.css',p('landing-page.css'));

// Verify important App Store landing and support routes survive the production bundle.
const html=fs.readFileSync(p('index.html'),'utf8');
for(const token of ['Hobah — 81 Books + Ancient Writings','Coming soon','/support.html','/privacy.html','/reader.html']){
  if(!html.includes(token)) throw new Error('Release120 landing verification failed: '+token);
}
if(!fs.existsSync(p('support.html'))) throw new Error('Release120 support page missing from Vercel output');
if(!fs.existsSync(p('privacy.html'))) throw new Error('Release120 privacy page missing from Vercel output');
console.log('Hobah Release 120: Vercel root is the App Store landing page; full web reader preserved at /reader.html');
