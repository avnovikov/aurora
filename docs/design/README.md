# Design

Canonical brand file: [`DESIGN.md`](DESIGN.md) (palette tokens, voice, Do/Don't).

Shipping colours in `src/brand/palettes.ts` must match the `palettes:` block; CI asserts that in `tests/brand/palettes.test.ts`.

## Desk Studio (local only)

`.desk/` is **not** committed. For local Desk jobs, symlink the brand file:

```bash
mkdir -p .desk
ln -sfn ../docs/design/DESIGN.md .desk/DESIGN.md
```

Mocks, renders, and `project.json` stay under `.desk/` on your machine.
