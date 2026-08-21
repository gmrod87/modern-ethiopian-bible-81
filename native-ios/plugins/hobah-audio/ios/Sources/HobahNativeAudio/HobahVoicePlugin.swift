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
    private var restartPending = false
    private var localeID = "en-AU"
    private var lastTranscript = ""
    private var transcriptRevision = 0
    private var lastCommand = ""
    private var commandRevision = 0
    private var lastCommandAt = Date.distantPast

    private let commandPhrases: [(kind: String, phrase: String)] = [
        ("explain", "explain that in more detail"), ("explain", "explain this in more detail"),
        ("explain", "what does that mean"), ("explain", "explain that more"),
        ("explain", "explain this more"), ("explain", "explain that"),
        ("explain", "explain this"), ("explain", "tell me more"), ("explain", "go deeper"),
        ("save", "save that to my notes"), ("save", "save this to my notes"),
        ("save", "save this in my notes"), ("save", "save that in my notes"),
        ("save", "save this explanation"), ("save", "save that explanation"),
        ("save", "save to my notes"), ("save", "save that"), ("save", "save this"), ("save", "save it"),
        ("pause", "stop reading"), ("pause", "pause reading"), ("pause", "hold on"),
        ("pause", "stop"), ("pause", "pause"),
        ("play", "keep reading"), ("play", "continue reading"), ("play", "carry on"),
        ("play", "continue"), ("play", "resume"), ("play", "play"),
        ("next", "next verse"), ("next", "next section"), ("next", "go next"), ("next", "next"),
        ("prev", "previous verse"), ("prev", "go previous"), ("prev", "go back"),
        ("prev", "previous"), ("prev", "back")
    ]

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

    private func normalizedSpeech(_ text: String) -> String {
        return text.lowercased()
            .replacingOccurrences(of: "[^a-z\\s']", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func commandFromTranscript(_ text: String) -> (kind: String, phrase: String)? {
        var value = normalizedSpeech(text)
        guard !value.isEmpty else { return nil }
        value = value
            .replacingOccurrences(of: "\\b(?:hey\\s+)?(?:hobah|hoba|ho bah|oba)\\b", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("please ") { value = String(value.dropFirst(7)) }
        if value.hasSuffix(" please") { value = String(value.dropLast(7)) }
        for item in commandPhrases {
            if value == item.phrase || value.hasSuffix(" " + item.phrase) { return item }
        }
        return nil
    }

    private func publishRecognition(text: String, tail: String, isFinal: Bool) {
        lastTranscript = text
        transcriptRevision += 1
        notifyListeners("transcript", data: [
            "text": text,
            "tail": tail,
            "final": isFinal,
            "revision": transcriptRevision
        ])

        guard let command = commandFromTranscript(tail) ?? commandFromTranscript(text) else { return }
        let now = Date()
        if command.phrase == lastCommand && now.timeIntervalSince(lastCommandAt) < 0.65 { return }
        lastCommand = command.phrase
        lastCommandAt = now
        commandRevision += 1
        notifyListeners("command", data: [
            "command": command.phrase,
            "kind": command.kind,
            "revision": commandRevision
        ])
    }

    private func restartIfNeeded() {
        guard wantsListening, !restartPending else { return }
        restartPending = true
        stopEngine(restorePlayback: false)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { [weak self] in
            guard let self else { return }
            self.restartPending = false
            guard self.wantsListening else { return }
            do {
                try self.beginRecognition()
            } catch {
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
        req.taskHint = .search
        req.contextualStrings = [
            "Hobah", "Hey Hobah", "explain that", "explain this", "explain that in more detail",
            "what does that mean", "tell me more", "go deeper", "save that", "save this",
            "stop", "pause", "stop reading", "continue", "resume", "keep reading",
            "next verse", "previous verse", "go back"
        ]
        request = req

        let input = engine.inputNode
        if #available(iOS 13.0, *) {
            try? input.setVoiceProcessingEnabled(true)
        }
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak req] buffer, _ in
            req?.append(buffer)
        }
        tapInstalled = true

        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let transcription = result.bestTranscription
                let text = transcription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                let tail = transcription.segments.suffix(8).map { $0.substring }.joined(separator: " ")
                if !text.isEmpty {
                    DispatchQueue.main.async {
                        self.publishRecognition(text: text, tail: tail, isFinal: result.isFinal)
                    }
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
        restartPending = false
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
        restartPending = false
        stopEngine(restorePlayback: true)
        notifyListeners("stateChange", data: ["listening": false])
        call.resolve()
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve([
            "listening": wantsListening && engine.isRunning,
            "available": recognizer?.isAvailable ?? false,
            "speechPermission": speechState(),
            "microphonePermission": microphoneState(),
            "transcript": lastTranscript,
            "transcriptRevision": transcriptRevision,
            "command": lastCommand,
            "commandRevision": commandRevision
        ])
    }
}
