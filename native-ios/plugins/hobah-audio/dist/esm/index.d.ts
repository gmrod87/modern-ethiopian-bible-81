import type { PluginListenerHandle } from '@capacitor/core';
export type HobahAudioChannel='scripture'|'study';
export interface HobahAudioItem { id:string; text:string; mode?:'normal'|'context'|'advanced'; title?:string; subtitle?:string; rate?:number; forcePlayback?:boolean; channel?:HobahAudioChannel }
export interface HobahAudioChannelOptions { channel?:HobahAudioChannel }
export interface HobahAudioPlugin {
  prepare(options:HobahAudioItem):Promise<{cached:boolean}>;
  play(options:HobahAudioItem):Promise<{duration:number;channel?:HobahAudioChannel}>;
  pause(options?:HobahAudioChannelOptions):Promise<void>;
  resume(options?:HobahAudioChannelOptions):Promise<void>;
  stop(options?:HobahAudioChannelOptions):Promise<void>;
  setRate(options:{rate:number;channel?:HobahAudioChannel}):Promise<void>;
  getState(options?:HobahAudioChannelOptions):Promise<{playing:boolean;currentTime:number;duration:number;id:string;channel?:HobahAudioChannel}>;
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
