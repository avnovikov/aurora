> **Historical:** Draft for IzzyOnDroid. Inclusion was **rejected** under their AI policy (LLM-assisted code). Prefer official F-Droid — see [`fdroid.md`](fdroid.md).

Title: [AppRequest] Aurora · Rassvet

Guidelines:
- [x] I am the developer of the app.
- [x] The app complies with the App Inclusion Policy.
- [x] The app is not already listed in the repo or issue tracker.
- [x] The Fastlane folder is available in the app's repo (`fastlane/metadata/android/en-US/` on `main` / tag `v0.1.1`).

Link to the source code:
https://github.com/avnovikov/aurora

Link to app in another app store:
(leave blank — GitHub Releases / sideload only)

License used:
MIT

Categories:
Sports & Health

Summary:
Local-first calisthenics coach with a plan queue and adaptive dose.

Description:
Aurora is private, local-first calisthenics training for Android. Rassvet (Рассвет, “dawn”) is the soul mark shown in the app. British English UI and coach voice (en-GB). Package: `com.aurora.alvorada`.

It is for people who train calisthenics at home and want each session adapted to recovery, available equipment, and recent performance. Typical apps give a weekday calendar and a static template. Aurora keeps a **plan queue** instead — an ordered list of upcoming training days — and adjusts the **dose** (sets, reps, or holds) from sleep, optional joint pain, recent load, missed reps, stalls, and an optional Bluetooth heart-rate strap.

Why it exists (gaps in apps I used):
1. Remember joint problems — past injuries and joints to skip or ease; moves that load those joints are eased or skipped.
2. Change the plan when progress stalls, instead of repeating the same work.
3. Free as in beer and free as in speech (MIT) — no ~£60/year subscription.

Library: **700+ exercises** (strength progressions, holds, mobility, and kettlebell work).

How it works:
- Set up once: bodyweight, resting/max heart rate, past injuries, gear you own.
- Today always runs the first day in the queue; finishing a session advances the queue.
- A Session is a guided flow: warm-up → work → cool-down → short rating. Swipe left to finish a set or station; during Rest / Get ready, swipe left to continue.
- Tabs: Today, Library, Progress, History, Body, Plan, Settings.

Privacy: training history, readiness, sleep, pulse, and joint notes stay on the device. No cloud account and no server sync of that data in 0.1. Sensitive values use Keystore-backed storage on Android. Not medical advice.

Latest release: https://github.com/avnovikov/aurora/releases/tag/v0.1.1
APK: https://github.com/avnovikov/aurora/releases/download/v0.1.1/aurora-0.1.1.apk
Signing certificate SHA-256: ff5e2dd6fd5ba34b3baca196a7e442a6492a5a22d786dc040e9850ac8529f3a6

Build instructions:
npm ci && npm run build && npx cap sync android
# with android/keystore.properties (gitignored) pointing at the release keystore:
cd android && ./gradlew assembleRelease
Release APKs are signed locally (keystore not in CI) and attached to GitHub tagged releases.
Suggested Method: github-release
Suggested ApkMatch: /aurora-.*\.apk$/
Package name / applicationId: com.aurora.alvorada

AI Assistance Level:
substantial

AI Tool(s):
Cursor (Composer), Claude

What did the tools help with, and how?
Implementation of TypeScript domain rules and UI, Capacitor Android shell, tests, documentation (README/tutorial), doodle assets, and release packaging. Product decisions, signing key custody, and release approval remain with the human maintainer.

Further Notices:
Fastlane metadata: fastlane/metadata/android/en-US/ (title, short/full description, 512px icon, phone screenshots) — present on main at v0.1.1.
Author email for metadata: alexei.128.946@gmail.com (also in SECURITY.md).
Issue tracker: https://github.com/avnovikov/aurora/issues
Changelog: https://github.com/avnovikov/aurora/releases
README: https://github.com/avnovikov/aurora#readme
