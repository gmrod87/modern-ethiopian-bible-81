explainCurrent=async function(){
  if(!state.currentBook||!state.currentChapter){toast('Open a chapter first');return''}
  if(state.audio.studyBusy)return'';
  const v=currentAudioVerse(),ref=state.currentBook.title+' '+state.currentChapter.n+':'+v,displayQuestion='Explain '+ref;
  const requestQuestion='Explain '+ref+' in more detail. Focus on what is happening in this verse, its immediate literary context, and why it matters. Give a complete spoken explanation with no preamble. Aim for 220 to 270 words and never exceed 300 words. End with a complete sentence.';
  const resumeAfter=!!(state.audio.playing||VOICE90.resumeAfterVoicePause);VOICE90.resumeAfterVoicePause=false;
  state.audio.studyBusy=true;state.audio.resumeAfterStudy=resumeAfter;setStudyPhase('generating');VOICE90.phase='generating';voice90Status('Explaining '+ref+'…');state.studyMode='study';
  const answerPromise=requestVoiceExplanationJSON(requestQuestion,ref);
  try{
    await voice90SuspendForStudy();await voice90PauseScripture();
    const ans=await answerPromise;state.studyHistory.push({role:'user',text:displayQuestion},{role:'assistant',text:ans});rememberStudyAnswer(ans,displayQuestion,ref);
    await narrateStudyAnswer(ans,false);return ans;
  }catch(e){const cancelled=/cancelled/i.test(e?.message||'');console.warn('Voice90 explain',e);if(!cancelled){voice90Status('Study AI could not explain that');toast(e?.message||'Study AI unavailable')}return''}
  finally{
    state.audio.studyBusy=false;setStudyPhase('idle');VOICE90.phase='idle';
    if(state.audio.resumeAfterStudy){state.audio.resumeAfterStudy=false;await voice90ResumeScripture()}else state.audio.resumeAfterStudy=false;
    await voice90ResumeAfterStudy();
  }
};
readStudyAnswer=async function(text,button=null,index=null){
  text=clean(text);if(!text||state.audio.studyBusy)return;const resume=!!state.audio.playing;
  state.audio.studyBusy=true;state.audio.resumeAfterStudy=resume;state.audio.studyManualActive=true;state.audio.studyManualIndex=index;state.audio.studyManualButton=button;setStudyReadButton(button,'loading');
  try{await voice90SuspendForStudy();await voice90PauseScripture();await narrateStudyAnswer(text,false)}catch(e){console.warn('Voice90 manual Study read',e);toast('Read aloud was interrupted')}
  finally{setStudyReadButton(button,'play');state.audio.studyManualActive=false;state.audio.studyManualIndex=null;state.audio.studyManualButton=null;state.audio.studyBusy=false;if(state.audio.resumeAfterStudy){state.audio.resumeAfterStudy=false;await voice90ResumeScripture()}await voice90ResumeAfterStudy()}
};
toggleStudyTransport=async function(){
  if(!state.audio.studyBusy)return false;
  if(VOICE90.phase==='generating'){state.audio.studyCancelReason='user';try{VOICE90.studyAbort?.abort()}catch{}voice90Status('Returning to Scripture…');return true}
  if(VOICE90.phase==='speaking'){
    if(window.HobahNativeAudio)await window.HobahNativeAudio.pause({channel:'study'}).catch(()=>{});else try{state.audio.studyAudio?.pause()}catch{};VOICE90.phase='study-paused';setStudyPhase('paused');voice90Status('Study AI • paused');return true
  }
  if(VOICE90.phase==='study-paused'){
    if(window.HobahNativeAudio)await window.HobahNativeAudio.resume({channel:'study'}).catch(()=>{});else try{await state.audio.studyAudio?.play()}catch{};VOICE90.phase='speaking';setStudyPhase('speaking');voice90Status('Study AI • reading');return true
  }
  return true;
};
handleVoice=function(text,final){
  if(state.audio.suppressRecognition||!state.audio.voiceWanted)return;const kind=commandKind90(text);if(!kind){if(final)voice90Status(voiceReadyStatus());return}
  const now=Date.now();if(kind===VOICE90.lastKind&&now-VOICE90.lastAt<850)return;VOICE90.lastKind=kind;VOICE90.lastAt=now;
  if(kind==='explain'){explainCurrent();return}if(kind==='save'){saveStudyExplanation();return}if(kind==='pause'){voice90PauseCommand();return}if(kind==='play'){voice90PlayCommand();return}
  if(state.audio.studyBusy)return;if(kind==='next'){VOICE90.resumeAfterVoicePause=false;jumpNarration(1);return}if(kind==='prev'){VOICE90.resumeAfterVoicePause=false;jumpNarration(-1)}
};
startVoiceCommands=async function(){
  if(state.audio.voiceWanted&&state.listening)return;state.audio.voiceWanted=true;state.audio.suppressRecognition=false;syncAudioUI();
  try{await voice90StartRecognition({requestPermission:true})}catch(e){state.audio.voiceWanted=false;state.listening=false;localSet('hobah:voiceCommands','0');syncAudioUI();syncSettingsVoiceUI();voice90Status(e?.message||'Voice Commands could not start')}
};
stopVoiceCommands=async function({silent=false,preserveWanted=false}={}){await voice90StopRecognition({preserveWanted,silent});if(!preserveWanted){state.audio.suppressRecognition=false;state.audio.voiceWanted=false;state.listening=false;syncAudioUI();syncSettingsVoiceUI();if(!silent)voice90Status('Voice Commands off')}};
scheduleListenVoiceRestart=voice90ScheduleRestart;
suspendRecognitionForStudy=function(){state.audio.voiceWasListening=!!(state.audio.voiceWanted||state.listening);state.audio.suppressRecognition=true;state.listening=false;syncAudioUI();voice90StopRecognition({preserveWanted:true,silent:true}).catch(()=>{})};
resumeRecognitionAfterStudy=function(){state.audio.suppressRecognition=false;voice90ResumeAfterStudy().catch(()=>{})};
ensurePersistentVoice=async function(){
  if(!voice90Enabled()){if(state.audio.voiceWanted||state.listening)await stopVoiceCommands({silent:true});syncSettingsVoiceUI();return}
  state.audio.voiceWanted=true;if(state.audio.studyBusy||state.audio.suppressRecognition)return;
  if(state.listening){syncSettingsVoiceUI();return}
  try{await voice90StartRecognition({requestPermission:false})}catch(e){console.warn('Voice90 persistent start',e);voice90ScheduleRestart()}
};
setPersistentVoiceEnabled=async function(on){localSet('hobah:voiceCommands',on?'1':'0');Promise.resolve(window.HobahNative?.savePreferences?.()).catch(()=>{});if(on){state.audio.voiceWanted=true;state.audio.suppressRecognition=false;await voice90StartRecognition({requestPermission:true})}else await stopVoiceCommands({silent:true});syncSettingsVoiceUI()};