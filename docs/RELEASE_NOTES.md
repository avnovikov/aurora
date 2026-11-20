# Aurora release notes

## v0.1.3 (2026-11-20)

App id unchanged: **`com.aurora.alvorada`**. `versionCode` **4**.

Promote from `dev` onto the `mvp` release line (`release/0.1.3`).

### Functionality

- **Body** — answers "what is the balance?": five balance rows (Push v Pull, Upper v Lower, Front v Back, Squat v Hinge, Abs v Lower back), a front/back figure whose areas swell or hollow by level, a caricature doodle for the most uneven pair, five time windows, and "Consider adding" moves filtered to your gear (#218, #234 / #235).
- **History** — sessions grouped by week with an effort strip, session cards, reps per set, average heart rate, and personal bests with "new PB" (#228 / #231); bpm label and drill-down Back from History and Body to the exercise page, including the phone's Back (#219 / #221).
- **Doodles** — the remaining 189 Library moves are drawn: 690 animated doodles in total, with head facing, held sticks and towels, a partner figure, spine roll and zoom insets; rings, straps, bands and kettlebells (#210–#216 / #211, #213, #225).
- **Docs** — README and tutorial refreshed with new screenshots from invented sample data and a repeatable `scripts/help-screenshots.mjs`; GitHub community standards (Code of Conduct, Contributing, issue templates) (#226, #236 / #227, #237).

### Bug fixes and packaging

- Android: location and internet permissions stripped from the merged APK; Bluetooth scan keeps `neverForLocation` for the optional heart-rate strap (#222, #232 / #233).
- F-Droid preparation: Google Play services hook removed, fdroiddata metadata drafted (#230); fastlane description spacing (#224).

### Download

Install **`aurora-0.1.3.apk`** from GitHub Releases. Same package id as v0.1.2 — Obtainium / sideload update replaces in place; local data is kept.

### Verify

```bash
apksigner verify --print-certs path/to/aurora-0.1.3.apk
```

Certificate SHA-256: `ff5e2dd6fd5ba34b3baca196a7e442a6492a5a22d786dc040e9850ac8529f3a6` (same signing key as v0.1.1 and v0.1.2).

---

## v0.1.2 (2026-11-19)

App id unchanged: **`com.aurora.alvorada`**. `versionCode` **3**.

Promote from `dev` onto the `mvp` release line (`release/0.1.2`).

### Functionality

- **History** — session pulse on history, plus clearer session blocks in the feed (#184, #185 / #195).
- **Plan level** — raise plan level from logged performance over the next days (#115 / #186); weak-link scoring uses the declared plan level (#190 / #192).
- **Standards** — tier bands calibrated from Endura and coaching composites (#189 / #191).
- **Session rest** — compact doodle for the next move during work rest (#177 / #183).
- **Doodles** — dual-view (side + front) with 3D limbs and validation; large batches of second views; board and floor props for benches/planks (#174, #202 / #204).
- **Library** — kettlebell “comrade” coach cues (#172 / #173); archer / Australian progressions and related imports (#168–#171).
- **Descriptions** — fidelity judge plus rewrites for hard fails (#170 / #176).
- **Target positioning** — README and shell docs lead with Target → path → Progress (#164 / #165).

### Bug fixes

- Rest timer no longer skips the **Go** cue at zero (#178 / #179–#180).
- Skill-level inference hardening from review follow-ups (#112 / #116 / #188).
- Doodle fixes: climber one leg at a time, ab-wheel sizing, archer push-up, incline text fidelity, board legs / decline plank (#174, #202).
- Security / CodeQL: clear High findings (entity decode, CDP dispatch, cleartext suppress + AlertSuppression), harden device-snapshot fixture path, ignore `node_modules`/build noise, and clear nine quality findings in app sources (#198–#208).
- Tooling: TypeScript 6-compatible tree, Vitest 5, CodeQL Android build reliability (#160, #181, #193–#197).

### Download

Install **`aurora-0.1.2.apk`** from GitHub Releases when published. Same package id as v0.1.1 — Obtainium / sideload update replaces in place; local data is kept.

### Verify

```bash
apksigner verify --print-certs path/to/aurora-0.1.2.apk
```

Certificate SHA-256 should match the v0.1.1 signing key (documented on the GitHub release once the APK is attached).

---

## v0.1.1 (2026-11-18)

App id changed to **`com.aurora.alvorada`**. `versionCode` **2**.

See GitHub release [v0.1.1](https://github.com/avnovikov/aurora/releases/tag/v0.1.1).
