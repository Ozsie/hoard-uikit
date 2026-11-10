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
2. Before extracting game-shaped components, add an opt-in, data-driven
   composition DSL for generic UI needs: rows, columns, spacers, text,
   buttons, checkboxes, text inputs, images, meters and basic panels.
   Every component should accept an optional image override, drawn in
   place of its canvas-drawn visual when available, using the existing
   asset contract and themed fallback when unavailable. Keep layout and
   hit testing stable, define content layering where needed, keep rendering
   theme-driven, and leave state and action handling to consumers. Validate
   the DSL against a real consumer screen so it provides a practical
   reusable foundation rather than a second component framework.
3. Explore a separate optional package or subpath for game-shaped
   screens, keeping `@hoard-engine/uikit`'s current exports intact during
   migration.
4. Keep theme, geometry, widgets and environment contracts reusable;
   ensure screen-specific view models remain data-only and do not import
   a game's domain model.
5. Add consumer-level visual parity checks before moving or changing any
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