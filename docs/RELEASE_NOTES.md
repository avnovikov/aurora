# Aurora release notes

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
