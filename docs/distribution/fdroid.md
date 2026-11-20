# Official F-Droid inclusion (Aurora · Rassvet)

> **Status:** Prep in this repo. Do **not** reopen an `fdroiddata` MR yet — packagers closed [!58331](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/58331) as too early (&lt;3 months public maintenance + use the [request template](https://gitlab.com/fdroid/fdroiddata/-/blob/master/.gitlab/issue_templates/Application.md)).  
> **Package:** `com.aurora.alvorada`  
> **Related:** [#229](https://github.com/avnovikov/aurora/issues/229), [#232](https://github.com/avnovikov/aurora/issues/232)

## Why F-Droid (not IzzyOnDroid)

[IzzyOnDroid](https://izzyondroid.org/docs/general/AppInclusionPolicy/) rejects apps whose **code** is substantially LLM-assisted. Aurora disclosed that assistance and was rejected.

[F-Droid’s Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/) focuses on FLOSS licence, rebuild-from-source, and no proprietary / tracking deps. It does **not** currently ban responsible AI-assisted development (a Debian-style “responsible use” interim policy is under discussion in F-Droid admin). Be honest in the MR; the hard gates are buildability and software freedom.

## Signing decision (v1 listing)

- **First listing:** F-Droid **rebuilds and signs** with the F-Droid key.
- GitHub Release APKs keep the maintainer key. Users cannot update from GitHub sideload → F-Droid (or vice versa) without uninstall.
- **Later:** optional reproducible builds + `AllowedAPKSigningKeys` so F-Droid can ship under the maintainer key. Do that before a large sideload user base if possible.

## Already in place

| Item | Location |
|------|----------|
| MIT licence | `LICENSE` |
| Public source | https://github.com/avnovikov/aurora |
| Fastlane metadata | `fastlane/metadata/android/en-US/` (title, short/full description, icon, screenshots) |
| Release tags | `v0.1.0` … `v0.1.2`; next F-Droid target **`v0.1.3`** (versionCode **4**) |
| Local-first / no ads / no analytics SDK | `docs/PRIVACY.md`, `SECURITY.md` |
| No `INTERNET` / LOCATION in merged APK | `AndroidManifest.xml` (`tools:node="remove"`); verify with `scripts/verify-android-permissions.sh` |
| BLE scan without location derivation | `BLUETOOTH_SCAN` + `neverForLocation` + `tools:replace` |
| No GMS / Firebase plugin wiring | Removed Capacitor template `google-services` classpath/apply |

## Google / GMS note

Capacitor’s Android template historically adds `com.google.gms:google-services` and a conditional apply when `google-services.json` exists. Aurora never shipped that JSON and does not use Firebase/FCM. The unused plugin wiring was removed so F-Droid scanners do not flag dormant GMS hooks. The `google()` Maven repository remains — that is normal for AndroidX / AGP and is not GMS.

## Build recipe (what F-Droid must run)

Aurora is Capacitor + Vite + TypeScript. The web bundle must be built before Gradle:

```bash
npm ci
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

- **Node.js 22** (matches CI in `.github/workflows/ci.yml`).
- No `keystore.properties` → unsigned release APK (F-Droid signs afterward).
- Capacitor may need `scanignore` for `@capacitor/cli`’s cordova plugins tarball (binary archive used at sync time); `scandelete: [node_modules]` after install.

Draft metadata for copy-paste into [fdroiddata](https://gitlab.com/fdroid/fdroiddata):  
[`fdroid-metadata-com.aurora.alvorada.yml`](fdroid-metadata-com.aurora.alvorada.yml).

Similar upstream Capacitor examples in fdroiddata: `com.gurkenwerfer.calyx`, and recent Vite+Capacitor MRs (e.g. Vibecheck).

## Maintainer checklist (outside this repo)

1. Fork https://gitlab.com/fdroid/fdroiddata  
2. Copy draft YAML → `metadata/com.aurora.alvorada.yml` (adjust `commit` / Node `sudo` if CI requires)  
3. Push branch; let GitLab CI run `fdroid build` / lint  
4. Open MR titled `New App: com.aurora.alvorada`  
5. Reply promptly to packager questions  
6. After merge, wait for a build cycle (~1–2 days typical before it appears in the client)

Optional before MR:

- Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (≤500 chars) for each release  
- Confirm `npm ci && npm run build && npx cap sync android && cd android && ./gradlew assembleRelease` succeeds **without** `keystore.properties`

## Code-quality notes (from !58331)

F-Droid CI flagged **Minor** `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, and `INTERNET` on tag **`v0.1.2`** (that tag still granted location via the BLE plugin merge and INTERNET via Capacitor). From **`v0.1.3` / #232** onward the app manifest strips those with `tools:node="remove"`. Re-verify after each release:

```bash
cd android && ./gradlew assembleRelease
../scripts/verify-android-permissions.sh
```

`BLUETOOTH` / `BLUETOOTH_ADMIN` (maxSdk 30) and `BLUETOOTH_SCAN` / `CONNECT` are expected **Info** findings for optional Pulse HR.

## AntiFeatures / review notes to expect

- **Bluetooth HR strap** is optional; BLE is FOSS (`@capacitor-community/bluetooth-le`).  
- **Catalogue** content follows upstream licences (wger CC, etc.) — already documented in README.  
- No NonFreeNet requirement for core coach flows (no `INTERNET` permission).  
- Disclose AI-assisted development briefly in the MR description; name `@avnovikov` as maintainer.  
- Wait until the Inclusion Policy’s maintenance window (~3 months) and use the Application request template when resubmitting.

## References

- [Submitting to F-Droid Quick Start Guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/)  
- [Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/)  
- [RFP tracker](https://gitlab.com/fdroid/rfp) (prefer a working `fdroiddata` MR over RFP-only)  
- Izzy draft (historical): [`izzy-app-inclusion-request.md`](izzy-app-inclusion-request.md)  
