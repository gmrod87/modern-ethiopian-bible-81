# Hobah App Store Release Checklist

Status snapshot: 25 August 2026

## Automated code and native checks — verified

- [x] Single Hobah web runtime with current Read / Search / Study / Listen / Library features.
- [x] Capacitor iOS shell isolated from Vercel dependencies.
- [x] All 81 book files included in the native `www` bundle for offline reading.
- [x] Whole-Bible search corpora included in the native bundle.
- [x] Bundled Ancient Library is included in the native app; Book of Giants is present as 13 fragment sections and remains outside the 81-book canon.
- [x] Ancient Library read-aloud continuation is guarded so a finished section advances within the same work instead of falling into Genesis.
- [x] Study AI and TTS call production HTTPS APIs; the OpenAI API key remains server-side.
- [x] Native Preferences backup for bookmarks, notes, study notes, reading position and reader/audio preferences.
- [x] Native iOS Share integration.
- [x] Native haptics.
- [x] Safe-area / status-bar handling.
- [x] Offline-state UI.
- [x] Background spoken-audio capability and AVAudioSession configuration.
- [x] Lock-screen Media Session handlers for play, pause, previous and next.
- [x] `hobah://` deep links for Shortcuts/Siri workflows.
- [x] Microphone and speech-recognition usage descriptions.
- [x] App icon and launch-surface generation.
- [x] Public Privacy Policy and Support pages return HTTP 200 in production.
- [x] Production Study AI health check returns ready in the production environment.
- [x] Production TTS health check returns ready.
- [x] Native doctor passes in CI after dependencies and Capacitor sync.
- [x] Native-bundle validation passes.
- [x] iPhone/iPad Simulator app compiles successfully with Xcode 26.
- [x] Compiled app contains valid `PrivacyInfo.xcprivacy` files for the embedded Capacitor and Cordova frameworks.
- [x] Compiled Info.plist includes microphone/speech descriptions, background audio, `hobah` URL scheme and `ITSAppUsesNonExemptEncryption=false`.
- [x] Compiled app supports iPhone and iPad and has minimum iOS version 15.0.
- [x] `UIApplicationExitsOnSuspend` is removed from the shipping Info.plist.

## Apple account, signing and binary — verified by Build 55

- [x] Apple distribution certificate, App Store provisioning profile, App Store Connect API key and team credentials are valid in the release workflow.
- [x] Bundle identifier is `com.hobah.bible` and signs successfully for App Store distribution.
- [x] Release build uses Xcode 26, satisfying Apple's current iOS/iPadOS 26 SDK upload requirement.
- [x] Release archive exports successfully as an App Store Connect IPA.
- [x] Build 55 uploaded to App Store Connect/TestFlight successfully with no upload errors.
- [x] Latest corresponding native-bundle validation and iPhone/iPad simulator compilation passed.

## Privacy / data handling — verified or documented

- [x] Local Library data has no Hobah account/cloud-sync system.
- [x] Study AI uses `store:false` on the OpenAI Responses request.
- [x] Current Hobah API source does not intentionally log Study AI question bodies, Scripture/Ancient context bodies or narration text.
- [x] Production runtime-log spot check showed technical platform warnings only, not request-body logging.
- [x] Privacy Policy now states that online Study AI / TTS content is processed by OpenAI and that API content may be retained for up to 30 days where applicable unless Zero Data Retention applies.
- [x] Privacy Policy states no advertising SDKs, sale of personal information or cross-app tracking.
- [ ] In App Store Connect, complete the App Privacy questionnaire conservatively; use `APP_STORE_METADATA.md` as the working disclosure notes and make the final answers match the actual OpenAI/Vercel account configuration on submission day.
- [ ] Generate/review Xcode's privacy report in Organizer before final submission and resolve any warning Apple surfaces during processing.

## Real-device regression — still requires a human/device pass

These cannot be truthfully completed from CI alone and should be tested on the exact TestFlight release candidate:

- [ ] Physical iPhone: cold launch, home, Books, reader, Ancient Library, search, Library and About.
- [ ] Physical iPad: same core navigation plus rotation/multitasking layout.
- [ ] At least 30 minutes of continuous Scripture narration with the screen locked.
- [ ] Book of Giants: start Read Aloud before the end of a fragment and confirm it advances to the next fragment, then stops after the final fragment without entering Genesis.
- [ ] Voice Study repeatedly: pause → “explain that” → spoken answer → resume reading.
- [ ] Study AI Play/Pause/Save repeatedly on Wi-Fi and cellular.
- [ ] Airplane Mode: Bible reading, bundled Ancient Library reading, local search and Library remain usable.
- [ ] Relaunch after force-quit: exact reading position and Library survive termination.
- [ ] Dynamic Type / Larger Text, VoiceOver, Voice Control and Reduced Motion.
- [ ] Dark appearance: system permission sheets/status controls remain legible even though Hobah retains a light reading theme.

## App Store Connect fields — manual UI completion required

- [x] Name, subtitle, description, keywords, categories, URLs and review-note draft are prepared in `APP_STORE_METADATA.md`.
- [x] Support URL is live.
- [x] Privacy Policy URL is live.
- [ ] Upload final App Store screenshots from the release candidate.
- [ ] Enter copyright / seller information.
- [ ] Complete the current Apple age-rating questionnaire based on actual biblical/Ancient Library violence, sexual references, mature themes and weapons; do not default to the lowest rating.
- [ ] Complete accessibility information requested by the current App Store Connect UI.
- [ ] Complete App Privacy answers.
- [ ] Select the final processed build for version 1.0.0.
- [ ] Add release notes / promotional text as desired.
- [ ] Choose manual release or automatic release after approval.
- [ ] Submit version 1.0.0 for App Review.

## Final review preflight

- [x] No account or login is required for core functionality.
- [x] Backend services used for Study AI and TTS are live and production-configured.
- [x] Privacy and Support links are live publicly.
- [x] Review Notes explain offline functionality, online AI/TTS requirements, microphone permission and the fragmentary status of Book of Giants.
- [x] App provides native value beyond a repackaged website: bundled offline content, native storage, haptics, share, background audio, lock-screen controls, deep links, native voice recognition and device persistence.
- [ ] Final TestFlight real-device pass completed on the exact build selected for review.
- [ ] App Store Connect shows no processing warnings, missing compliance fields or unresolved submission errors.

## Release decision

From the repository, CI, signed archive and backend perspective, Hobah is release-candidate ready. The remaining blockers are App Store Connect form completion, screenshots and a final physical-device TestFlight regression. Do not mark those complete without actually performing them.
