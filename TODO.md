# TODO: Separate reusable UI kit from game-shaped screens

Initial assessment (superseded): the kit uses a clean view-model/layout/
hit-test/render contract and originally included game-shaped screen renderers.
The approved migration moves ten such renderers into `drakriddarna` while
keeping the generic DSL, widgets and shared screens in UIKit.

## Consumer inventory and Welcome baseline

The originating game repository's `docs/ui-kit-inventory.md` and
`src/ui/viewmodels/` adapters confirmed one current consumer for the screen
components before this migration. The adapters keep `GameState`, campaign and
settings reads out of UIKit; the game owns env construction, assets,
interaction state and action dispatch. This is evidence of reuse across
screens in one game, not proof of reuse across multiple games.

Reusable composition candidates are the generic menu, welcome and settings
flows, plus shared UI patterns: modal panels, buttons, rows, checkboxes,
text inputs, text, images and status meters. The game inventory identified
hero/monster cards and status, hero selection, dungeon intro, event/diary
panels, and between-dungeons as game-concept-shaped; the ten named screens
are now composed in the game. The radial menu remains in UIKit because it
was not part of this migration request.
The existing button, list-row, modal-frame and text-input widgets already
serve multiple screens in the game; sprite frames are shared by inventory
and radial-menu art.

`Welcome` is the pilot baseline. At 1280×800, the default three-button
layout has a centered 560×240 panel at (360, 280), 524×48 button rows at
y=344, 400 and 456, and a footer bounds of 1280×10 at y=778. With an
ongoing run, Continue and Save appear and the panel is 560×352 at
(360, 224), with rows at y=288, 344, 400, 456 and 512. The game adapter
builds the translated labels, build footer and background asset id; the
consumer snapshots `welcome` and `welcome-ongoing` in
`src/ui/parity/paritySnapshots.test.ts`. Its `WelcomeRendering.test.ts`
also pins button order/hits, sizing, the themed missing-image fallback,
and the 1000×500 cover-fit override (1200×600 at x=-200, y=0 on an
800×600 view). The consumer composition tests now compare both button
sets' geometry and semantic hits, exercise image lookup and fallbacks,
and compare rendering against the unchanged renderer; the original
parity snapshots remain unchanged.

## Migration decision and evidence

The generic composition DSL and its DSL-backed `Welcome` pilot are
complete. The current decision is to keep generic widgets, shared screens
and the DSL in `@hoard-engine/uikit`, while moving these ten game-shaped
renderers into `drakriddarna`: `heroCards`, `heroStatus`, `monsterCards`,
`dungeonIntro`, `saveLoadDialog`, `newGameDialog`, `heroSelection`,
`eventCard`, `diary` and `betweenDungeons`. This supersedes the earlier
recommendation to defer extraction. It is not a decision to move generic
kit widgets or to add game dependencies to UIKit.

The game-side renderers are adapted through consumer-owned facades; game
state, translations, assets, callbacks and hit routing remain in the game.
`src/ui/UIRendering.ts` composes the board overlays, while
`src/components/DungeonBoardUiHit.ts` owns first-hit-wins routing and
`src/components/DungeonBoardController.ts` owns effects. Several facades
restore game objects from DSL/component semantic identities, so migration
must preserve those adapter mappings and modal priority.

| Screen            | Consumer view model → facade                                                  | Existing pinned rendering evidence                                                     |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `heroCards`       | `src/ui/viewmodels/heroCards.ts` → `src/ui/HeroCardRendering.ts`              | Regular, compact and Swedish; unit tests also cover IDs and hits.                      |
| `heroStatus`      | `src/ui/viewmodels/heroStatus.ts` → `src/ui/HeroStatusRendering.ts`           | English and Swedish; unit tests cover slot/item/use/close hits.                        |
| `monsterCards`    | `src/ui/viewmodels/monsterCards.ts` → `src/ui/MonsterCardRendering.ts`        | Regular snapshot; compact visibility is unit-tested.                                   |
| `dungeonIntro`    | `src/ui/viewmodels/dungeonIntro.ts` → `src/ui/DungeonIntroRendering.ts`       | Shown-modal snapshot; visibility/dismissal are unit-tested.                            |
| `saveLoadDialog`  | `src/ui/viewmodels/saveLoadDialog.ts` → `src/ui/SaveLoadDialogRendering.ts`   | Save and load snapshots; layout and hits are unit-tested.                              |
| `newGameDialog`   | `src/ui/viewmodels/newGameDialog.ts` → `src/ui/NewGameDialogRendering.ts`     | Selected campaign/speedrun/seed snapshot; layout and hits are unit-tested.             |
| `heroSelection`   | `src/ui/viewmodels/heroSelection.ts` → `src/ui/HeroSelectionRendering.ts`     | Selected roster/edited name snapshot; rename and party-limit behavior are unit-tested. |
| `eventCard`       | `src/ui/viewmodels/eventCard.ts` → `src/ui/EventCardRendering.ts`             | Active regular card; collapsed/compact and toggle hits are unit-tested.                |
| `diary`           | `src/ui/viewmodels/diary.ts` → `src/ui/DiaryAndWinConditionRendering.ts`      | Collapsed and regular; condition/note ordering and compact toggle are unit-tested.     |
| `betweenDungeons` | `src/ui/viewmodels/betweenDungeons.ts` → `src/ui/BetweenDungeonsRendering.ts` | Level-up and campaign-complete; trade/party-wipe behavior is unit-tested.              |

Rendering parity currently covers at least one state for every screen, but
not every state: `monsterCards` has no compact snapshot, `eventCard` has no
collapsed/compact snapshot, and `betweenDungeons` has no trade or party-wipe
snapshot. The parity suite records drawing operations, not hit results or
controller effects. The user approved updating snapshots after reviewing
composition differences as intentional; verify geometry and semantics with
facade tests and update only the reviewed entries.

### Composition gaps to close before porting

The current DSL already offers row/column/stack/panel containers, generic
buttons, checkboxes, text inputs, meters, and theme-backed `AssetId` images.
The ten current renderers additionally require full-bounds scrims, divider
lines, strikethrough, arbitrary positioned visuals, hit-only targets, and
conditional sprite-to-icon fallback. The first migration attempt stopped
without edits because these could not be represented by the original node
set. Step 6 added generic, data-only capabilities. The user has approved
reviewed snapshot updates for composition-backed visuals; do not add
arbitrary consumer render callbacks or game-domain types.

## Plan (based on reuse, not a broad rewrite)

1. Inventory consumer use and establish the `Welcome` baseline. **Done.**
2. Add the recursive composition DSL and its contracts. **Done.**
3. Validate the DSL with the consumer `Welcome` screen. **Done.**
4. Document initial package-boundary findings. **Done; superseded by the
   migration decision above.**
5. Map the ten screen migrations, adapters, and parity gates. **Done.**
6. Add only the generic DSL capabilities required by the mapped screens.
   **Done:** text wrapping/clipping, clip-aware hits, typed theme styling,
   sprite-frame images, fills/scrims, divider lines, strikethrough, offsets,
   hit-only targets, and image fallback text are covered by composition
   tests.
7. Reimplement the ten screens in consumer-owned composition trees.
   **Done:** all ten facades use composition trees and retain their semantic
   hit behavior. The `newgamedialog` and `heroselection` snapshots were
   updated only to remove invisible empty-label draw calls.
8. Remove their UIKit source modules/exports, update docs, and verify both
   repositories against the reviewed consumer snapshots. **Done.**

Preserve the generic three-function component contracts, semantic action
identifiers, theme token usage and the `@hoard-engine/primitives`
dependency boundary. Further visual changes outside the approved
composition migration need user approval and consumer regression coverage.
