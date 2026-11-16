# Changes, round 1 (UI Designer)

All CSS below is "all files": one block appended at the end of the second `<style>` (before `</style>`), identical in progress.html, session-work.html, settings-you.html, settings-gear.html. Every rule is later in the cascade than the rule it overrides, at equal or higher specificity. When porting, edit the original declarations in place instead of appending; the final values are what is listed. Palette blocks and font link untouched.

## A. Shared
A1 (all files)
- `.eyebrow`: font-size 0.75rem -> 12.8px; add line-height 16px; letter-spacing 0.08em -> 0.06em.
- `.exercise-next-label`: font-size 0.75rem -> 12.8px; add line-height 16px.
- `.chip-row-label`: font-size 0.7rem -> 12.8px; add line-height 16px; letter-spacing 0.08em -> 0.06em.

A2 (all files)
- `.tab-bar`: background var(--surface-sunk) -> var(--surface).
- `.tab-bar button`: font-size 0.75rem -> 12.8px; add line-height 16px; min-height 48px -> 56px; padding 0.75rem 0.2rem -> 12px 4px; add border-top: 2px solid transparent.
- `.tab-bar button.active`: color var(--brass) -> var(--foreground); add font-weight 600; add border-top-color var(--foreground).

A3 (all files)
- `.tagline, .about, .reason`: font-size 0.95rem -> 16px; add line-height 24px. `.hint` keeps 0.8rem (12.8px) via its own rule (remove `.hint` from the shared selector in source, as it is overridden anyway).

A4 (all files)
- `h1`: font-size 2.4rem -> 39px; add line-height 44px.
- `h2`: font-size 1.6rem -> 25px; add line-height 32px. `.chain-title` keeps 20px.

A5 (all files)
- `.session-clock-label, .session .chalk-now, .session .session-phase, .session .session-attention .eyebrow, .session .station-source, .session .session-why .reason, .session .hint, .session-bar-status`: font-size 13px -> 12.8px (line-heights unchanged).

## P. Progress (all files, shared sheet)
P1 `.personal-best-inline`: margin 0.35rem 0 0 -> 4px 0 0; color var(--brass) -> var(--foreground); font-size 0.85rem -> 16px; add line-height 24px; letter-spacing 0.03em -> 0; add font-variant-numeric tabular-nums.
P2 `.exercise-next`: margin 0.35rem 0 0 -> 4px 0 0; font-size 0.85rem -> 16px; add line-height 24px (color stays var(--muted)).
P3 `.chain-reason`: margin 0 -> 8px 0 0; font-size 0.85rem -> 12.8px; add line-height 16px; add font-variant-numeric tabular-nums.
P4 new `.progress-card > .tagline { margin: 4px 0 0; color: var(--foreground); font-variant-numeric: tabular-nums; }`
P5
- new `.progress-card > .eyebrow { margin: 0 0 4px; }`
- `.chain-title`: margin 0 0 0.25rem -> 0.
- `.chain-card`: margin-top 1.25rem -> 32px; padding-bottom 0.75rem -> 24px.
- `.path-preview`: gap 0.35rem 0.5rem -> 8px; margin 0.5rem 0 0.75rem -> 12px 0 16px.
- `.path-step`: padding 0.15rem 0.4rem -> 4px 8px (font-size stays 12.8px).
- `.exercise-block`: margin 0 0 0.5rem -> 0; padding 0.65rem 0.75rem -> 12px 16px.
No markup change.

## S. Session, working set (all files, shared sheet)
S1
- `.session-hero`: add display flex; flex-direction column; min-height calc(100dvh - 296px). 296px kept as is: at 390x844 hero is y 100-648, bar top is y 651, `.session-read` starts at 648 and its first text at 680, so the bar edge lands 3px inside the 32px top padding and touches no text. 
- `.session-frame`: add flex 1 0 auto; display flex; align-items center; justify-content center.
S2 `.dose-note`: margin 0.25rem 0 0.5rem -> 8px 0 0; font-size 0.9rem -> 16px; add line-height 24px (text-align center and colour unchanged).
S3
- `.session-bar`: padding 16px 24px 16px 16px -> 16px 24px.
- `.session-bar-status`: padding-left 8px -> 0.
- new `.session-bar .work-actions .cta + .btn-quiet { margin-left: -12px; }` (the note's `:first-of-type` would match the Log set button, which is the first button in the group, so I used the sibling selector to hit "Couldn't finish").
- `.session-bar .pulse-chip`: margin 0 auto 0 0 -> 0 auto 0 -8px (pulse-chip keeps its 4px border-left and 4px padding-left).
No markup change.

## Y. Settings, You (CSS in all files; markup in settings-you.html only)
Y1 new `.settings .row button.selected, .settings .row button[aria-pressed="true"] { border: 2px solid var(--foreground); padding: 7px 15px; color: var(--foreground); font-weight: 600; background: color-mix(in srgb, var(--foreground) 12%, var(--surface)); }` The tick (✓) is untouched.
Y2 markup, `div.hj-detail` in `[data-joint-editor]`:
- before: `<p class="tagline">Knee</p><div class="row wrap" role="group" aria-label="Which knee">...Left/Right/Both...</div><div class="row wrap" role="group" aria-label="What happened to your knee">...kinds...</div>`
- after: `<p class="hj-label" id="hj-side-label">Which knee</p><div class="row wrap" role="group" aria-labelledby="hj-side-label">...</div><p class="hj-label" id="hj-kind-label">What happened</p><div class="row wrap" role="group" aria-labelledby="hj-kind-label">...</div>`
- code: the joint name stays in the label ("Which shoulder", "Which hip").
CSS: new `.hj-label { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600; color: var(--foreground); }`; `.hj-detail`: margin 0.5rem 0 1rem -> 8px 0 24px, add padding-left 16px, add border-left 2px solid var(--edge); new `.hj-detail .row { margin: 8px 0 0; }`; new `.hj-detail .row + .hj-label { margin-top: 24px; }`.
Y3 (all files)
- `.settings .row`: gap 0.5rem -> 8px; margin 0.75rem 0 1.25rem -> 8px 0 24px.
- `.settings .row button` (new): min-height 44px; padding 8px 16px; border-radius 4px.
- `.settings .field input[type="number"]` (new): min-height 48px; margin-top 8px; padding 12px; border-radius 4px.
- `.settings-panel > .eyebrow`: margin-top 1.5rem -> 32px.
- new `.settings-panel > .eyebrow + .hint { margin: 4px 0 0; }`

## G. Settings, Gear
G1 covered by Y1 (same rule). G2 covered by Y3 (32px above "Added weight" comes from `.settings-panel > .eyebrow`). G3 covered by A1. No markup change.

## Not fully met / for the manager
- Proof (Rassvet, phone, 844 viewport): settings-you and settings-gear pass with zero failures. session-work still reports one contrast item, "A fundamental two-leg squat that builds" at 1.0:1: the summary now starts at y 680, entirely beneath the sticky bar (651-844), not cut by its edge. The checker reads pixels behind the text, which is the bar, so any text in the 193px under the bar will flag. The only way to clear it is 193px of empty scroll space under the doodle, which I did not do because it goes against S1's intent. Same artefact on progress: the fixed tab bar covers the footnote "Beginner level · 1 of 2 sessions at target reps to move up" at the fold (2.3:1 behind the bar). Both are occlusion by fixed bars at the fold, not text/colour problems. Alvorada and Ushas were not re-rendered by me.
- The "Padding 7px 15px" on selected chips relies on Y3's 8/16px, as noted.
