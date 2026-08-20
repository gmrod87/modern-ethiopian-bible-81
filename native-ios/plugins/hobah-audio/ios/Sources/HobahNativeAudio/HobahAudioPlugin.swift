import Foundation
import Capacitor
import AVFoundation
import MediaPlayer

@objc(HobahAudioPlugin)
public class HobahAudioPlugin: CAPPlugin, CAPBridgedPlugin, AVAudioPlayerDelegate {
    public let identifier = "HobahAudioPlugin"
    public let jsName = "HobahAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCache", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVAudioPlayer?
    private var currentID = ""
    private var currentTitle = "Hobah"
    private var currentSubtitle = "The Ancient Canon"
    private var currentRate: Float = 1.0
    private var cache: [String: Data] = [:]
    private var cacheOrder: [String] = []
    private let cacheQueue = DispatchQueue(label: "com.hobah.audio.cache")
    private let apiURL = URL(string: "https://modern-ethiopian-bible-81.vercel.app/api/tts")!

    override public func load() {
        configureAudioSession()
        configureRemoteCommands()
    }

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [])
            try session.setActive(true)
        } catch {
            print("Hobah native audio session error: \(error)")
        }
    }

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.nextTrackCommand.isEnabled = true
        center.previousTrackCommand.isEnabled = true

        center.playCommand.addTarget { [weak self] _ in
            guard let self, let player = self.player else { return .commandFailed }
            player.play()
            self.updateNowPlaying(playing: true)
            self.notifyListeners("stateChange", data: ["playing": true])
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            guard let self, let player = self.player else { return .commandFailed }
            player.pause()
            self.updateNowPlaying(playing: false)
            self.notifyListeners("stateChange", data: ["playing": false])
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteNext", data: [:])
            return .success
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remotePrevious", data: [:])
            return .success
        }
    }

    private func normalizedRate(_ value: Double) -> Float {
        return Float(min(2.0, max(0.5, value)))
    }

    private func cacheData(_ data: Data, id: String) {
        cacheQueue.async { [weak self] in
            guard let self else { return }
            self.cache[id] = data
            self.cacheOrder.removeAll { $0 == id }
            self.cacheOrder.append(id)
            while self.cacheOrder.count > 14 {
                let old = self.cacheOrder.removeFirst()
                self.cache.removeValue(forKey: old)
            }
        }
    }

    private func cachedData(id: String) -> Data? {
        return cacheQueue.sync { cache[id] }
    }

    private func fetchAudio(id: String, text: String, mode: String, completion: @escaping (Result<Data, Error>) -> Void) {
        if let data = cachedData(id: id) {
            completion(.success(data))
            return
        }
        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "text": String(text.prefix(1800)),
                "voice": "marin",
                "mode": ["normal", "context", "advanced"].contains(mode) ? mode : "normal"
            ])
        } catch {
            completion(.failure(error))
            return
        }
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error {
                completion(.failure(error))
                return
            }
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode), let data, !data.isEmpty else {
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                completion(.failure(NSError(domain: "HobahAudio", code: status, userInfo: [NSLocalizedDescriptionKey: "Natural voice unavailable"])))
                return
            }
            self?.cacheData(data, id: id)
            completion(.success(data))
        }.resume()
    }

    @objc func prepare(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let text = call.getString("text"), !id.isEmpty, !text.isEmpty else {
            call.reject("Missing audio id or text")
            return
        }
        let mode = call.getString("mode") ?? "normal"
        if cachedData(id: id) != nil {
            call.resolve(["cached": true])
            return
        }
        fetchAudio(id: id, text: text, mode: mode) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    call.resolve(["cached": true])
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let text = call.getString("text"), !id.isEmpty, !text.isEmpty else {
            call.reject("Missing audio id or text")
            return
        }
        let mode = call.getString("mode") ?? "normal"
        let title = call.getString("title") ?? "Hobah"
        let subtitle = call.getString("subtitle") ?? "The Ancient Canon"
        let rate = normalizedRate(call.getDouble("rate") ?? 1.0)
        fetchAudio(id: id, text: text, mode: mode) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case .failure(let error):
                    call.reject(error.localizedDescription)
                case .success(let data):
                    do {
                        self.configureAudioSession()
                        self.player?.stop()
                        let player = try AVAudioPlayer(data: data)
                        player.delegate = self
                        player.enableRate = true
                        player.rate = rate
                        player.prepareToPlay()
                        self.player = player
                        self.currentID = id
                        self.currentTitle = title
                        self.currentSubtitle = subtitle
                        self.currentRate = rate
                        guard player.play() else {
                            call.reject("Unable to start native audio")
                            return
                        }
                        self.updateNowPlaying(playing: true)
                        self.notifyListeners("stateChange", data: ["playing": true, "id": id])
                        call.resolve(["duration": player.duration])
                    } catch {
                        call.reject(error.localizedDescription)
                    }
                }
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        player?.pause()
        updateNowPlaying(playing: false)
        notifyListeners("stateChange", data: ["playing": false, "id": currentID])
        call.resolve()
    }

    @objc func resume(_ call: CAPPluginCall) {
        guard let player else {
            call.reject("No native audio is loaded")
            return
        }
        configureAudioSession()
        player.play()
        updateNowPlaying(playing: true)
        notifyListeners("stateChange", data: ["playing": true, "id": currentID])
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        player?.stop()
        player = nil
        currentID = ""
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        notifyListeners("stateChange", data: ["playing": false])
        call.resolve()
    }

    @objc func setRate(_ call: CAPPluginCall) {
        currentRate = normalizedRate(call.getDouble("rate") ?? 1.0)
        if let player {
            player.enableRate = true
            player.rate = currentRate
            updateNowPlaying(playing: player.isPlaying)
        }
        call.resolve()
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve([
            "playing": player?.isPlaying ?? false,
            "currentTime": player?.currentTime ?? 0,
            "duration": player?.duration ?? 0,
            "id": currentID
        ])
    }

    @objc func clearCache(_ call: CAPPluginCall) {
        cacheQueue.async { [weak self] in
            self?.cache.removeAll()
            self?.cacheOrder.removeAll()
        }
        call.resolve()
    }

    private func updateNowPlaying(playing: Bool) {
        guard let player else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: currentTitle,
            MPMediaItemPropertyArtist: "Hobah",
            MPMediaItemPropertyAlbumTitle: currentSubtitle,
            MPMediaItemPropertyPlaybackDuration: player.duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: playing ? currentRate : 0.0
        ]
    }

    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        updateNowPlaying(playing: false)
        notifyListeners("stateChange", data: ["playing": false, "id": currentID])
        notifyListeners("ended", data: ["id": currentID, "success": flag])
    }
}
