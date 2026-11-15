# Aurora · Rassvet — Design Spec

**Status:** draft for review (2026-11-14)  
**Repo:** https://github.com/avnovikov/aurora (private)  
**Locale:** British English UI and voice (`en-GB`; prefer Scouse TTS when offered)

## 1. Idea

A private **morning** training coach for Android Chrome. You write the week as slots; the app chooses the concrete exercise and dose from sleep, pulse, load, missed reps, and stalls. It is measurable and rule-driven — not a social feed and not a daily random WOD generator.

| Surface | Name |
|---------|------|
| GitHub / product id | **Aurora** |
| In-app soul mark | **Rassvet** (Рассвет) |

Both names appear in the UI (title **Aurora**, subtitle **Rassvet**). Same dawn meaning; EN/PT speakers read Aurora; Rassvet stays visible.

## 2. Goals and non-goals

**Goals**

- Morning check-in gates the day (sleep, pulse, joints).
- Weekly program of slots (jobs), not fixed-only exercise lists.
- Straight sets and rounds.
- Autoregulation: light day, advance, stall, weak links, load in the math.
- Continuous ~10 min warmup; pulse through warmup; shout if pulse drops.
- Rest countdown voice: Get ready → five…one → Go.
- Black morning UI; doodles for legs + handstand first.
- HTTPS PWA on own Lightsail instance; offline set queue on the phone.

**Non-goals (v1)**

- Multi-user / social / coaching marketplace.
- Scraping commercial apps or book text.
- Paid API MuscleWiki path.
- Deploy onto KS `ks-ui-app`.
- Inventing weak links from secondary-muscle lists alone.

## 3. Users and constraints

- Single user; trains in the morning.
- Android Chrome + BLE heart-rate strap (service `0x180D`).
- Private, non-commercial (required for MuscleWiki website notice).
- Tests + `npm run smell` (ESLint SonarJS: cyclomatic ≤10, cognitive ≤15) on larger commits.

## 4. Architecture

```mermaid
flowchart LR
  program[Program and slots]
  graph[Exercise graph]
  ready[Readiness]
  memory[Exercise memory]
  engine[Rule engine]
  today[Frozen workout]
  log[Sets and evaluation]
  program --> engine
  graph --> engine
  ready --> engine
  memory --> engine
  engine --> today
  today --> log
  log --> memory
```

- **Client:** Vite + TypeScript PWA; IndexedDB offline queue; Web Bluetooth; `speechSynthesis`.
- **Server:** small Node process on Lightsail; single-user DB on instance disk; serves HTTPS static + API.
- **Rule engine:** pure functions, no DOM/Bluetooth; unit-tested.

## 5. Domain model

### 5.1 Exercise

One record regardless of catalog source:

- `id`, `name`, `aliases`, `pattern`, `attribute`, `type` (`dynamic` | `isometric` | `eccentric`)
- `mechanic`, `force`, `level`, `equipment[]`
- `muscles[]`: `{ group, muscle?, role }` where `role` is `primary` | `secondary` | `stabilizer`
- `group` vocabulary = free-exercise-db’s 17 groups
- `joints[]` derived from muscle groups (fixed map)
- `coreAction?` for core: `flexion` | `anti_extension` | `anti_rotation` | `lateral` | `rotation`
- `easierId`, `harderId`, `cues[]`, `media[]`, `provenance[]`

Patterns: horizontal/vertical push & pull, squat, hinge, core compression, core anti-extension, skill, conditioning, mobility.

### 5.2 Weak link (separate from muscles)

`{ exerciseId, region, kind, capacity, muscleGroups, componentExerciseId, sourceNote }`

- `region`: `start` | `mid` | `end` | `""`
- Not auto-filled from secondary muscles; only when a source names the limiter.
- Imports leave this empty.

### 5.3 Program / slot / week setup

- **Session template** — named day plan you author freely. Starter catalogue is open-ended, not a closed enum — e.g. `Legs`, `Full body`, **`Abs` / core**, **`Upper body`**, **`Bars`**, `Skill` / `Mobility`, plus any custom name. **Handstand is not a template type** — it is a **Target** (see below). Ordered slots; focus is whatever you put in those slots. Levels live on **exercise memory** per exercise.
- **Target (program goal)** — each session template may name one (or a short list of) **target** exercises: the hard end-goal on that path. Examples: **freestanding handstand** (or wall HS → freestanding as the chain peak), pistol squat, muscle-up, front lever, human flag. The target is the *north star* for Progress UI and chain display; Today still resolves from slots + memory (you train the current step toward the target, not the target every session). Targets are chosen from the library / graph (including “top difficulty” nodes); they do not invent exercises outside the catalogue.
- **Plan queue (not a hard calendar)** — ordered list of upcoming session templates. Today always runs the **next** item; finishing a session advances the queue (repeating templates can re-append). No forced Mon=Legs schedule; override = reorder or skip next. Example queue: Legs → Legs → Legs → Skill(target: handstand) → Abs → Bars(target: muscle-up).
- **Core as a library area** — `core` is a training region / filter in Library (abdominals, lower back, `coreAction` tags), not a vague product bucket. Abs/core session templates pull from that area.
- Slot: pattern, attribute, chain, prescription mode, dose policy, role (`main` | `skill` | `accessory` | `conditioning`), optional pin.

### 5.3.1 App shell (approved direction)

Tabs: **Today** | **Library** (search + areas incl. Core) | **Progress** (chain map / target distance) | **Body** (muscle heat by period) | **Plan** (session queue) | **Settings** (equipment, bodyweight, mute, export).

**Modes**

- **Straight sets:** one exercise, X×Y, rest after each set.
- **Rounds:** ordered list, X times through, each with its own Y; rest between exercises and/or rounds.

### 5.4 Warmup

Continuous ~10 min before first working slot:

- Different areas → ~10 s gap; same area → pair with ~5 s gap (prime twice).
- General vs region-specific when enough warmup-tagged exercises exist for today’s primary groups.
- Never advances/stalls; pulse measured; shout if connected strap goes silent ~5 s.

### 5.5 Readiness / memory / logs

- **Readiness:** sleep `good|fair|poor`, resting HR, optional RMSSD, pain joints, mark.
- **Memory per exercise:** sessions at standard / below floor, last load, weak-link countdown.
- **Set log:** prescribed vs done, `addedLoadKg`, stop reason, optional fail region, HR; immutable once logged.
- **Live rep edit:** next set only, during rest.
- **Effective load:** `bodyweightKg + addedLoadKg` for closed-chain BW; else `addedLoadKg`.

## 6. Rule engine (order)

1. **Pain** → same-pattern swap without that joint (or mobility).
2. **Pin** → keep exercise; skip advance/stall; light day still allowed.
3. **Light day** (poor sleep | wiped yesterday | RMSSD low | HR ≥ median+5 on two mornings) → ~0.6× sets/rounds, +1 RIR; no advance; miss does not stall.
4. **Advance** → two sessions at top of range at ≥ prior effective load → harder exercise, low dose.
5. **Stall** → two below floor (not light days) → weak link for six sessions or regress one step.
6. **Hold** → repeat.
7. **Conditioning pulse** → cut/add rounds from recovery HR vs targets.

Dropping kg to hit reps is not an advance.

## 7. UI / UX

- Morning check-in first; black `#070708`, brass `#c4a574`, coral only for pulse/pain.
- Chalk line notches; warmup first.
- Huge reps; Description one tap; Media (video → photo → doodle → cues).
- Swipe right→left finishes exercise; Undo briefly; Skip separate.
- Rest: on-screen + voice Get ready / 5…1 / Go.
- Pulse lost: “Pulse not readable” (loud), coral flash, every ~15 s until back.

## 8. Library sources (licensed only)

| Source | Allowed |
|--------|---------|
| wger | CC0 / CC-BY-SA text + licensed images; BW/bar/rings/parallettes/barbell/dumbbell |
| free-exercise-db | Unlicense text only; **no** images |
| MuscleWiki | Text, muscles, branded videos + link; non-profit only; no maps/tools/image files |
| [Martjn/calisthenics_exercises](https://huggingface.co/datasets/Martjn/calisthenics_exercises) | **Dataset license: Apache-2.0 (open).** Import names, descriptions, categories, primary muscles, and three-step progressions under Apache-2.0 with attribution. External `links[]` keep their own licenses — import media only when `license` is `CC-BY-SA`, `CC-BY-SA-3.0`, or `public-domain`; skip empty/`null` licenses. free-exercise-db images stay out (origin unclear). MuscleWiki media only via MuscleWiki notice, not via this file’s bare page links. |
| User JSON | Own notes; refuse records with no license when claimed as third-party |

Starter seed: legs + handstand doodles and chains; four core chains so rules run before full import.

## 9. Hosting

- Own smallest Lightsail in `eu-west-1` (same account pattern as KS).
- **Not** deployed on `ks-ui-app`.
- HTTPS required for Bluetooth / install / wake lock.
- Phone queue → server; library/history on server.

## 10. Testing and quality

- Vitest for pure rules and planners.
- `npm run smell` before larger commits.
- Clean Code: small functions, expressive names, explicit errors.
- CI: test + smell + build on PR.

## 11. Implementation phases (for the plan, after approval)

1. Domain complete (warmup planner, load math, sequencing, memory updates) + tests  
2. Persistence (IndexedDB queue + server API stub) + seed data  
3. Today UI (check-in, warmup, sets, rounds, swipe, voice, doodles)  
4. Bluetooth HR + pulse shout  
5. Program + library editors  
6. Progress  
7. Lightsail deploy  

## 12. Spec self-review

| Check | Result |
|-------|--------|
| Placeholders | None intentional; v1 non-goals explicit |
| Consistency | Slots + graph + rules match UI gestures and load math |
| Scope | Full product; phases split for plans |
| Ambiguity | Prescription modes named; weak link ≠ secondary muscles; logged sets immutable; Aurora vs Rassvet surfaces named |

---

**Review gate:** Please read this spec and say if you want changes. After you approve, the next step is the writing-plans implementation plan, then build.
