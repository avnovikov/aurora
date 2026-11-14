# Aurora implementation plan

## Goal

Ship a private morning PWA (Aurora / Rassvet) with a tested rule engine first, then Today UI, library import, and Lightsail host.

## File map

| Path | Responsibility |
|------|----------------|
| `src/brand/identity.ts` | Aurora + Rassvet names |
| `src/domain/types.ts` | Shared domain types |
| `src/rules/lightDay.ts` | Light-day detection and dose cut |
| `src/rules/resolveSlot.ts` | Ordered slot resolver |
| `tests/**` | Vitest |

## Tasks

1. **Brand + domain + resolve rules** (this commit) — tests green  
2. **Warmup planner + pulse alert messages** — unit tests  
3. **Set log immutability + next-set rep edit + load math** — unit tests  
4. **Today shell UI** (check-in, chalk line, doodles)  
5. **Web Bluetooth HR + speech countdown**  
6. **Lightsail deploy script** (own instance, not `ks-ui-app`)

## Definition of done per larger commit

- `npm test` passes  
- Clean Code: small functions, expressive names  
- HotspotTriage `analyze` on touched paths  
