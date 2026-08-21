import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'node_modules','@capgo','capacitor-speech-recognition','ios','Sources','SpeechRecognitionPlugin','SpeechRecognitionPlugin.swift');
let src=await readFile(target,'utf8');

const oldSession=`    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, options: [.defaultToSpeaker, .duckOthers])
        try session.setMode(.measurement)
        try session.setActive(true, options: .notifyOthersOnDeactivation)
    }`;
const newSession=`    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        // Hobah must hear the user while Scripture is playing through the speaker.
        // Voice-chat mode keeps simultaneous input/output on one session and enables
        // the voice-processing path used for acoustic echo cancellation.
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker])
        try session.setActive(true, options: .notifyOthersOnDeactivation)
    }`;
if(!src.includes(oldSession))throw new Error('Capgo speech audio-session block changed; refusing an unverified patch');
src=src.replace(oldSession,newSession);

const oldInput=`        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)`;
const newInput=`        let inputNode = audioEngine.inputNode
        // Enable voice processing on both I/O nodes before reading the hardware
        // format. This is the Apple-supported AEC path for simultaneous playback
        // and microphone capture and prevents Hobah's narrator dominating ASR.
        if #available(iOS 13.0, *) {
            try? inputNode.setVoiceProcessingEnabled(true)
            try? audioEngine.outputNode.setVoiceProcessingEnabled(true)
        }
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)`;
if(!src.includes(oldInput))throw new Error('Capgo speech input block changed; refusing an unverified patch');
src=src.replace(oldInput,newInput);

await writeFile(target,src);
console.log('Hobah speech engine patched: playAndRecord/voiceChat + input/output voice processing');
