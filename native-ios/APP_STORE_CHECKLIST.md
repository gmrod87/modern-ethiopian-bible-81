# Hobah App Store / TestFlight Checklist

## Code and stability

- [x] Single Hobah web runtime with current Read / Search / Study / Listen / Library features.
- [x] Capacitor iOS shell isolated from Vercel dependencies.
- [x] All 81 book files included in the native `www` bundle for offline reading.
- [x] Whole-Bible compressed search corpora included in the native bundle.
- [x] Study AI and TTS call the production HTTPS API; the OpenAI API key remains server-side.
- [x] Native Preferences backup for bookmarks, notes, study notes, reading position and reader/audio preferences.
- [x] Native iOS Share integration.
- [x] Native haptics.
- [x] Safe-area / status-bar handling.
- [x] Offline-state UI.
- [x] Background spoken-audio capability and AVAudioSession configuration.
- [x] Lock-screen Media Session handlers for play, pause, previous and next.
- [x] `hobah://` deep links for Shortcuts/Siri workflows.
- [x] Microphone and speech-recognition usage descriptions.
- [x] App icon and splash-screen sources plus generation script.
- [x] Public Privacy Policy and Support pages.
- [ ] Run the final native doctor after dependencies are installed on macOS.
- [ ] Test every feature on a physical iPhone and iPad.
- [ ] Test at least 30 minutes of continuous Scripture narration with the screen locked.
- [ ] Test Voice Study repeatedly: pause → explain that → answer → resume Scripture.
- [ ] Test Study AI Play/Pause/Save repeatedly on Wi-Fi and cellular.
- [ ] Test Airplane Mode: reading, search and Library must remain usable.
- [ ] Test app relaunch: exact reading position and Library must survive termination.
- [ ] Test Dynamic Type / Larger Text, VoiceOver, Voice Control and reduced motion.
- [ ] Test dark appearance even if Hobah intentionally retains a light reading theme; ensure system sheets and status controls remain legible.

## Apple account and signing

- [ ] Apple Developer Program membership active.
- [ ] Register bundle identifier `com.hobah.bible` (or change it before the first App Store record if unavailable).
- [ ] Select the correct Apple Developer Team in Xcode Signing & Capabilities.
- [ ] Confirm iPhone and iPad deployment targets supported by current Capacitor 8 / Xcode tooling.
- [ ] Create the app record in App Store Connect before final archive upload.

## App Store metadata

- [x] Draft name, subtitle, description, keywords and review notes in `APP_STORE_METADATA.md`.
- [x] Working Support URL.
- [x] Working Privacy Policy URL.
- [ ] Capture final screenshots from the release build.
- [ ] Enter copyright / seller information in App Store Connect.
- [ ] Complete the current App Store age-rating questionnaire. Biblical violence, sexual references and mature themes should be answered based on actual content rather than choosing the lowest rating by default.
- [ ] Complete accessibility nutrition-label information requested by the current App Store Connect UI.

## App Privacy / data disclosure

Do not select “Data Not Collected” without reviewing the final production data flow.

Hobah itself stores the user Library locally and has no account system. However, when online features are used, Study AI questions / passage context and TTS text are transmitted through Hobah's Vercel endpoints to OpenAI services. App Store privacy answers must reflect the current retention and processing rules that apply to the production OpenAI API account and Vercel logs at the time of submission.

Before submitting:

- [ ] Confirm whether Study AI request content is retained by any third-party service beyond the time necessary to service the request.
- [ ] Confirm whether TTS request text is retained by any third-party service beyond the time necessary to service the request.
- [ ] Confirm production logging does not intentionally record personal notes or full Study AI payloads.
- [ ] Complete App Privacy data-type, purpose and linkage questions conservatively.
- [ ] Generate Xcode's privacy report and resolve any Required Reason API warnings from Capacitor/plugins.
- [ ] Verify third-party SDK privacy manifests are included by the versions installed for the release build.

## TestFlight

- [ ] Build with a current non-beta Xcode accepted for App Store distribution.
- [ ] Archive a Release build with the iOS/iPadOS 26 SDK or later.
- [ ] Upload through Xcode Organizer to App Store Connect.
- [ ] Add at least one internal TestFlight tester.
- [ ] Run a full real-device regression from the TestFlight install, not only a local Xcode build.
- [ ] For external testers, complete Beta App Review metadata and submit the build for Beta App Review.

## Final App Review preflight

- [ ] No placeholder copy, broken buttons, blank screens or old UI fragments.
- [ ] Backend services used during review are live and production-configured.
- [ ] Privacy and Support links work from both the app and App Store listing.
- [ ] Reviewer can test core functionality without creating an account.
- [ ] Review Notes explain offline functionality, online AI/TTS requirements and microphone permission.
- [ ] App clearly provides value beyond a repackaged website: offline 81-book content, native storage, haptics, share, background audio, lock-screen controls, deep links/Shortcuts and device-native persistence.
