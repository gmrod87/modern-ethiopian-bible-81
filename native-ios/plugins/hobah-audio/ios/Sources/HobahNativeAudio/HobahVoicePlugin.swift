import Foundation
import Capacitor
import AVFoundation
import Speech

@objc(HobahVoicePlugin)
public class HobahVoicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HobahVoicePlugin"
    public let jsName = "HobahVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise)
    ]

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var recognizer: SFSpeechRecognizer?
    private var wantsListening = false
    private var tapInstalled = false
    private var localeID = "en-AU"

    override public func load() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeID))
    }

    private func speechState() -> String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return "granted"
        case .denied, .restricted: return "denied"
        case .notDetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }

    private func microphoneState() -> String {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: return "granted"
        case .denied: return "denied"
        case .undetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        let group = DispatchGroup()
        group.enter()
        SFSpeechRecognizer.requestAuthorization { _ in group.leave() }
        group.enter()
        AVAudioSession.sharedInstance().requestRecordPermission { _ in group.leave() }
        group.notify(queue: .main) { [weak self] in
            guard let self else { return }
            call.resolve(["speech": self.speechState(), "microphone": self.microphoneState()])
        }
    }

    private func ensurePermissions(_ completion: @escaping (Bool) -> Void) {
        if speechState() == "granted" && microphoneState() == "granted" {
            completion(true)
            return
        }
        let group = DispatchGroup()
        if SFSpeechRecognizer.authorizationStatus() == .notDetermined {
            group.enter()
            SFSpeechRecognizer.requestAuthorization { _ in group.leave() }
        }
        if AVAudioSession.sharedInstance().recordPermission == .undetermined {
            group.enter()
            AVAudioSession.sharedInstance().requestRecordPermission { _ in group.leave() }
        }
        group.notify(queue: .main) { [weak self] in
            guard let self else { completion(false); return }
            completion(self.speechState() == "granted" && self.microphoneState() == "granted")
        }
    }

    private func configureListeningSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
        try session.setActive(true, options: [])
    }

    private func restorePlaybackSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [])
            try session.setActive(true, options: [])
        } catch {
            print("Hobah voice playback-session restore error: \(error)")
        }
    }

    private func stopEngine(restorePlayback: Bool) {
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil
        if engine.isRunning { engine.stop() }
        if tapInstalled {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        if restorePlayback { restorePlaybackSession() }
    }

    private func restartIfNeeded() {
        guard wantsListening else { return }
        stopEngine(restorePlayback: false)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { [weak self] in
            guard let self, self.wantsListening else { return }
            do { try self.beginRecognition() }
            catch {
                self.wantsListening = false
                self.restorePlaybackSession()
                self.notifyListeners("stateChange", data: ["listening": false, "error": error.localizedDescription])
            }
        }
    }

    private func beginRecognition() throws {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeID))
        guard let recognizer, recognizer.isAvailable else {
            throw NSError(domain: "HobahVoice", code: 1, userInfo: [NSLocalizedDescriptionKey: "Speech recognition is temporarily unavailable"])
        }
        try configureListeningSession()
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.taskHint = .dictation
        request = req

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak req] buffer, _ in
            req?.append(buffer)
        }
        tapInstalled = true

        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty {
                    self.notifyListeners("transcript", data: ["text": text, "final": result.isFinal])
                }
                if result.isFinal {
                    DispatchQueue.main.async { self.restartIfNeeded() }
                    return
                }
            }
            if error != nil {
                DispatchQueue.main.async { self.restartIfNeeded() }
            }
        }
        engine.prepare()
        try engine.start()
        notifyListeners("stateChange", data: ["listening": true])
    }

    @objc func start(_ call: CAPPluginCall) {
        localeID = call.getString("locale") ?? "en-AU"
        wantsListening = true
        ensurePermissions { [weak self] granted in
            guard let self else { return }
            guard granted else {
                self.wantsListening = false
                call.reject("Microphone and Speech Recognition permission are required for Voice Commands")
                return
            }
            self.stopEngine(restorePlayback: false)
            do {
                try self.beginRecognition()
                call.resolve()
            } catch {
                self.wantsListening = false
                self.restorePlaybackSession()
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        wantsListening = false
        stopEngine(restorePlayback: true)
        notifyListeners("stateChange", data: ["listening": false])
        call.resolve()
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve([
            "listening": wantsListening && engine.isRunning,
            "available": recognizer?.isAvailable ?? false
        ])
    }
}
