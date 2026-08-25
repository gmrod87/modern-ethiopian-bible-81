# Hobah — App Store Connect Metadata

## App identity

**Name:** Hobah  
**Subtitle:** 81-Book Ethiopian Bible  
**Bundle ID:** `com.hobah.bible`  
**Marketing version:** `1.0.0`  
**Primary category:** Books  
**Secondary category:** Reference

## URLs

**Marketing URL:** https://modern-ethiopian-bible-81.vercel.app/  
**Support URL:** https://modern-ethiopian-bible-81.vercel.app/support.html  
**Privacy Policy URL:** https://modern-ethiopian-bible-81.vercel.app/privacy.html

## Promotional text

Read, listen, search and study the 81-book Ethiopian canon plus a source-conscious Ancient Library, with offline reading, natural Read Aloud, Study AI and a private on-device Library.

## Description

Hobah is an iPhone and iPad Bible reader built around the 81-book Ethiopian canon, with an additional Ancient Library for historically important Jewish and Christian writings outside the canon.

READ OFFLINE
The full 81-book Bible text and bundled Ancient Library material are included with the app, so reading opens quickly even without an internet connection. Search the canon, change reading size and return to your exact reading position.

ANCIENT LIBRARY
Explore additional ancient writings while keeping them clearly separate from the Ethiopian 81-book canon. Fragmentary works are identified as fragmentary rather than silently reconstructed. The Book of Giants, for example, is presented as surviving Aramaic fragment sections rather than as a complete ancient manuscript.

LISTEN
Use natural Read Aloud for Scripture and supported Ancient Library texts. Background audio and lock-screen controls let you keep listening while your device is locked or Hobah is in the background.

STUDY AI
Ask about the passage on screen for literary context, theology, cross-references, history and major interpretive views. Study AI distinguishes supplied text from broader historical or scholarly context.

VOICE STUDY
While listening, use optional hands-free commands such as pause, play, explain that and save that. Hobah can pause Scripture, explain the passage, read the explanation aloud and then return to the reading.

YOUR LIBRARY
Save verses, chapters, Ancient Library selections, personal notes and Study AI explanations. Your reading library and position are stored on your device.

Hobah is designed as a focused reading and study tool: fast access, natural listening, contextual study and a reliable private library without requiring an account.

Internet is required for Study AI and natural voice generation. Core reading, local search and saved on-device Library content are designed to work offline.

## Keywords

bible,ethiopian,enoch,jubilees,book of giants,ancient,scripture,study,read aloud,81 books

## Review notes

Hobah does not require an account or login.

The 81-book Bible text and bundled Ancient Library content are included inside the native app. Reading, local search and the on-device Library can be tested without an internet connection. Study AI and natural TTS require an internet connection.

Suggested review flow:
1. Open Genesis 1 or another book from Books.
2. Open Ancient Library and open Book of Giants. It is intentionally presented as fragment sections because no complete ancient manuscript survives.
3. Turn on Airplane Mode and confirm bundled reading, local search and Library content remain accessible.
4. Re-enable the network and tap Read Aloud to test natural narration. Ancient Library narration remains within the current work and advances through its sections before stopping at the end.
5. Tap Study AI and ask a question about the current passage. Use the response audio controls if desired.
6. Enable Voice Commands in the Read Aloud panel and say “pause”, “play”, “explain that” or “save that”.
7. Open Library to confirm saved Scripture/notes.

Microphone and speech-recognition permission are requested only for optional hands-free voice commands. The app remains usable without granting microphone permission.

Privacy Policy and Support are available from the native About tab and at the public URLs above.

## App Privacy submission notes

Hobah has no account system, advertising SDK or cross-app tracking. Saved reading data and notes are stored locally. Online Study AI and natural Read Aloud transmit text through Hobah's Vercel endpoints to OpenAI's API for app functionality.

Conservative App Store Connect starting point:
- Answer **Yes** to data collection because online user-content requests can be processed and may be retained temporarily by a third-party API provider.
- Consider **User Content → Other User Content** for Study AI questions and associated passage context, purpose **App Functionality**, not used for tracking.
- Natural Read Aloud transmits the text selected for speech generation for **App Functionality**.
- Do not declare advertising, tracking, contacts, financial, health or precise-location collection unless the production data flow changes.
- Current server code does not intentionally log Study AI question bodies, passage bodies or narration text. Infrastructure may process technical request metadata such as IP address, request time, path, status and error details.
- OpenAI states API inputs/outputs are not used for model training by default and may be retained for up to 30 days for abuse monitoring unless applicable Zero Data Retention controls apply. Keep the App Privacy answers aligned with the actual API account configuration at submission time.

## Age-rating submission notes

Complete Apple's current questionnaire based on the text actually distributed. Because biblical and Ancient Library material contains mature themes, violence, sexual references, weapons, death and other sensitive subject matter, do not select the lowest answers by default. Use the questionnaire's frequency definitions and let App Store Connect calculate the final regional ratings. Hobah does not contain gambling, loot boxes, advertising or social-media features.

## Screenshot plan

Capture screenshots from the final release build. Recommended sequence:
1. Home — Hobah / 81-book canon
2. Reader — Scripture view
3. Ancient Library — Book of Giants or another ancient work with the Ancient Library label visible
4. Read Aloud — audio controls
5. Study AI — explanation with audio/save controls
6. Library — saved Scripture and Study notes

Use real app screens, no transparency, and the exact dimensions accepted by the current App Store Connect screenshot uploader.

## Current release candidate

As of 25 August 2026, Build 55 was signed, exported and uploaded successfully to App Store Connect/TestFlight. A later build should supersede it only when a release-hardening change is intentionally made and validated.
