# Zorya and Shachar: research note

Issue #280. Background for the two draft palettes in `docs/design/DESIGN.md`.

## The words

| Language | Word | Meaning | Used for |
|---|---|---|---|
| Ukrainian | Аврора (Avrora) | Loanword: the goddess, a given name | Not used |
| Ukrainian | Світанок (Svitanok) | Dawn; the sibling of Russian *rassvet* | Not used; too close to Rassvet |
| Ukrainian | Зоря (Zorya) | The dawn star, dawn; the Slavic dawn goddess | **Zorya** |
| Ukrainian | Полярне сяйво | Northern lights | Not used; Revontulet covers it |
| Hebrew | אורורה (Aurora) | Loanword | Not used |
| Hebrew | שחר (Shachar) | Dawn | **Shachar** |
| Hebrew | זוהר (Zohar); זוהר הקוטב | Radiance; the aurora borealis | Not used |
| Hebrew | אילת השחר (Ayelet ha-Shachar) | "Doe of the dawn": the first rays, the morning star | Kept as a possible later name |

Zorya pairs with Ushas and Eos, which are also dawn goddesses. Shachar pairs with Fajr, which is also the plain word for first light.

## The mid-1990s print palette

The four loud palettes were sampled from mid-1990s WIRED inside pages and the 1995 wired.com archive (see DESIGN.md `sources:`). What can be confirmed from public sources:

- The founding designers were John Plunkett and Barbara Kuhr (Plunkett + Kuhr), creative directors from 1993 to 1998.
- The magazine was known for fluorescent (day-glo) and metallic inks, clashing type and layered layouts.
- There is no published colour specification. Every hex value found online is a reconstruction, ours included.
- The designers said themselves that colour which looks right on screen can look poor in ink on paper. That is the reason our values are brightened for screen and then contrast-checked.

What the sources do not cover: the pastel pages. Public write-ups mention only fluorescents and metallics. Our evidence for pastels is first-hand memory of the printed issues, not a citation. There is a print explanation for them: a fluorescent ink printed as a light screen (around 20 to 40%) on white stock prints as a pale tint that still glows. Shachar's apricot page is built on that idea. To confirm it, check scans of 1993 to 1996 issues (Internet Archive) and sample the pastel pages directly, as was done for the first four palettes.

## How the two drafts fit the set

| Palette | Page | Kind |
|---|---|---|
| Rassvet | Near-black | Dark, metallic accent (brass) |
| Alvorada | Paper | Light |
| Ushas | Fluorescent orange | Loud |
| Revontulet | Fluorescent lime | Loud |
| Fajr | Violet | Loud, dark |
| Eos | Paper | Light, fluorescent accent |
| **Zorya** | Sky blue | Loud, dark; the first blue page |
| **Shachar** | Pastel apricot | Light; the first pastel page |

## Contrast

`node contrast.mjs` in this folder checks every text pair at 4.5:1, controlEdge at 3:1 on background and surface, and each heart-rate band at 4.5:1 on surface. Both drafts pass. The first draft of Zorya's alert, `#ffb3c1`, measured 4.09:1 on the background and was lightened to `#ffccd5`.

## Sources

- [Eye: Reputations, John Plunkett](https://eyemagazine.com/feature/article/reputations-john-plunkett)
- [AIGA Eye on Design: WIRED's 25th anniversary cover](https://eyeondesign.aiga.org/the-cover-of-wireds-25th-anniversary-special/)
- [magCulture: Wired, then and now](https://magculture.com/blogs/journal/wired-then-and-now)
- [Made Good Designs: brand guidelines write-up](https://madegooddesigns.com/wired-brand-guidelines/) (says there is no official palette)
- [Wikipedia: Wired (magazine)](https://en.wikipedia.org/wiki/Wired_(magazine))
- [Wikipedia: Electric Word](https://en.wikipedia.org/wiki/Electric_Word)
