# Terms & Conditions — Aurora · Rassvet

**Version:** 0.1.0  
**Effective:** first public release (`v0.1.0`)

These terms apply when you install or use Aurora (Rassvet), including the Android APK distributed from GitHub Releases.

## 1. What Aurora is

Aurora is a private morning training coach. You write the week as slots; the app picks exercise and dose from sleep, pulse, load, missed reps, and stalls. It is personal software, not a clinical or medical product.

## 2. Local-only data

In version 0.1:

- Training history, readiness, sleep quality, pulse / heart-rate readings, pain or joint notes, and related health signals stay **on your device**.
- There is **no cloud account** and **no server sync** of health or training data.
- Uninstalling the app, clearing app storage, or losing the device may permanently delete that data. You are responsible for any backups you choose to make outside the app.

If a future version adds optional sync or accounts, that change will be described in an updated Terms document before it applies.

## 3. Secure on-device storage

On the Android shell, sensitive values are stored through **AuroraSecure**, backed by the platform **Keystore** (not plaintext shared preferences). In a browser or developer preview without the native bridge, storage may fall back to ordinary browser storage for local testing only.

You must keep your device locked and under your control. Aurora cannot protect data if the device is rooted, compromised, or unlocked by someone else.

## 4. Bluetooth and sensors

If you connect a heart-rate strap or similar device, pulse data is processed on the phone for coaching. Aurora does not upload that stream to a remote health platform in 0.1.

## 5. Not medical advice

Aurora does not diagnose, treat, or prevent any disease. Exercise and dose suggestions are rule-based coaching aids. If you have a medical condition, injury, or doubt about training, consult a qualified clinician. Stop if you feel pain, dizziness, or distress.

## 6. Licence of the software

The Aurora source code is licensed under the **MIT License** (see [`LICENSE`](../LICENSE)). Exercise catalogue text and media follow each upstream source’s licence (for example wger CC, MuscleWiki non-profit notice). Using the catalogue does not transfer those upstream rights beyond what those licences allow.

## 7. Disclaimer

The software is provided “as is”, without warranty of any kind, as set out in the MIT License. To the extent permitted by law, the authors are not liable for injury, data loss, or other damages arising from use of the app.

## 8. Contact

Issues and security reports: the GitHub repository for Aurora (`avnovikov/aurora`).
