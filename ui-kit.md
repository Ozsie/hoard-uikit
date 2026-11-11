# The UI kit

This document is the reference for `@hoard-engine/uikit` — the
game-agnostic canvas UI kit: what it contains, the boundary that keeps
it game-agnostic, the component contract every widget follows, and the
view models a consumer builds to drive it. For the migration history and
the original extraction spec, see `docs/ui-kit-inventory.md` and
`docs/ui-kit-spec/` in the game repository that originated the kit. The
package README is the npm-facing summary; this is the longer consumer
reference.

## What the kit is

```
src/
  index.ts                   // the public surface — consume this
  env.ts                     // UiEnv / UiContext contracts + shared constants
  kit/                       // widgets: modalFrame, button, listRow, textInput, spriteFrame
  components/                // shared screens/components and the generic composition DSL
  testing/                   // the test harness: recordingContext, sentinels, literalBudget
                             // (published as the './testing' subpath export)
```

The theme tokens and the drawing primitives (text, geometry, rounded
rect) live in the `@hoard-engine/primitives` engine package — the kit's
single allowed dependency — and are re-exported through the package
index.

Everything the kit draws goes through the theme; every string arrives
through the translator port; images arrive through the asset port. The
kit holds **no game imports and no default strings** — it is plain
TypeScript with no Svelte, no i18n library, and no dependency but
`@hoard-engine/primitives`. Two tests and three lint rules enforce this
(see [Boundary](#boundary) below).

The public surface is `src/index.ts`. If you need something it does not
export, that is a missing surface — add it there deliberately rather
than deep-importing. A completeness test (`src/publicSurface.test.ts`)
fails when a source module is missing from the surface. The test
harness lives behind the `./testing` subpath export.

The game-shaped `heroCards`, `heroStatus`, `monsterCards`, `dungeonIntro`,
`saveLoadDialog`, `newGameDialog`, `heroSelection`, `eventCard`, `diary`,
and `betweenDungeons` renderers are owned by `drakriddarna` and are not
part of this package's source or public exports. The consumer composes
them from the generic DSL; game state, translated strings, assets and
action dispatch remain consumer-owned.

## Boundary

The boundary is tool-enforced, in both directions:

- **Kit side** — under `src/**`, lint errors on any import but relative
  files and `@hoard-engine/primitives`, and on color-like string
  literals (converted modules hold zero style literals; the tests that
  exercise literals are exempt). `src/boundary.test.ts` walks the
  import graph as a second line of defense, catching paths lint
  misses — `@hoard-engine/primitives` is the single import it allows
  from outside the kit.
- **Consumer side** — game-logic modules in the originating repository
  (`src/game.ts`, `src/core/`, `src/monsters/`, and so on) may not
  import the kit, so headless benchmarks never pull in canvas code.
  Only the consumer's UI layer (its `src/ui/`, `src/components/`)
  crosses the boundary.

Two sentinels prove the kit writes only what it is given: the **sentinel
theme** (every token is a unique marker; a leaked style literal fails)
and the **sentinel translator** (every drawn string is translated or a
documented allowance — the allowances are glyphs, data fragments,
player-typed names and consumer-side literal labels). The originating
game repo runs both against every render surface; `sentinelTheme.test`
here verifies the harness itself.

## The component contract

Every component follows the same three-function shape over a plain view
model. The signatures vary slightly per module (some take an `env`, some
take layout options), but the contract is fixed:

```
layout*(vm, viewBounds, [env], [options])  → layout   (pure; canvas-free)
hitTest*(layout, point)                    → semantic hit | null
render*(layout, [vm], ui, [options])       → void      (draws via ui.ctx)
```

- **View model** — a plain, serializable object; the only data a
  component reads. All texts are prebuilt strings; the component never
  calls a translator itself (the layout may ask `env.t` for a
  layout-dependent label, e.g. a "N more" overflow line).
- **Layout** — pure geometry over the view model and a `Rect` of the
  view. Text is measured through `env.measure` (or fixed geometry), so
  layouts stay testable without a canvas. Several modules export an
  `empty<Name>Layout` so an absent layout can be hit-tested without a
  canvas.
- **Hits** — semantic ids (`{ kind: 'card', cardId }`, hero ids, row
  indices, `'toggle'`/`'panel'`), never consumer objects. The caller
  maps ids back to entities.
- **Render** — draws through `UiContext` (an env plus the canvas context
  and the asset port). Every color, font and stroke width comes from
  `ui.theme`.

### Environment

```ts
interface UiEnv {
  theme: UiTheme; // design tokens
  mode: 'regular' | 'compact'; // width-derived layout density
  t: Translator; // message key + params → string
  measure: TextMeasure; // canvas-free text measuring
}
interface UiContext extends UiEnv {
  ctx: CanvasRenderingContext2D;
  assets: AssetProvider; // AssetId → loaded image (or undefined)
}
```

The consumer builds one env per update (in the originating game repo,
`src/ui/env.ts`); a render signature includes env identity, so locale or
theme changes repaint. The kit's `COMPACT_TOGGLE_SIZE` (the square a
collapsed compact panel collapses into) lives beside `LayoutMode` in
`src/env.ts`.

### Assets

Components reference images by an opaque `AssetId` and draw sprite
frames through `SpriteRef` (`{ assetId, index, size }` — row-major
square frames on a sheet). `drawSpriteFrame` (`src/kit/spriteFrame.ts`)
resolves the sheet through the asset port and returns `false` while it
loads, so callers draw their icon fallback.

## Composition DSL

`CompositionNode` is the package's generic, data-only composition API.
Rows, columns and stacks arrange shared layout primitives; panels add
themed chrome. Text supports measured wrapping, clipping and decoration;
fills, lines and hit-only nodes cover common drawing and semantic-hit
needs. Sprite images can render fallback text when the asset is missing.
`layoutComposition`, `hitTestComposition` and `renderComposition` share
the recursive tree traversal; consumers still own state and dispatch.
The shared `topBar`, `menu`, `welcome`, `settings`, and `radialMenu`
components also use this model internally while keeping their public
layout, hit-test and render contracts stable.

## The theme

`UiTheme` (with the defaults in `defaultTheme` and the deep-merge
`resolveTheme`) lives in the `@hoard-engine/primitives` engine package
and is re-exported through the package index; it is the single style
authority, organized as:

| Group               | Contents                                                            |
| :------------------ | :------------------------------------------------------------------ |
| `palette.text`      | Text colors by role (body, muted, bright, gold, dimmed, ...)        |
| `palette.surface`   | Fill colors by surface (panels, rows, buttons, inputs, sliders)     |
| `palette.border`    | Stroke colors by element (subtle, hairline, ring, selected, ...)    |
| `palette.overlay`   | Scrims and vignettes                                                |
| `palette.hover`     | Hover fills                                                         |
| `palette.status`    | Current/target actor markers                                        |
| `palette.actorDot`  | The four actor-dot colors (`red`, `blue`, `yellow`, `green`)        |
| `typography`        | `sizes`, `weights`, `families`; `composeFont(theme, size, weight?)` |
| `shape.strokeWidth` | `thin`, `regular`, `medium`, `thick`, `heavy`                       |
| `alpha`             | Dimming factors                                                     |

A second theme renders through the same components without touching
them (the originating game repo ships a high-contrast theme as proof of
parameterization). Adding a style means adding a token; a hardcoded
literal in a component fails the boundary lint and both sentinels.

## Primitives and kit widgets

The drawing primitives come from `@hoard-engine/primitives` (re-exported
through the kit index); the kit widgets are the kit's own:

| Module                 | Provides                                                                                                                                                                                                                |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primitives` (package) | `composeFont`, `measureTextWidth`, `truncateText`, `wrapText`, `wrapTextMeasured`, `PER_CHAR_WIDTH_FALLBACK`, `Rect`, `Point`, `isPointInRect`, `drawRoundedRect` (quadratic corners), `roundRectPath` (native corners) |
| `kit/modalFrame`       | `drawDialogScrim`, `drawModalFrame`, `drawModalHeader`                                                                                                                                                                  |
| `kit/button`           | `drawButton` (primary/secondary variants with hover)                                                                                                                                                                    |
| `kit/listRow`          | `drawListRow`, `listRowStyles`, `rowState`                                                                                                                                                                              |
| `kit/textInput`        | `drawTextInput`, `applyTextInputKey`, `clampTextInput`                                                                                                                                                                  |
| `kit/spriteFrame`      | `spriteSourceRect`, `drawSpriteFrame`                                                                                                                                                                                   |

## View model reference

Every remaining screen component's view model is defined next to it and
re-exported through the index; this is the consumer-facing summary. All
fields are readonly strings, numbers or nested view models — no consumer
types.

| Component                                                              | View model carries                                                                                                        | Semantic hits                                                                              |
| :--------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------- |
| `topBar`                                                               | Menu/debug labels, turn/score/timer texts, compact width reservations, log entries                                        | `'menu'`, `'debug'`, `'log'`, `'turn'`, `'logDropdown'`                                    |
| `menu`                                                                 | View name, header, item labels, footer (the originating game routes its debug menu through it)                            | `item` (item id), `panel`, `backdrop`                                                      |
| `welcome`                                                              | Header, button labels (Continue/Save only while a run is ongoing), footer, background asset id                            | button id (`continue`, `newGame`, `save`, `loadGame`, `settings`)                          |
| `composition`                                                          | Generic row/column/stack/panel trees, controls, text, fills, dividers and images; state and actions remain consumer-owned | Consumer-supplied action ids                                                               |
| `settings` / `credits`                                                 | Settings rows (toggle/slider/button kinds, values, dimmed flags), credits rows with urls                                  | `toggle`, `slider`, `button` (row id), `back`, `panel`, `backdrop`; credits: `row`, `back` |
| `radialMenu`                                                           | Ring origin, button labels/icons, optional sprite refs                                                                    | `button` (button id)                                                                       |
| Selection and step state that the consumer owns travels as composition |
| data and render options, not package-held state; the consumer rebuilds |
| the tree and handles semantic actions.                                 |

## Testing the kit

The test harness lives behind the `./testing` subpath export:
`createRecordingContext` (a deterministic call-log stand-in for the
canvas context), `createSentinelTheme`, and the style-literal counter.
The originating game repo owns parity snapshots for its screen adapters.
`src/components/independence.test.ts` here drives every remaining shared
screen component with hand-built view models alone — the kit is usable
without any game.

## The published package

The export map has two entries: `.` (the built index — theme and
primitives re-exports, the environment contracts, the widgets, the
components) and `./testing` (the verification harness). The build is a
plain-TypeScript `tsc` declaration pass plus esbuild ESM bundles over
`src/index.ts` and `src/testing/index.ts`, with
`@hoard-engine/primitives` kept external as the single runtime
dependency. The suite runs in plain Node — contexts arrive through
`UiContext`, and tests record instead of render. The package layout and
conventions follow the other HOARD engine packages (see
`docs/engine-packages.md` in the game repo).
