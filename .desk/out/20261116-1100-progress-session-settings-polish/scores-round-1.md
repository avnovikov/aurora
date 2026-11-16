# Scores, round 1 (Creative Director sign-off)

I scored these from the round-1 renders only: Rassvet, Alvorada and Ushas at 390 × 844, full page. Bar: every axis 8 or above, average 8.5 or above.

Fold flags (Progress, session-work): the text you see cut at the 844px line is content passing under the fixed tab bar (Progress) and the sticky Log set bar (session-work). This is what a full-page capture of a pinned bar looks like. Both pages leave enough bottom padding for the last line to clear the bar, so on a device nothing is hidden for good. It does not look wrong, and I have not marked either screen down for it.

## progress — send back

```
scores: hierarchy 8, typography 9, spacing 8, colour 8, composition 8, originality 7, brand 9, copy 9
average: 8.3
pass: no
notes:
- originality: the progression ladder is drawn as wrapped bordered tags, so it reads as a tag cloud, not a path, and the tags look tappable when they are not. Make it a sequence: `.path-step { border: 0; padding: 4px 0; }` and `.path-preview { gap: 4px 8px; }`
- originality: give the sequence a direction with a typographic separator, not an icon: `.path-step + .path-step::before { content: "→"; margin-right: 8px; color: var(--muted); font-weight: 400; }`
- originality / hierarchy: mark "you are here" without a box, so now and target are two different cues: `.path-step.path-start, .path-step.path-now { color: var(--foreground); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }`. Keep `.path-step.path-target { color: var(--foreground); font-weight: 600; }` and drop its `border-color`
- hierarchy: the block title and the accent exercise name in the card are close in size and fight for second place. `.chain-title { font-size: 25px; line-height: 28px; }` (on the scale) so the target reads before the current step
polish:
- spacing: blocks are split by both a rule and about 32px of space. Drop the rule (`.progress-card + .progress-card { border-top: 0; margin-top: 40px; }`) so the space alone groups them
```

All three palettes behave the same way. The accent once per block (the card's left bar and the current step name) holds in Alvorada and Ushas, and the Ushas violet on the orange surface reads clearly. The h1 in accent is an owner decision and was not scored against.

## session-work — sign off

```
scores: hierarchy 9, typography 8, spacing 8, colour 9, composition 8, originality 9, brand 9, copy 8
average: 8.5
pass: yes
notes:
- typography: `.dose-note` is 14.4px, which is off the scale and sits too close to the 16px body. Set `.dose-note { font-size: 16px; line-height: 24px; }`. `.session .hint { font-size: 12.8px; line-height: 16px; }` (was 13px)
- spacing: about 48px of dead band between the doodle and the bar at the fold. `.session-frame { margin: 16px 0 0; }` and `.doodle { max-height: 8rem; }` so the summary line starts above the bar
- composition: the doodle is a 30px-wide figure centred in a full-width frame. Left-align it to the text column (`.doodle { margin: 8px 0; width: auto; }`) so it hangs on the same edge as the name and the load link
- copy: "Pulse no reading" → "Pulse: no reading". "Log the set below, or swipe left or right" → "Log the set below, or swipe to move between sets"
polish:
- the 95px brass figure, the station rail and the foreground-filled Log set read clearly in all three palettes; keep them
```

## settings-you — sign off

```
scores: hierarchy 9, typography 9, spacing 9, colour 9, composition 8, originality 8, brand 9, copy 9
average: 8.8
pass: yes
notes:
- composition: the injury grid's first row fits four and the second leaves a ragged 70px gap. Acceptable; use one left alignment and an 8px gap everywhere (already true), no change needed beyond the line below
- originality: the indented follow-up (Which knee / What happened) on an edge-role rule is the one move a template would not make; keep it as the pattern for any other conditional question
polish:
- the header uses the accent twice (h1 and the active-tab underline). If the owner keeps the h1 in accent, set `.settings-tabs [aria-selected="true"]` underline to `var(--foreground)`
```

## settings-gear — sign off

```
scores: hierarchy 9, typography 9, spacing 8, colour 9, composition 8, originality 8, brand 9, copy 8
average: 8.5
pass: yes
notes:
- copy: the section label "Added weight" and the field label "Weight you can add (kg)" say the same thing, and the helper repeats "add weight". Change the helper to "A dumbbell, kettlebell or vest. Sessions offer it on moves that take load."
- spacing: "Changes save as you make them." floats 32px under the helper like a third section. Set its top margin to 24px so it sits with the form it describes
- composition / originality: the equipment buttons wrap to a ragged 2-2-1-1 shape. Acceptable; no change beyond keeping the checked state as foreground border + tick (it works in all three palettes)
polish:
- same accent-twice note on the header as Settings You
```
