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
const iconSvg=await readFile(path.join(root,'assets','hobah-icon.svg'));
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

// Loading screen only. This deliberately does not modify any web/home-page files.
const loadingSvgPath=path.join(root,'assets','hobah-loading-screen.svg');
if(!existsSync(loadingSvgPath))throw new Error('Approved Hobah loading screen asset missing');
const loadingSvg=await readFile(loadingSvgPath);
const splashDir=path.join(appRoot,'Assets.xcassets','Splash.imageset');
if(existsSync(path.dirname(splashDir))){
  await mkdir(splashDir,{recursive:true});
  const splashSpecs=[
    ['splash-approved-1x.png',720,1280,'1x'],
    ['splash-approved-2x.png',1440,2560,'2x'],
    ['splash-approved-3x.png',2160,3840,'3x']
  ];
  const splashImages=[];
  for(const [filename,width,height,scale] of splashSpecs){
    await sharp(loadingSvg)
      .resize(width,height,{fit:'fill'})
      .flatten({background:HOBahGreen})
      .removeAlpha()
      .png({palette:false,compressionLevel:9})
      .toFile(path.join(splashDir,filename));
    splashImages.push({idiom:'universal',filename,scale});
  }
  await writeFile(path.join(splashDir,'Contents.json'),JSON.stringify({images:splashImages,info:{author:'xcode',version:1}},null,2));

  // Fill the native launch screen edge-to-edge while preserving the approved artwork.
  const launchPath=path.join(appRoot,'Base.lproj','LaunchScreen.storyboard');
  if(existsSync(launchPath)){
    let launch=await readFile(launchPath,'utf8');
    launch=launch.replaceAll('contentMode="scaleAspectFit"','contentMode="scaleAspectFill"');
    await writeFile(launchPath,launch);
  }
}

console.log('Hobah iOS native settings applied; approved 4K Ancient Canon loading screen installed with home page unchanged');
