# Privacy Policy — Aurora · Rassvet

**Version:** 0.1.2  
**Effective:** public release line from `v0.1.0` (package id `com.aurora.alvorada` from `v0.1.1`)

This policy describes how Aurora handles information in version 0.1. It is product documentation for a local-only app, not legal advice.

## 1. Scope

Applies to the Aurora Android APK and the local browser preview used for development. Aurora is personal coaching software. It does not provide a cloud account or a product backend that receives your training or health data in 0.1.

## 2. Data on your device

Aurora stores the following **on your device** for coaching:

| Category | Examples |
|----------|----------|
| Profile | Bodyweight, resting/max heart rate, past injuries, equipment, voice/settings |
| Check-ins | Sleep quality, optional pain / joint notes |
| Pulse | Optional Bluetooth heart-rate readings during a session |
| Training | Plan queue, session state, history, skill/memory, personal bests |

These signals are health-adjacent coaching inputs, not a medical record. Processing stays on the phone.

## 3. What we do not do (v0.1)

- No cloud account or server sync of the data above  
- No sale or sharing of personal information for advertising  
- No ads or third-party analytics SDK in the app  
- No upload of the heart-rate stream to a remote health platform  

Uninstalling Aurora or clearing app storage deletes local data. There is no cloud backup or account recovery.

## 4. GDPR (EU / UK framing)

| Topic | v0.1 position |
|-------|----------------|
| Remote personal data held by Aurora | None — no product backend receives your training/health data |
| Lawful basis for hosted processing | Not applicable — Aurora does not host that data |
| Access / erasure / portability against a remote copy | Not applicable — there is no remote copy |
| How you delete on-device data | Uninstall the app or clear its storage |
| Contact | GitHub repository `avnovikov/aurora` (issues / security reports) |

If a future version adds optional sync or accounts, this policy will be updated before that change applies.

## 5. CCPA / CPRA (California)

| Topic | v0.1 position |
|-------|----------------|
| Personal information collected by Aurora’s servers | None |
| Sell / share personal information | No |
| Cross-context behavioural advertising | No |
| “Do Not Sell or Share” for Aurora’s product backend | Not applicable — there is no such backend |
| On-device data | Remains on your device under your control |

## 6. Downloads and issues (third parties)

APKs are distributed via **GitHub Releases** (and optionally **Obtainium**). Bug and security reports may go through **GitHub Issues**. Those services have their own privacy policies. Aurora does not run a product backend that receives that distribution or issue traffic.

## 7. On-device security

On Android, sensitive `aurora.poc.*` values use **AuroraSecure** (platform Keystore-backed). A local browser preview without the native bridge may use plaintext `localStorage` for development only.

Keep the device locked and under your control. Aurora cannot protect data on a rooted, compromised, or unlocked device.

## 8. Changes

Material changes (for example sync, accounts, or analytics) will appear in a new version of this policy before they apply.
