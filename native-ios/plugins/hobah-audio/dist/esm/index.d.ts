import type { PluginListenerHandle } from '@capacitor/core';
export interface HobahAudioItem { id:string; text:string; mode?:'normal'|'context'|'advanced'; title?:string; subtitle?:string; rate?:number }
export interface HobahAudioPlugin {
  prepare(options:HobahAudioItem):Promise<{cached:boolean}>;
  play(options:HobahAudioItem):Promise<{duration:number}>;
  pause():Promise<void>;
  resume():Promise<void>;
  stop():Promise<void>;
  setRate(options:{rate:number}):Promise<void>;
  getState():Promise<{playing:boolean;currentTime:number;duration:number;id:string}>;
  clearCache():Promise<void>;
  addListener(eventName:'ended'|'remoteNext'|'remotePrevious'|'stateChange',listenerFunc:(event:any)=>void):Promise<PluginListenerHandle>;
}
export interface HobahVoicePlugin {
  requestPermissions():Promise<{speech:string;microphone:string}>;
  start(options?:{locale?:string}):Promise<void>;
  stop():Promise<void>;
  getState():Promise<{listening:boolean;available:boolean}>;
  addListener(eventName:'transcript'|'stateChange',listenerFunc:(event:any)=>void):Promise<PluginListenerHandle>;
}
export declare const HobahAudio:HobahAudioPlugin;
export declare const HobahVoice:HobahVoicePlugin;
