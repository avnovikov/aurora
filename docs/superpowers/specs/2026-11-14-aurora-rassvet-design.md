# Aurora · Rassvet — design

**GitHub / product:** Aurora  
**In-app soul mark:** Rassvet (Рассвет)  
**Locale:** British English UI and voice (`en-GB`; prefer Scouse TTS when offered)  
**User:** Morning trainer; data-scientist preference for explicit, measurable rules

Canonical detail lives in the Cursor plan `calisthenics_coach_model`. This file locks naming and the first implementation slice.

## Naming

| Surface | Name |
|---------|------|
| GitHub repository | `aurora` |
| App title | Aurora |
| Subtitle / about | Rassvet |

## First slice (done in repo)

- Brand identity helpers
- Domain types (exercise, dose, readiness, weak link, resolve result)
- Pure `resolveSlot` rules: pain, pin, light day, advance, stall (weak link / regress), hold
- Vitest coverage for those rules

## Next slices

- Warmup continuous flow + pulse shout
- Straight sets / rounds + live next-set rep edit (logged sets immutable)
- Added load in advance/stall math
- Today UI (black morning session, doodles for legs + handstand)
- Lightsail HTTPS host + offline queue
