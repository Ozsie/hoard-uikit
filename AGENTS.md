# AGENTS.md

`@hoard-engine/uikit` — a HOARD engine package (spec:
`docs/engine-packages.md` in the game repo). The canvas UI chrome: kit
widgets (modal frame, button, list row, text input, sprite frame), the
14 full components (cards, panels, dialogs, menus) and the
`UiEnv`/`UiContext` contracts, extracted from the game repo's
`src/uikit/`. It is the one package with a deliberate dependency edge —
`@hoard-engine/primitives` (theme tokens, text, geometry, clipping)
under the two-consumer rule: uikit and scene both draw.

## What this package is

- Theme-driven canvas UI chrome driven by plain view models: every
  component follows the layout/hitTest/render contract, every color and
  font comes from the theme tokens, every label arrives through the
  translator port, every image through the asset port.
- Extracted from the game repo's `src/uikit/` (the spec history lives
  in that repo under `docs/ui-kit-spec/`); the game keeps the adapters
  (view models built from game state, env construction, assets) and all
  strings and assets.
- Like every HOARD engine package, it is designed to be pluggable and
  interoperable, and as standalone as possible: individually adoptable,
  swappable and usable without any other HOARD package, game or
  framework. Packages compose through data — minimal shapes, callbacks,
  plain values — never through shared state; a new dependency or a
  sibling import here is a design regression, not an optimization.

## Hard boundaries

- Package sources import nothing but relative files and
  `@hoard-engine/primitives` — no game code, no Svelte, no i18n
  packages, no node builtins, no other packages. Enforced by lint and
  `src/boundary.test.ts`; tests may additionally import `vitest`.
- Kit modules hold no style literals: every color and font is read from
  the theme tokens. Lint fails on color-like string literals in
  non-test sources; the sentinels in the `./testing` subpath verify the
  same at render time.
- The kit ships no default strings: every user-facing label arrives
  through `UiEnv.t`. Never add a fallback label.
- The public surface is exactly `src/index.ts` — every export is
  re-exported there (`src/publicSurface.test.ts` fails otherwise); the
  test harness is the `./testing` subpath export. Consuming anything
  through another path is a bug.
- The canvas arrives through `UiContext`; components never touch global
  browser APIs. The package must run in plain Node (tests are
  canvas-free through the recording context).
- Rendering changes are rule-visible. The originating game repo pins
  its renderers with parity snapshots; a change that alters layout
  geometry or drawn output is a visual change the consumer must accept
  — ask before "fixing" either side, and point RULES.md decisions at
  the game.

## Commands

```bash
npm test          # vitest (boundary, public-surface, widgets, sentinels)
npm run check     # tsc --noEmit (strict)
npm run lint      # eslint over src and vitest.config.ts
npm run prettier  # prettier --check (fix via prettier:format)
npm run build     # tsc declarations + esbuild ESM bundles to dist/
```

Run `npm run check`, `npm test`, and `npm run lint` before considering
work done.

## Conventions

- Prettier with single quotes, 2-space indent, print width 80;
  TypeScript is in strict mode.
- Tests are colocated as `*.test.ts` next to the module they cover
  (`src/components/independence.test.ts` drives every component from
  hand-built view models alone).
- `dist/` is build output — never edit it; the build regenerates it.
- Publishing: `prepublishOnly` runs check + build + test; the version is
  bumped first, before `npm publish`. No license field is added
  unilaterally — that is the repo owner's decision.
- View-model follow-ups: a new component goes into `src/components/`,
  follows the layout/hitTest/render contract, and is re-exported from
  `src/index.ts` in the same change; a new widget only once a second
  consumer exists (the two-consumer rule).
