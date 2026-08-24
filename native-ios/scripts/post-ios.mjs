import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appRoot=path.join(root,'ios','App','App');
const infoPath=path.join(appRoot,'Info.plist');
const delegatePath=path.join(appRoot,'AppDelegate.swift');
if(!existsSync(infoPath)||!existsSync(delegatePath))throw new Error('iOS project not found. Run npm run ios:init first.');

let info=await readFile(infoPath,'utf8');
// App Store validation: Hobah supports iPhone/iPad multitasking, so this legacy
// opt-out flag must never be present in the shipping Info.plist.
info=info.replace(/\s*<key>UIApplicationExitsOnSuspend<\/key>\s*<(?:true|false)\s*\/>/g,'');
const add=(key,snippet)=>{if(!info.includes(`<key>${key}</key>`))info=info.replace('</dict>\n</plist>',`${snippet}\n</dict>\n</plist>`)};
add('NSMicrophoneUsageDescription',`\t<key>NSMicrophoneUsageDescription</key>\n\t<string>Hobah uses the microphone only while Voice Commands are enabled so you can pause, resume, explain and save while listening.</string>`);
add('NSSpeechRecognitionUsageDescription',`\t<key>NSSpeechRecognitionUsageDescription</key>\n\t<string>Hobah uses speech recognition for optional hands-free Bible reading commands.</string>`);
add('UIBackgroundModes',`\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>audio</string>\n\t</array>`);
add('CFBundleURLTypes',`\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleTypeRole</key>\n\t\t\t<string>Editor</string>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>com.hobah.bible</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array><string>hobah</string></array>\n\t\t</dict>\n\t</array>`);
add('ITSAppUsesNonExemptEncryption',`\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>`);
add('UIViewControllerBasedStatusBarAppearance',`\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<true/>`);
await writeFile(infoPath,info);

let delegate=await readFile(delegatePath,'utf8');
if(!delegate.includes('import AVFoundation'))delegate=delegate.replace('import UIKit','import UIKit\nimport AVFoundation');
if(!delegate.includes('Hobah background spoken-audio session')){
  const audio=`\n        // Hobah background spoken-audio session\n        do {\n            let session = AVAudioSession.sharedInstance()\n            try session.setCategory(.playback, mode: .spokenAudio, options: [])\n            try session.setActive(true)\n        } catch {\n            print("Hobah audio session error: \\(error)")\n        }\n`;
  const marker='        return true';
  if(!delegate.includes(marker))throw new Error('AppDelegate launch return not found');
  delegate=delegate.replace(marker,audio+marker);
}
await writeFile(delegatePath,delegate);

const HOBahGreen='#173A2C';
const HOBahGold='#D9A23B';
const iconSvg=await readFile(path.join(root,'assets','hobah-icon.svg'));
const crossSvg=await readFile(path.join(root,'assets','hobah-cross-mark.svg'));
const iconDir=path.join(appRoot,'Assets.xcassets','AppIcon.appiconset');
await mkdir(iconDir,{recursive:true});
const specs=[
  ['iphone','20x20','2x',40],['iphone','20x20','3x',60],['iphone','29x29','2x',58],['iphone','29x29','3x',87],
  ['iphone','40x40','2x',80],['iphone','40x40','3x',120],['iphone','60x60','2x',120],['iphone','60x60','3x',180],
  ['ipad','20x20','1x',20],['ipad','20x20','2x',40],['ipad','29x29','1x',29],['ipad','29x29','2x',58],
  ['ipad','40x40','1x',40],['ipad','40x40','2x',80],['ipad','76x76','1x',76],['ipad','76x76','2x',152],['ipad','83.5x83.5','2x',167],
  ['ios-marketing','1024x1024','1x',1024]
];
const images=[];
for(const [idiom,size,scale,px] of specs){
  const filename=`hobah-${size.replace('.','_')}-${scale}-${idiom}.png`;
  await sharp(iconSvg)
    .resize(px,px)
    .flatten({background:HOBahGreen})
    .removeAlpha()
    .png({palette:false})
    .toFile(path.join(iconDir,filename));
  images.push({idiom,size,scale,filename});
}
await writeFile(path.join(iconDir,'Contents.json'),JSON.stringify({images,info:{author:'xcode',version:1}},null,2));

const splashDir=path.join(appRoot,'Assets.xcassets','Splash.imageset');
if(existsSync(path.dirname(splashDir))){
  await mkdir(splashDir,{recursive:true});
  // Match the approved icon reference: darker forest canvas, broad dimensional cross,
  // and a restrained caption. The same source cross is used in the app header.
  const canvasSize=2732;
  const logoSize=1120;
  const logoLeft=Math.round((canvasSize-logoSize)/2);
  const logoTop=610;
  const logo=await sharp(crossSvg).resize(logoSize,logoSize,{fit:'contain'}).png({palette:false}).toBuffer();
  const caption=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><text x="1366" y="2352" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="54" font-weight="500" letter-spacing="4" fill="${HOBahGold}">The Ancient Canon</text></svg>`);
  const filenames=['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png'];
  for(const filename of filenames){
    await sharp({create:{width:2732,height:2732,channels:3,background:HOBahGreen}})
      .composite([{input:logo,left:logoLeft,top:logoTop},{input:caption,left:0,top:0}])
      .removeAlpha()
      .png({palette:false})
      .toFile(path.join(splashDir,filename));
  }
  const splashContents={images:[
    {idiom:'universal',filename:filenames[0],scale:'1x'},
    {idiom:'universal',filename:filenames[1],scale:'2x'},
    {idiom:'universal',filename:filenames[2],scale:'3x'}
  ],info:{author:'xcode',version:1}};
  await writeFile(path.join(splashDir,'Contents.json'),JSON.stringify(splashContents,null,2));
}

console.log('Hobah iOS native settings, permissions, background audio, approved bold-cross icons and forest launch screen applied');
