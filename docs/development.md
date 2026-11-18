# Aurora development guide

Contributor notes for running, testing, and shipping Aurora · Rassvet. Product orientation for Android users lives in the [README](../README.md). The first-use walkthrough is the [First-morning tutorial](tutorial/take-your-first-morning-with-aurora.md).

## Prerequisites

- **Node.js 22** (matches CI in `.github/workflows/ci.yml`)
- **npm** (lockfile: `package-lock.json`)
- **Android Studio** for the Capacitor Android project under `android/`
- **Android SDK / build tools** to build or verify release APKs (`apksigner`)
- A physical Android device for Bluetooth heart-rate work and device snapshots

There is no shipped web product. The Vite preview is a local UI tool only.

## Quick start

### Web preview (UI only)

```bash
npm install
npm run dev -- --host
```

Open the LAN URL in a browser (or Android Chrome) for layout and interaction checks. The preview does **not** include heart-rate-strap connection. Pulse Connect on plain HTTP in a browser does nothing useful; use the Android APK for strap work.

### Android development

```bash
npm run cap:sync    # tsc + Vite build, then Capacitor sync into android/
npm run cap:open    # open the project in Android Studio
```

App id: `com.aurora.alvorada`. Minimum SDK: **23** (Android 6). Compile / target SDK: **35** (`android/variables.gradle`).

Heart-rate uses Capacitor with `@capacitor-community/bluetooth-le` in the Android app only.

## Testing and quality

```bash
npm test          # Vitest unit and domain tests
npm run smell     # ESLint + SonarJS complexity (`--max-warnings 0`)
npm run build     # TypeScript check + Vite production build
```

CI also runs `npm run test:ui` (Playwright, phone-sized Chromium with touch) on pull requests and pushes to `main`, `poc`, and `feature/**`.

Run `test`, `smell`, and `build` before opening a PR. A failing smell check fails CI the same way a failing test does: the job exits non-zero and the PR should not merge until it is fixed.

## Architecture

| Piece | Where / what |
|-------|----------------|
| Main tab bar | `src/ui/shell.ts` — Today, Library, Progress, History, Body, Plan, Settings |
| Session | Not a tab; replaces the tab bar for warm-up → work → cool-down → rating |
| Plan / dose / progression | Pure TypeScript under `src/rules/` (and related domain modules): no DOM, no Bluetooth |
| On-device storage | Android: Keystore-backed `window.AuroraSecure` for sensitive `aurora.poc.*` keys. Browser / unit tests without the bridge: `localStorage` (plaintext, preview only) |
| Heart rate | BLE in the Capacitor Android build only |
| Voice | Prebuilt WAV packs under the voice pipeline; lines in `src/voice/` |
| Optional host | Lightsail static HTTPS for a later PWA experiment — see [deploy/lightsail.md](deploy/lightsail.md). Not required for the APK or for BLE |

The web preview and the Android WebView share the same TypeScript UI. Capacitor wraps that UI for device APIs. Release APKs are signed locally; see below.

Common storage keys: `aurora.poc.profile.v1`, `aurora.poc.planQueue.v1`, `aurora.poc.planDays.v1`, `aurora.poc.history.v1`, `aurora.poc.memory.v1` / `aurora.poc.memory.v2`, `aurora.poc.session.v1`.

## Branches and releases

- **`poc`** is the integration branch for day-to-day merges.
- Merge to **`main`** only as part of an explicit release (version bump, release notes, signed APK on GitHub Releases).
- Do not treat a casual merge to `main` as a release.

Release APKs are signed on a developer machine. The keystore stays out of Git and out of CI (`android/keystore.properties.example`). Confirm a downloaded APK’s certificate SHA-256 as described in the README Install details.

Version shown in the README and Android `versionName` for this line: **0.1.1**.

## Device snapshots

Optional fixture for tests and docs:

```bash
node scripts/pull-device-snapshot.mjs
```

Requires USB debugging and a debuggable build. Snapshots used for Help / tutorial screenshots live under `.device-snapshots/` and are **not** shipped in the APK.

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Device not listed | USB debugging authorised; `adb devices`; correct cable / wireless pair |
| `cap:sync` fails | Run `npm run build` alone; fix TypeScript errors first |
| No heart-rate in browser | Expected — use the Android APK |
| Vite LAN unreachable | Phone and machine on the same network; firewall; `npm run dev -- --host` |
| `npm run smell` fails | Fix ESLint / complexity findings; CI uses `--max-warnings 0` |

## Related docs

| Doc | Role |
|-----|------|
| [README](../README.md) | Product orientation, download, privacy |
| [First-morning tutorial](tutorial/take-your-first-morning-with-aurora.md) | End-user walkthrough |
| [Shell-tab reference](reference/aurora-shell-tabs.md) | Tabs, Session, storage keys |
| [Terms](TERMS.md) | Local-only processing and disclaimer |
| [Lightsail deploy](deploy/lightsail.md) | Optional HTTPS host |
