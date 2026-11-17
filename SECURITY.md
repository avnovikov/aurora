# Security Policy

> **Document owner:** Repository maintainer (`@avnovikov`)
> **Status:** Active

## Purpose and scope

**Aurora (Rassvet)** is a local-first Android training coach. Health and training data stay on-device (Keystore-backed `AuroraSecure`). There is no cloud account for health sync in 0.1.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x | Yes |

## Reporting a vulnerability

Do **not** open public GitHub issues for suspected security vulnerabilities.

Report privately via:

- [GitHub Security Advisories](https://github.com/avnovikov/aurora/security/advisories/new)
- Email: `alexei.128.946@gmail.com`

Include a clear description, affected version/commit if known, and reproduction steps when possible. Acknowledgement aim: **48 hours**.

## Handling and disclosure

- Reports are assessed privately before public disclosure.
- Severity uses **CVSS v3.1**.
- Public disclosure follows after a fix or other appropriate response.

## Commitments

- **Local-first:** sensitive training/health signals are stored on-device; release signing keys are never stored in CI.
- **Automated scanning:** PRs and protected branches run CodeQL (JS/TS + Java), dependency audit, Trivy filesystem scan, and Gitleaks.
- **Dependency updates:** Dependabot covers npm, GitHub Actions, and Android Gradle.
- **Release provenance:** `v*` tags generate a CycloneDX SBOM attached to the GitHub Release; the signed APK is built on a trusted machine and uploaded separately.

## Verify a released APK

Certificate SHA-256 (also in the README):

```text
ff5e2dd6fd5ba34b3baca196a7e442a6492a5a22d786dc040e9850ac8529f3a6
```

```bash
apksigner verify --print-certs path/to/app-release.apk
```
