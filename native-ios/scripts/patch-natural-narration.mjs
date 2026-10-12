import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../www/app.js', import.meta.url);
let app = await readFile(appPath, 'utf8');
const replace = (from, to) => {
  if (!app.includes(from)) throw new Error('Natural narration patch missing: ' + from.slice(0, 100));
  app = app.replace(from, to);
};

// A stopped or superseded download must never restore the playing UI.
replace('async function playNarrationItem(){', 'let nativeNarrationSerial=0;\nasync function playNarrationItem(){');
replace("    setAudioStatus('Preparing native voice…');setAudioPlay('…');", "    const request=++nativeNarrationSerial;state.audio.preparing=true;\n    setAudioStatus(window.HobahNativeAudio.onDevice?'Preparing device voice…':'Preparing natural voice…');setAudioPlay('…');");
replace('      await Promise.resolve(window.HobahNativeAudioReady);', '      await Promise.resolve(window.HobahNativeAudioReady);\n      if(request!==nativeNarrationSerial||state.audio.stopped)return;');
replace('      await window.HobahNativeAudio.play({text:item.text,mode,title,subtitle,rate});', '      await window.HobahNativeAudio.play({text:item.text,mode,title,subtitle,rate});\n      if(request!==nativeNarrationSerial||state.audio.stopped)return;state.audio.preparing=false;');
replace("}catch(e){console.warn('Native Scripture audio',e);", "}catch(e){if(request!==nativeNarrationSerial||e?.code==='NARRATION_CANCELLED')return;state.audio.preparing=false;console.warn('Native Scripture audio',e);");
replace('function pauseNarration(){if(window.HobahNativeAudio){', 'function pauseNarration(){if(window.HobahNativeAudio){++nativeNarrationSerial;state.audio.preparing=false;');
replace('function stopNarration(){\n', 'function stopNarration(){\n  ++nativeNarrationSerial;state.audio.preparing=false;\n');
replace('if(window.HobahNativeAudio){if(state.audio.playing)pauseNarration();', 'if(window.HobahNativeAudio){if(state.audio.playing||state.audio.preparing)pauseNarration();');
replace('const wasPlaying=!!state.audio.playing,wasPaused=!!state.audio.paused;', 'const wasPlaying=!!(state.audio.playing||state.audio.preparing),wasPaused=!!state.audio.paused;');
replace('window.HobahNativeAudio.prepare({text:part,mode:\'normal\'})', 'window.HobahNativeAudio.prepare({text:part,mode:\'normal\',channel:\'study\'})');
// Natural Study narration must not silently become browser/device speech either.
replace("catch(e){console.warn('Voice90 native Study narration',e);const ok=await voice90BrowserSpeak(part);if(!ok)throw e}", "catch(e){console.warn('Voice90 native Study narration',e);throw e}");
replace("if(e.detail?.channel==='study')return;if(window.HobahNativeAudio&&!state.audio.stopped&&!state.audio.studyBusy)advanceNarration()", "if(e.detail?.channel==='study')return;if(e.detail?.success===false){state.audio.playing=false;state.audio.paused=false;setAudioStatus('Audio interrupted. Tap Play to retry.');setAudioPlay('▶');return}if(window.HobahNativeAudio&&!state.audio.stopped&&!state.audio.studyBusy)advanceNarration()");

const engineListener = `document.addEventListener('hobah:narration-engine-changed',()=>{
  ++nativeNarrationSerial;state.audio.preparing=false;state.audio.playing=false;
  state.audio.paused=!!state.audio.items.length;syncAudioUI();setAudioPlay('▶');
  setAudioStatus(window.HobahNativeAudio.onDevice?'Device voice selected':'Natural voices selected');
});\n`;
// Register inside the reader IIFE so this handler shares its playback state.
replace('bindAudio();\n', engineListener + 'bindAudio();\n');
await writeFile(appPath, app);
console.log('Natural narration: cancellation, narrator switching, and explicit device choice applied');
