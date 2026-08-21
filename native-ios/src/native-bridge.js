import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { TextZoom } from '@capacitor/text-zoom';

const API_BASE='https://modern-ethiopian-bible-81.vercel.app';
const PUBLIC_BASE='https://modern-ethiopian-bible-81.vercel.app';
const PREFERENCE_KEYS=[
  'hobah:user','hobah:last','hobah:readerSize','hobah:audioMode','hobah:audioRate','hobah:ambient','hobah:audioProgress','hobah:nativePosition','hobah:voiceCommands','hobah:nightMode'
];

window.HOBAH_API_BASE=API_BASE;
window.HOBAH_NATIVE=true;
window.HOBAH_NETWORK_CONNECTED=true;

function webURL(url=''){
  if(!url)return PUBLIC_BASE;
  if(/^https?:/i.test(url))return url;
  if(url.startsWith('#'))return `${PUBLIC_BASE}/?v=85${url}`;
  try{
    const u=new URL(url,location.href);
    return `${PUBLIC_BASE}${u.pathname}${u.search}${u.hash}`;
  }catch{return PUBLIC_BASE}
}

async function nativeShare({title='Hobah',text='',url=''}){
  const safeURL=webURL(url||location.hash);
  try{
    await Haptics.impact({style:ImpactStyle.Light});
    await Share.share({title,text,url:safeURL,dialogTitle:'Share from Hobah'});
    return true;
  }catch(e){
    try{if(navigator.share){await navigator.share({title,text,url:safeURL});return true}}catch{}
    return false;
  }
}

async function savePreferences(){
  for(const key of PREFERENCE_KEYS){
    try{
      const value=localStorage.getItem(key);
      if(value===null)await Preferences.remove({key});
      else await Preferences.set({key,value});
    }catch{}
  }
}

async function restorePreferences(){
  for(const key of PREFERENCE_KEYS){
    try{
      if(localStorage.getItem(key)!==null)continue;
      const {value}=await Preferences.get({key});
      if(value!==null)localStorage.setItem(key,value);
    }catch{}
  }
}

async function applyPreferredTextZoom(){
  try{
    const {value}=await TextZoom.getPreferred();
    if(Number.isFinite(value))await TextZoom.set({value:Math.min(1.6,Math.max(.85,value))});
  }catch{}
}

async function applyNativeNightMode(on){
  try{await StatusBar.setStyle({style:on?Style.Light:Style.Dark})}catch{}
  try{await StatusBar.setBackgroundColor({color:on?'#0C1411':'#F3EFE5'})}catch{}
  try{await StatusBar.setOverlaysWebView({overlay:false})}catch{}
}

let scrollTimer=0;
function saveReadingPosition(){
  const hash=location.hash||'#home';
  if(!hash.startsWith('#read/'))return;
  const payload=JSON.stringify({hash,y:Math.max(0,Math.round(scrollY)),updated:Date.now()});
  try{localStorage.setItem('hobah:nativePosition',payload)}catch{}
  clearTimeout(scrollTimer);
  scrollTimer=setTimeout(()=>Preferences.set({key:'hobah:nativePosition',value:payload}).catch(()=>{}),140);
}

async function restoreReadingPosition(){
  if(!(location.hash||'').startsWith('#read/'))return;
  let raw='';
  try{raw=localStorage.getItem('hobah:nativePosition')||''}catch{}
  if(!raw){try{raw=(await Preferences.get({key:'hobah:nativePosition'})).value||''}catch{}}
  if(!raw)return;
  try{
    const p=JSON.parse(raw);
    if(p.hash!==location.hash||!Number.isFinite(p.y)||p.y<20)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTo({top:p.y,behavior:'instant'})));
  }catch{}
}

function setOfflineUI(connected){
  window.HOBAH_NETWORK_CONNECTED=!!connected;
  document.body.classList.toggle('nativeOffline',!connected);
  let el=document.getElementById('nativeOfflineBanner');
  if(!el){
    el=document.createElement('div');
    el.id='nativeOfflineBanner';
    el.className='nativeOfflineBanner';
    el.textContent='Offline • Bible, search and Library remain available';
    document.body.appendChild(el);
  }
  el.hidden=!!connected;
}

function bindMediaSession(){
  if(!('mediaSession' in navigator))return;
  const click=id=>()=>document.getElementById(id)?.click();
  for(const [action,id] of [['play','audioPlay'],['pause','audioPlay'],['previoustrack','audioPrev'],['nexttrack','audioNext']]){
    try{navigator.mediaSession.setActionHandler(action,click(id))}catch{}
  }
  const update=()=>{
    try{
      const ref=document.getElementById('audioRef')?.textContent?.trim()||'Hobah';
      const status=document.getElementById('audioState')?.textContent?.trim()||'The Ancient Canon';
      navigator.mediaSession.metadata=new MediaMetadata({title:ref,artist:'Hobah',album:status,artwork:[{src:`${PUBLIC_BASE}/hobah-icon-180-v52.png`,sizes:'180x180',type:'image/png'}]});
    }catch{}
  };
  document.addEventListener('play',()=>{try{navigator.mediaSession.playbackState='playing'}catch{}update()},{capture:true});
  document.addEventListener('pause',()=>{try{navigator.mediaSession.playbackState='paused'}catch{}update()},{capture:true});
  document.addEventListener('hobah:chapter',update);
}

function mapDeepLink(url){
  try{
    const u=new URL(url);if(u.protocol!=='hobah:')return null;
    const host=(u.host||'').toLowerCase(),path=u.pathname.replace(/^\/+|\/+$/g,'');
    if(host==='home')return {hash:'#home'};if(host==='study')return {hash:'#home',study:true};if(host==='read')return {hash:'#read/'+path};if(host==='search')return {hash:'#search/'+encodeURIComponent(path||u.searchParams.get('q')||'')};return {hash:'#home'};
  }catch{return null}
}

function openAbout(){
  let d=document.getElementById('nativeAbout');
  if(!d){
    d=document.createElement('dialog');d.id='nativeAbout';d.className='nativeAbout';
    d.innerHTML=`<div class="nativeAboutCard"><button class="nativeAboutClose" aria-label="Close">×</button><span>HOBAH • 81 BOOKS</span><h2>The Ancient Canon</h2><p>Offline Bible reading and search, Study AI, natural Read Aloud, hands-free Voice Study and a private on-device Library.</p><button data-native-link="${PUBLIC_BASE}/privacy.html">Privacy Policy</button><button data-native-link="${PUBLIC_BASE}/support.html">Support</button><small>Native iPhone/iPad edition</small></div>`;
    document.body.appendChild(d);d.querySelector('.nativeAboutClose').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d)d.close()});d.querySelectorAll('[data-native-link]').forEach(b=>b.onclick=()=>Browser.open({url:b.dataset.nativeLink}));
  }
  d.showModal();
}

function bindNativeUI(){
  document.addEventListener('click',e=>{
    const button=e.target.closest('button,a');if(!button)return;
    const stronger=button.matches('[data-study-save],#savedBtn,#saveChapter,#savePersonalNote');
    Haptics.impact({style:stronger?ImpactStyle.Medium:ImpactStyle.Light}).catch(()=>{});
  },{capture:true,passive:true});
}

async function boot(){
  if(!Capacitor.isNativePlatform())return;
  await restorePreferences();
  await applyPreferredTextZoom();
  await applyNativeNightMode(localStorage.getItem('hobah:nightMode')==='1');
  const network=await Network.getStatus().catch(()=>({connected:true}));setOfflineUI(network.connected);
  Network.addListener('networkStatusChange',s=>setOfflineUI(s.connected));
  App.addListener('appStateChange',async({isActive})=>{
    document.dispatchEvent(new CustomEvent('hobah:native-app-state',{detail:{isActive}}));
    if(!isActive){saveReadingPosition();await savePreferences()}
  });
  App.addListener('appUrlOpen',({url})=>{const target=mapDeepLink(url);if(!target)return;location.hash=target.hash;if(target.study)setTimeout(()=>document.getElementById('studyAiHeaderBtn')?.click(),350)});
  addEventListener('scroll',saveReadingPosition,{passive:true});
  addEventListener('pagehide',()=>{saveReadingPosition();savePreferences()},{passive:true});
  document.addEventListener('hobah:chapter',()=>setTimeout(restoreReadingPosition,80));
  bindNativeUI();bindMediaSession();setTimeout(()=>SplashScreen.hide().catch(()=>{}),180);
}

window.HobahNative={
  isNative:()=>Capacitor.isNativePlatform(),
  share:nativeShare,
  haptic:()=>Haptics.impact({style:ImpactStyle.Light}),
  openExternal:url=>Browser.open({url:webURL(url)}),
  openAbout,
  savePreferences,
  setNightMode:applyNativeNightMode,
  applyPreferredTextZoom,
  isOnline:()=>window.HOBAH_NETWORK_CONNECTED!==false,
  apiBase:API_BASE
};
window.HobahNativeReady=boot();
