# F-Droid `fdroiddata` MR body (App inclusion)

> **Do not open yet** — wait for ~3 months public maintenance ([Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/)).  
> When ready: open the MR from a **public** fork, choose GitLab’s **Default** MR template (new-app checklist), paste the filled sections below, keep every checklist item, and tick what applies.  
> Canonical upstream template: [`.gitlab/merge_request_templates/Default.md`](https://gitlab.com/fdroid/fdroiddata/-/blob/master/.gitlab/merge_request_templates/Default.md)  
> Packagers closed [!58331](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/58331) partly because this template was not followed.

**Suggested title:** `New app: Aurora`

**Branch tip:** one app only; metadata only under `metadata/com.aurora.alvorada.yml`; `commit:` must be the **full git hash** of tag `v0.1.3` (or newer), not the tag name. Draft recipe: [`fdroid-metadata-com.aurora.alvorada.yml`](fdroid-metadata-com.aurora.alvorada.yml).

---

<!-- Paste from here into the GitLab MR description (keep the checklist). -->

## Abstract for new app inclusion

### Please introduce the functions and usage of your app in summary, and also attach some screenshots.

**Aurora · Rassvet** (`com.aurora.alvorada`) is a local-first calisthenics training coach for Android (MIT).

- Plan **queue** of upcoming training days (not a static weekday calendar).
- Adaptive **dose** (sets / reps / holds) from recovery signals, equipment, recent load, and stalls.
- Optional Bluetooth LE heart-rate strap (FOSS `@capacitor-community/bluetooth-le`); BLE hardware is not required.
- No ads, no analytics SDK, no `INTERNET` or location permissions in the merged APK (coaching stays on-device).

Source: https://github.com/avnovikov/aurora  
Fastlane: `fastlane/metadata/android/en-US/` (title, short/full description, icon, phone screenshots, changelog).  
Screenshots: use the Fastlane `images/phoneScreenshots/` set from the release tag (also visible on GitHub Releases).

### Please elaborate why you wrote this app. Please highlight the unique functions it provides over other similar apps in F-Droid.

I built Aurora because existing calisthenics apps I used did not:

1. Remember joint problems and ease/skip moves that load them.
2. Change the plan when progress stalls instead of repeating the same work.
3. Stay free as in beer and speech (MIT) without a subscription.

Compared with typical workout trackers on F-Droid, Aurora is coach-oriented: a **queue + adaptive dose** loop, British English UI/voice, and a large curated exercise library — not a generic set logger.

## Checklist

### Policy

* [x] The app complies with the [inclusion policy](https://f-droid.org/docs/Inclusion_Policy). _Pay special attention to Quality point 6._
* [x] The original app author has been notified (and does not oppose the inclusion). If you are not the author, please paste the link of the reply from the author. _(I am the author / maintainer.)_
* [x] The upstream app source code repo contains the app metadata in a [Fastlane](https://gitlab.com/snippets/1895688) or [Triple-T](https://gitlab.com/snippets/1901490) folder structure. The summary and description must be included and images, icon, and changelog should also be provided for better user experience. The `en-US` locale must be included.

### Docs

* [x] Please read [the guide](https://gitlab.com/fdroid/fdroiddata/-/blob/master/CONTRIBUTING.md) first if this is your first contribution.
* [x] Please make sure your metadata follows the best practice in [our templates](https://gitlab.com/fdroid/fdroiddata/tree/master/templates).
* [x] Please read the [Build Metadata Reference](https://f-droid.org/docs/Build_Metadata_Reference/) and make sure your metadata is valid.
* [x] Please read the [Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/).

### Merge Request Setup

* [x] The title of this merge request should follow "New app: app name" format.
* [x] Please make sure your fdroiddata fork is public and your branch is not protected. See <https://docs.gitlab.com/user/project/repository/branches/protected/>.
* [x] Please read [our Git guide](https://gitlab.com/fdroid/wiki/-/wikis/Tips-for-fdroiddata-contributors/Git-Usage) if you don't know how to rebase your branch. Don't rebase your branch if there is no conflict.
* [x] All related [fdroiddata](https://gitlab.com/fdroid/fdroiddata/issues) and [RFP issues](https://gitlab.com/fdroid/rfp/issues) have been referenced in this merge request. _(None open at submit time; prior attempt !58331 closed as too early.)_
* [x] Please only submit one app in one MR.

### Metadata

* [x] Metadata must be put in `metadata/<applicationId>.yml`.
* [x] Metadata must be a valid YAML file.
* [x] Metadata must use LF as line ending.
* [x] Don't add summary/description/changelog/images or anything that should be provided in upstream repo. Please check the Changes tab to make sure there is no other unrelated files added in the MR.
* [x] Releases are tagged and auto update is enabled unless there is a special reason.
* [x] There is an issue tracker and contact info of the author so that we can report bugs and contact the author.
* [x] An AuthorName must be added. It doesn't need to be the real name.
* [x] External repos are added as git submodules instead of srclibs. You can update git submodules without opening an MR in this repo and the submodule is covered by our scanner. _(N/A — no external build repos.)_
* [ ] Enable [Reproducible Builds](https://f-droid.org/docs/Reproducible_Builds). We'll use your signature for improved security/reliability, also allowing users to switch between different channels. Do note that if you don't enable reproducible build then the apk will be signed with our key so you can't enable it later. If you can't enable this, please add the reasons here.

  **Reason (v1):** Capacitor + Vite web bundle → Android APK is not yet set up for bit-identical reproducible builds / `AllowedAPKSigningKeys`. First listing uses **F-Droid rebuild + F-Droid signing**. Reproducible builds are a follow-up before a large sideload user base.

* [x] Setup abi split if the APK is large and the splitted ones can be much smaller. _(N/A — no native libs; ~9–10 MB.)_
* [x] Only the latest versions should be kept in the metadata before it's merged. If you update the metadata, please replace the old versions with the new ones.
* [x] Don't add any disabled versions in the metadata.
* [x] The `commit` field should be the full hash. Please don't use tag or branch in commit.

### Pipeline

* [ ] All pipelines should pass. _(Tick after GitLab CI is green.)_
* [ ] All warnings and errors in the Reports tab should be fixed or explained. _(LOCATION/INTERNET Minors fixed from v0.1.3 onward; BLE permissions are intentional Info.)_
* [x] F-Droid CI runners are under GitLab's FOSS program, so there's no need for you to pay for any CI time. If Gitlab starts asking for phone numbers or credit cards don't submit anything, just leave a note in the MR so we know we need to trigger the CI.

---------------------

<!-- Add RFP number if one exists; otherwise remove this line. -->
<!-- Closes rfp#NNNN -->

### Extra notes

- **AI disclosure:** Substantial AI-assisted implementation under human review/sign-off. The app does not call LLM services. IzzyOnDroid rejected under their LLM-code policy; submitting here under F-Droid FLOSS inclusion criteria.
- **Maintainer:** Alexei Novikov \<alexei.128.946@gmail.com\>
- Upstream prep: https://github.com/avnovikov/aurora/blob/dev/docs/distribution/fdroid.md

/label ~"New App"
