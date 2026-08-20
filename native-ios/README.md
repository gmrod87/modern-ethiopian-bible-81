# Hobah for iPhone and iPad

This folder contains the native Capacitor 8 shell for Hobah. It is intentionally isolated from the Vercel web build so native dependencies cannot destabilise the live site.

## What is native

- The complete 81-book Bible data is copied into the application bundle for offline reading.
- Whole-Bible search reads the bundled corpora locally.
- Saved Scripture, notes, Study AI explanations, reading position and preferences are mirrored into Capacitor Preferences.
- iOS Share is used for Scripture sharing.
- Haptics are used for navigation and save actions.
- iOS status-bar and safe-area handling are configured.
- `hobah://` deep links are handled for Siri Shortcuts / Shortcuts automations.
- The iOS audio session is configured for background spoken audio.
- Media Session handlers connect lock-screen play, pause, previous and next to Hobah's player.
- Native connectivity state shows an offline indicator while keeping the local Bible available.
- Study AI and natural TTS remain online services; API keys stay on Vercel and are never packaged in the app.

## Requirements

- macOS
- Xcode 26 or later with an iOS 26 or later SDK for App Store submission
- Node.js 22+
- An Apple Developer Program account for device signing, TestFlight and App Store distribution

## Create the iOS project

From the repository root:

```bash
npm install
npm run build
cd native-ios
npm install
npm run ios:init
npm run ios:open
```

`ios:init` creates the Capacitor Xcode project if necessary, configures microphone and speech-recognition permissions, enables background audio, registers the `hobah://` URL scheme, and generates the Hobah app icon and launch screen.

## Sync future Hobah updates into iOS

```bash
npm run build
cd native-ios
npm run ios:sync
```

This rebuilds the web app, copies all 81 book files into `native-ios/www`, patches online API calls to use the production HTTPS API, bundles the native bridge, syncs Capacitor, regenerates iOS assets, and runs the native doctor.

## Deep links / Siri Shortcuts

Supported URLs include:

- `hobah://home`
- `hobah://study`
- `hobah://read/genesis/1`
- `hobah://read/psalms/23`
- `hobah://search/peace`

In the iOS Shortcuts app, create an **Open URLs** action with one of these URLs and give the Shortcut a spoken name such as “Open Psalm 23 in Hobah.” Siri can then run that Shortcut by name.

## Offline behaviour

The application does not point its WebView at the Vercel website. It loads `www/index.html` and bundled Bible data from the application itself. Only these features require a network connection:

- Study AI
- Realtime Study AI audio
- Natural TTS / Read Aloud generation
- Public Privacy and Support pages

Ordinary reading, local search, bookmarks, personal notes, saved Study AI notes already stored in the Library, text-size preferences and reading position work from local app data.

## TestFlight

Open `native-ios/ios/App/App.xcworkspace` (or the generated Xcode project if Xcode uses Swift Package Manager only), select your Apple developer Team, confirm the bundle identifier `com.hobah.bible` is available, run on a physical iPhone, then Archive and upload through Xcode Organizer to TestFlight.

Before upload, complete `APP_STORE_CHECKLIST.md` and `APP_STORE_METADATA.md` in this folder.
