# TODO: Separate reusable UI kit from game-shaped screens

Not committed to — `@hoard-engine/uikit` has a clean view-model/layout/
hit-test/render contract, but its component catalog includes many
screens shaped around one game (hero selection, dungeon intro, between-
dungeons, event/diary panels). This gives that consumer useful shared
rendering, while making the package less immediately portable to games
with different screen concepts.

## Plan (based on reuse, not a broad rewrite)

1. Inventory component usage across current consumers and identify the
   generic widgets and components reused without game-specific concepts.
2. Explore a separate optional package or subpath for game-shaped
   screens, keeping `@hoard-engine/uikit`'s current exports intact during
   migration.
3. Keep theme, geometry, widgets and environment contracts reusable;
   ensure screen-specific view models remain data-only and do not import
   a game's domain model.
4. Add consumer-level visual parity checks before moving or changing any
   renderer, and document the intended public entry points.

## Open questions

- Are consumers better served by one broad canvas UI package or a small
  generic kit plus opt-in screen collections?
- Which components are genuinely reusable across games, versus simply
  sharing the same visual treatment today?
- Would smaller package boundaries create useful adoption choices or
  merely add release and versioning overhead?

## Leverage for existing consumers

Keep the current public exports and component behavior stable while
evaluating the split. Preserve the three-function contract, semantic hit
results, theme token usage and the `@hoard-engine/primitives` dependency
boundary; any visual change needs existing consumer regression coverage.