# Scores, round 2 (Creative Director sign-off)

I scored these from the round-2 renders only: Rassvet, Alvorada and Ushas at 390 × 844, full page. Bar: every axis 8 or above, average 8.5 or above. I re-scored all four screens from scratch.

Fold flags: as in round 1, text cut at the 844px line or at the top of a pinned bar is content passing under the fixed tab bar (Progress, Settings) or the sticky Log set bar (session-work). The proof flag on session-work ("Pay attention to", 1.4:1) is this kind of occlusion. In the DOM capture its box is at y 718, entirely inside the bar (651 to 844). The page scrolls to 1202, so on a device the line clears the bar. It is not a colour fault and I have not marked the screen down for it.

## progress: sign off

```
scores: hierarchy 9, typography 9, spacing 8, colour 9, composition 8, originality 8, brand 9, copy 9
average: 8.6
pass: yes
notes:
- spacing: the status line ("Beginner level · 0 of 2 …") sits 16px under its card and about 72px above the next block, so it groups correctly. The one uneven gap is the 24px between the path and the card versus the 16px under it: set `.path-preview { margin-bottom: 16px; }`
- composition: when the path wraps, a line opens with a bare "→" at the left edge (Pistol squat, Manna, Freestanding handstand attempt). It is acceptable and reads as a continuation; no change this round
- originality: the ladder now reads as a path (arrows, underline for you, weight for the target) and no longer as tappable tags. Keep it; no change
polish:
- none
```

Reasons:
- hierarchy 9: the target name at 25px now clearly reads before the accent current step in the card.
- typography 9: one condensed size per level, body and labels on the scale, tabular PB figures.
- spacing 8: space alone separates the blocks now that the rule is gone. There is one small 24/16 unevenness around the card.
- colour 9: accent once per block (the card bar and the current step name). It holds in Alvorada, and the violet on orange reads well in Ushas.
- composition 8: five blocks with the same clear shape. The arrow at the start of a wrapped line is a minor wobble.
- originality 8: underline for "you are here" and bold for the target are the brand's own move, not a template chip row.
- brand 9: Plex Condensed headings, radius 4, no pills or shadows, all three palettes correct.
- copy 9: plain and exact ("1 step to go", "Target reached", "Not started on this path yet"), with every number verbatim.

## session-work: sign off

```
scores: hierarchy 9, typography 9, spacing 8, colour 9, composition 8, originality 9, brand 9, copy 9
average: 8.8
pass: yes
notes:
- composition: the doodle's box is on the text edge, but the figure is drawn centred in its viewBox, so it lands at about x 110: neither on the 24px column edge nor centred. Crop the doodle asset's viewBox to the figure (asset change, port with the doodles), or until then centre it again: `.doodle { display: block; margin: 8px auto; }`
- spacing: the doodle band still has about 50px clear above and below the figure (y 438 to 548 in a 382 to 598 gap). `.doodle { max-height: 7rem; }` brings the description up by about 16px, so three full lines sit above the bar
polish:
- the first screen now ends on the description's opening lines, which tells the thumb to scroll. Keep the hero without a min-height
```

Reasons:
- hierarchy 9: the 12 reps figure reads first, the name second and Log set third, with nothing fighting them.
- typography 9: the dose note at 16/24 and the hint at 12.8/16 are both on the scale now, and the condensed numerals are tight.
- spacing 8: the dead band is gone and the description starts at y 598, above the bar (651). The band around the doodle is still a little generous.
- colour 9: accent only on the 12, and Log set is foreground-filled in all three palettes (orange on plum in Ushas reads).
- composition 8: the first screen reads well: timer, name, dose, load link, figure, then the description under the bar. The doodle's x position is the one off note.
- originality 9: the station rail, the 95px figure and the hand-drawn doodle make it this app's session screen.
- brand 9: roles only, radius 4, 44px targets on the minus and plus buttons and in the bar.
- copy 9: "Pulse: no reading" and "swipe to move between sets" are fixed, and "Stop with 3 reps left in reserve" is exact.

## settings-you: sign off

```
scores: hierarchy 9, typography 9, spacing 9, colour 9, composition 8, originality 8, brand 9, copy 9
average: 8.8
pass: yes
notes:
- composition: the injury grid wraps 4 then 3, and What happened wraps 2 then 2, leaving ragged right edges. Acceptable with one left edge and 8px gaps; no change
- originality: the indented follow-up on an edge-role rule is the distinctive move; keep it as the pattern for conditional questions
polish:
- accent twice in the header (h1 and the active-tab underline) stands as an owner decision; if the owner drops the accent h1 later, the underline can stay
```

Reasons:
- hierarchy 9: the title, the tabs, then one question per group, with the conditional follow-ups clearly subordinate.
- typography 9: two weights, labels at 12.8 uppercase, field values at 16.
- spacing 9: on the 4px grid, with groups made by space. Round 2's shared CSS did not shift anything here.
- colour 9: the checked state is a foreground border plus a tick with no second accent, and it is correct in all three palettes.
- composition 8: a clean single column. The wrapped button grids are a little ragged.
- originality 8: the indented follow-up is the only non-template move, but it is a good one.
- brand 9: radius 4, no pills, the brand's type and voice.
- copy 9: "Moves that load these joints are skipped or eased." says what happens.

## settings-gear: sign off

```
scores: hierarchy 9, typography 9, spacing 9, colour 9, composition 8, originality 8, brand 9, copy 9
average: 8.8
pass: yes
notes:
- composition: the equipment buttons wrap 2-2-1-1. Acceptable; no change
- originality: the tick plus foreground border on checked gear is clear in all three palettes; keep it
polish:
- the helper wraps to leave "that take load." alone on its second line; acceptable at 390px, leave as is
```

Reasons:
- hierarchy 9: equipment first, then added weight, then the autosave line. The order is obvious.
- typography 9: the same two-weight system as You, all on the scale.
- spacing 9: the autosave line now sits 24px under the helper and reads with the form, not as a third section.
- colour 9: no accent below the header, and checked states use foreground only.
- composition 8: a tidy column, with a ragged wrap on the gear buttons.
- originality 8: restrained and confident, though not distinctive beyond the checked-state treatment.
- brand 9: roles, radius 4, 44px targets, Plex.
- copy 9: "Sessions offer it on moves that take load." no longer repeats the label, and 12 kg is verbatim.
