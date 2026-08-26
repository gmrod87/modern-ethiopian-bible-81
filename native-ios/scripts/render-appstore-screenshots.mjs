import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out=process.env.APPSTORE_SCREENSHOT_DIR||path.resolve('native-ios/appstore-screenshots');
const url=process.env.APPSTORE_SCREENSHOT_URL||'https://modern-ethiopian-bible-81.vercel.app/';
fs.mkdirSync(out,{recursive:true});

const targets=[
  {name:'hobah-iphone-67-home.jpg',width:430,height:932,dpr:3,mobile:true},
  {name:'hobah-ipad-129-home.jpg',width:1024,height:1366,dpr:2,mobile:true}
];

const browser=await chromium.launch({headless:true});
try{
  for(const t of targets){
    const context=await browser.newContext({
      viewport:{width:t.width,height:t.height},
      deviceScaleFactor:t.dpr,
      isMobile:t.mobile,
      hasTouch:true,
      locale:'en-AU',
      colorScheme:'light',
      userAgent:t.width<500
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    });
    const page=await context.newPage();
    await page.goto(url,{waitUntil:'networkidle',timeout:90000});
    await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready; window.scrollTo(0,0)});
    await page.waitForTimeout(3500);
    await page.evaluate(()=>window.scrollTo(0,0));
    const file=path.join(out,t.name);
    await page.screenshot({path:file,type:'jpeg',quality:96,fullPage:false});
    const size=fs.statSync(file).size;
    console.log(`Rendered ${file} (${size} bytes) at ${t.width*t.dpr}x${t.height*t.dpr}.`);
    await context.close();
  }
}finally{await browser.close()}
