# @hoard-engine/uikit

Theme-driven canvas UI chrome for the HOARD engine: the layout/hit
testing/rendering contract for view-model-driven components, five kit
widgets (modal frame, button, list row, text input, sprite frame), 14
full components (cards, panels, dialogs, menus), the `UiEnv`/`UiContext`
environment contracts, and the test harness subpath (recording context,
sentinel theme, literal budget). Everything it draws streams from the
theme tokens and translator/assets ports — a single deliberate
dependency edge into `@hoard-engine/primitives` (the two-consumer rule:
uikit and scene both draw), no game or framework knowledge anywhere.

## Pluggable, interoperable, standalone

HOARD engine packages share the same design goals:

- **Pluggable.** Adopt a package on its own, or swap it out, without
  touching the rest of the engine — there is no central engine object
  to install and no package that owns the others.
- **Interoperable.** Packages compose with each other and with
  consumer code through data: minimal shapes, callback seams and plain
  values — never through shared state or a common framework.
- **As standalone as possible.** Each package is usable as-is in any
  project, HOARD-based or not; the leaf packages carry no dependencies
  and import no siblings.

This package meets all three by construction.

## Install

```bash
npm install @hoard-engine/uikit
```

Requires Node 18+ (ESM only).

## Usage

```ts
import {
  // re-exported: the theme tokens and drawing primitives
  defaultTheme,
  resolveTheme,
  // the environment contracts
  LayoutMode,
  UiEnv,
  // a component: the three-function contract over a plain view model
  WelcomeViewModel,
  WelcomeHit,
  layoutWelcome,
  hitTestWelcome,
  renderWelcome,
  RenderWelcomeOptions,
} from '@hoard-engine/uikit';

// The theme is consumer data: merge overrides over the defaults.
const theme = resolveTheme({ palette: { text: { body: '#e2e8f0' } } });

// Everything a layout needs arrives through the env — no canvas, no
// game state. The consumer builds this (theme, width-derived layout
// mode, translator, measure).
const env: UiEnv = {
  theme,
  mode: 'regular' satisfies LayoutMode,
  t: (key, params) => translate(key, params), // key + params → string
  measure: { width: (text, font) => measureWidth(text, font) },
};

// The view model is plain, serializable data — prebuilt strings only.
const vm: WelcomeViewModel = {
  headerText: translate('welcome.header'),
  buttons: [
    { id: 'continue', label: translate('welcome.continue') },
    { id: 'newGame', label: translate('welcome.newGame') },
  ],
  footerText: translate('welcome.footer'),
  backgroundAssetId: 'welcome.background',
};

// Layout is pure geometry; hits are semantic ids; rendering draws
// through a UiContext (an env plus the canvas context and the asset
// port the consumer owns).
const view = { x: 0, y: 0, width: 1280, height: 720 };
const layout = layoutWelcome(vm, view);
const hit: WelcomeHit = hitTestWelcome(layout, { x: pointer.x, y: pointer.y });
const options: RenderWelcomeOptions = { hoveredButtonId: hit };
renderWelcome(layout, vm, { ...env, ctx, assets }, options);
```

The package never asks for your world state, your framework or your
asset paths — the consumer injects the theme, the translator, the text
measure, the canvas context, the asset provider (`AssetId` → loaded
image) and every view model; hit results come back as semantic ids for
the consumer to map onto its entities.

## API

The index re-exports the full `@hoard-engine/primitives` surface
(`UiTheme`, `DeepPartial`, `defaultTheme`, `resolveTheme`, `composeFont`,
`measureTextWidth`, `truncateText`, `wrapText`, `wrapTextMeasured`,
`PER_CHAR_WIDTH_FALLBACK`, `Point`, `Rect`, `isPointInRect`,
`drawRoundedRect`, `roundRectPath`) so one import covers theme and
geometry; see that package's README for their semantics.

| Export                                                                                     | Description                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UiEnv` / `UiContext`                                                                      | What a layout/render function needs: theme, layout mode, translator, measure — the context adds the canvas (`ctx`) and the asset port                                          |
| `Translator` / `TextMeasure` / `AssetProvider` / `AssetId`                                 | The consumer-provided ports: message key + params → string; canvas-free text width; `AssetId` → loaded image                                                                       |
| `LayoutMode` / `COMPACT_TOGGLE_SIZE`                                                        | Width-derived density (`'regular'` \| `'compact'`); the square a collapsed compact panel collapses into (shared with the consumer's UI mode)                                   |
| `SpriteRef`                                                                                | A sprite frame on a sheet asset: `{ assetId, index, size }` — row-major square frames, resolved through the asset port                                                          |
| `BUTTON_RADIUS` / `ButtonVariant` / `DrawButtonOptions`                                    | The button widget: primary/secondary variants with hover, radius constant, and the draw options the consumers extend                                                          |
| `drawButton`                                                                               | Draws a themed button (variant, hover, enabled state, label, bounds) through a context                                                                                          |
| `LIST_ROW_RADIUS` / `ListRowStyles` / `ListRowState` / `listRowStyles` / `rowState`         | The list-row widget: the style lookup and state machine (`'normal'`/`hover`/`selected`/`disabled`) rows share                                                                    |
| `drawListRow`                                                                              | Draws a themed list row (row state, styles, label, value, bounds) through a context                                                                                            |
| `MODAL_PANEL_RADIUS` / `MODAL_HEADER_OFFSET_X` / `MODAL_HEADER_OFFSET_Y`                   | The modal-frame widget's dimensional constants (shared with the game's legacy renderer parity)                                                                                |
| `drawDialogScrim` / `drawModalFrame` / `drawModalHeader`                                    | The modal-frame widget: the scrim, the panel, the header — over theme surfaces and borders                                                                                     |
| `drawSpriteFrame` / `spriteSourceRect`                                                      | The sprite-frame widget: resolves a `SpriteRef` through the asset port (returns `false` while loading, so the caller draws its fallback) and computes the sheet sub-rectangle     |
| `TEXT_INPUT_INSET` / `TEXT_INPUT_RADIUS` / `DrawTextInputOptions`                            | The text-input widget's dimension constants and draw options                                                                                                                    |
| `drawTextInput` / `clampTextInput` / `applyTextInputKey`                                    | The text-input widget: draws the field, clamps a value to the maxLength, applies a key press (`value`, cursor and caret movement rules)                                          |
| `TopBarViewModel`                                                                           | The top bar data: menu/debug labels, turn/score/timer texts, compact width reservations, log entries                                                                        |
| `TopBarLayoutOptions` / `TopBarElementBounds` / `TopBarLayout` / `layoutTopBar`              | The top bar geometry: layout options, per-element bounds, pure layout over the view bounds and env                                                                          |
| `renderTopBar` / `RenderTopBarOptions` / `hitTestTopBar` / `TopBarHitElement`                 | Draws the top bar; semantic hits: `'menu'`, `'debug'`, `'log'`, `'logDropdown'`, `'turn'`                                                                                      |
| `HeroCardsViewModel` / `HeroCardVm` / `HeroInventoryVm` / `HeroInventoryItemVm`             | The party card stack: hero cards and the open inventory rows (use-button state, sprite refs, use/used labels)                                                                    |
| `HeroCardsLayout` / `HeroCardLayoutItem` / `HeroInventoryLayout` / `HeroInventoryItemLayout` | The card-stack geometry: per-card and per-row bounds, computed by `layoutHeroCards`                                                                                          |
| `renderHeroCards` / `RenderHeroCardsOptions` / `hitTestHeroCards` / `HeroCardsHit` / `HeroCardSpriteRef` | Draws the cards; semantic hits: `card`, `inventory`, `inventoryButton`, `inventoryClose`, `inventoryUseItem` (hero id + item index)                                      |
| `MonsterCardsViewModel` / `MonsterCardsLayout` / `MonsterCardLayoutItem`                      | The monster cards: visible monsters with HP, weapon/armour/shield texts, ranged flag, actor colour; per-card layout via `layoutMonsterCards`                                   |
| `renderMonsterCards` / `RenderMonsterCardsOptions` / `hitTestMonsterCards` / `MonsterCardsHit` | Draws the monster cards; semantic hits: `card` (card id)                                                                                                                       |
| `DungeonIntroViewModel` / `DungeonIntroLayout`                                              | The dungeon intro panel: title, intro text, close label, and its layout (`layoutDungeonIntro`, `emptyDungeonIntroLayout`)                                                       |
| `renderDungeonIntro` / `RenderDungeonIntroOptions` / `hitTestDungeonIntro` / `DungeonIntroHit` | Draws the intro; semantic hits: `close`, `panel`, `backdrop`                                                                                                                   |
| `MenuViewModel` / `MenuItemVm` / `MenuLayout` / `MenuItemLayout`                              | A generic menu (the originating game routes its debug menu through it): header, items, footer; layout via `layoutMenu`                                                          |
| `renderMenu` / `RenderMenuOptions` / `hitTestMenu` / `MenuHit`                              | Draws the menu; semantic hits: `item` (item id), `panel`, `backdrop`                                                                                                           |
| `WelcomeViewModel` / `WelcomeButtonVm` / `WelcomeLayout` / `WelcomeButtonLayout`            | The welcome screen: header, buttons (Continue/Save only while a run is ongoing), footer, background asset id                                                                    |
| `layoutWelcome` / `renderWelcome` / `renderWelcomeBackground` / `renderWelcomeFooter` / `getCoverFitBounds` / `RenderWelcomeOptions` / `hitTestWelcome` / `WelcomeHit` | Layout, render (whole, or background and footer layers separately), the cover-fit background bounds computation, render options (hover, background override), hit test over button ids — hits are the button ids themselves |
| `SaveLoadDialogMode` / `SaveLoadDialogViewModel` / `SaveLoadDialogRowVm` / `SaveLoadDialogMode`-owned modes | The save/load dialog: mode, title/subtitle, save rows, button labels; rows and their layout (`layoutSaveLoadDialog`, `SaveLoadDialogLayout`, `SaveLoadDialogRowLayout`, `emptySaveLoadDialogLayout`) |
| `renderSaveLoadDialog` / `RenderSaveLoadDialogOptions` / `hitTestSaveLoadDialog` / `SaveLoadDialogHit` | Draws the dialog; semantic hits: `row`, `action`, `secondary`, `input`, `panel`, `backdrop`                                                                                   |
| `NewGameDialogViewModel` / `NewGameDialogRowVm` / `NewGameDialogLayout` / `NewGameDialogRowLayout` | The new-game dialog: titles, campaign/game-master rows, checkbox and seed labels, button labels (`layoutNewGameDialog`, `emptyNewGameDialogLayout`)                             |
| `renderNewGameDialog` / `RenderNewGameDialogOptions` / `hitTestNewGameDialog` / `NewGameDialogHit` | Draws the dialog; semantic hits: `campaign`, `gameMaster`, `checkbox`, `seedInput`, `action`, `secondary`, `panel`, `backdrop`                                                  |
| `HeroSelectionViewModel` / `HeroSelectionRowVm` / `HeroSelectionLayout` / `HeroSelectionRowLayout` | The hero selection: roster (ids, default names, colours), party limits, button labels (`layoutHeroSelection`, `emptyHeroSelectionLayout`)                                     |
| `renderHeroSelection` / `RenderHeroSelectionOptions` / `hitTestHeroSelection` / `HeroSelectionHit` | Draws the selection; semantic hits: `checkbox`, `nameInput`, `row` (hero id), `start`, `back`, `panel`, `backdrop`                                                              |
| `SettingsViewModel` / `SettingsRowVm` / `SettingsRowKind` / `SettingsLayout` / `SettingsRowLayout` / `SettingsSliderLayout` | The settings panel: toggle/slider/button rows with values and dimmed flags; slider geometry for hit mapping (`layoutSettings`)                                                |
| `renderSettings` / `RenderSettingsOptions` / `hitTestSettings` / `SettingsHit` / `getSliderValueFromX` | Draws settings (and maps a pointer x to a slider value); semantic hits: `toggle`, `slider`, `button` (row id), `back`, `panel`, `backdrop`                                    |
| `CreditsViewModel` / `CreditsRowVm` / `CreditsLayout` / `CreditsRowLayout`                   | The credits panel: rows with urls (`layoutCredits`)                                                                                                                            |
| `renderCredits` / `RenderCreditsOptions` / `hitTestCredits` / `CreditsHit`                   | Draws the credits; semantic hits: `row`, `back`                                                                                                                                |
| `EventCardViewModel` / `EventDeckSummaryVm` / `ActiveEventVm` / `DrawnEventVm`               | The event card: deck summary, active event texts, drawn-event titles                                                                                                           |
| `EventCardLayoutOptions` / `EventCardLayout` / `ActiveEventLayout` / `DrawnEventItemLayout` / `layoutEventCard` / `emptyEventCardLayout` | The event card geometry: the active event, the deck list and the toggle — several components export an `empty<Name>Layout` so an absent layout can be hit-tested without a canvas |
| `renderEventCard` / `RenderEventCardOptions` / `hitTestEventCard` / `EventCardHit`           | Draws the event card; semantic hits: `toggle`, `card`                                                                                                                          |
| `DiaryViewModel` / `WinConditionItemVm` / `DiaryNoteItemVm` / `DiaryNoteItemLayout` / `WinConditionItemLayout` | The diary panel: header, win-condition texts with fulfilled flags, found notes; layout options and geometry over both sections (`layoutDiary`, `DiaryLayout`, `DiaryLayoutOptions`, `emptyDiaryLayout`) |
| `renderDiary` / `RenderDiaryOptions` / `hitTestDiary` / `DiaryHit`                           | Draws the diary; semantic hits: `panel`, `toggle`                                                                                                                             |
| `BetweenDungeonsStep` / `ActorColourKey` / `BetweenDungeonsViewModel`                        | The between-dungeons screen: step (`levelUp`/`trade`/`campaignComplete`/`partyWipe`), titles, score texts, statistics, wipe choices, hero sections, tradable items             |
| `CampaignCompleteVm` / `CampaignCompleteScenarioRowVm` / `CampaignCompleteHeroRowVm` / `PartyWipeVm` / `WipeChoiceVm` / `WipeHighScoresVm` / `HighScoreRowVm` / `PartyWipeScoreRow` / `HeroSectionVm` / `TradeItemVm` / `GiveButtonLayoutItem`-shared types | The step's nested view models: campaign-complete scenarios and hero rows, wipe choices and ranked high scores, hero sections with tradable items                                |
| `BetweenDungeonsLayout` / `ScoreSectionLayout` / `CampaignCompleteLayout` / `CampaignCompleteScenarioRow` / `CampaignCompleteHeroRow` / `PartyWipeButtonLayout` / `PartyWipeHighScoresLayout` / `HeroSectionLayoutItem` / `TradeItemLayoutItem` / `emptyBetweenDungeonsLayout` | The between-dungeons geometry — per-step section layouts and row items, computed by `layoutBetweenDungeons`                                                               |
| `renderBetweenDungeons` / `RenderBetweenDungeonsOptions` / `hitTestBetweenDungeons` / `BetweenDungeonsHit` | Draws the screen; semantic hits: `actionButton`, `secondaryButton`, `item`, `giveItem`, `wipeButton`, `panel`, `backdrop`                                                        |
| `RadialMenuViewModel` / `RadialButtonVm` / `RadialMenuLayout` / `RadialButtonItemLayout`    | The radial menu: ring origin (grid coords), ring buttons with label, icon and sprite ref (`layoutRadialMenu`, `emptyRadialMenuLayout`, `renderRadialTooltip`)                  |
| `renderRadialMenu` / `RenderRadialMenuOptions` / `hitTestRadialMenu` / `RadialMenuHit`       | Draws the ring and its tooltip; semantic hits: `button` (button index)                                                                                                         |

The `./testing` subpath export (import as `@hoard-engine/uikit/testing`):

| Export                | Description                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `createRecordingContext` | A recording stand-in for `CanvasRenderingContext2D` that logs every call and style write deterministically |
| `createSentinelTheme`  | A theme whose every string token is a unique marker — any leaked style literal fails the render test       |
| `countStyleLiterals`   | Counts color and font string literals in source code, for budget suites (fails in both directions)         |

## Design notes

- **View models in, semantic hits out.** Components read only plain,
  serializable view models (strings are prebuilt; the component never
  translates) and return semantic ids (`{ kind: 'card', cardId }`,
  hero ids, row indices) — the consumer maps ids back to entities.
  Selection and step state the consumer owns travels as layout/render
  *options*; smoke values like hover are computed, not stored.
- **The three-function contract.** `layout*` is pure geometry over the
  view model and a view `Rect` (canvas-free, measured through
  `env.measure`); `hitTest*` maps a point onto semantic ids; `render*`
  draws through `UiContext`. Several modules export an
  `empty<Name>Layout` so an absent layout can be hit-tested without a
  canvas.
- **Positioning on the single dependency edge.** The theme tokens and
  the text/geometry/clipping primitives live in
  `@hoard-engine/primitives` and are re-exported here so a consumer
  imports once; the future `scene` package consumes primitives
  directly, never this package.
- **No defaults that leak.** The kit ships no default strings, no
  asset paths and no hand-rolled fallback chrome — a missing asset
  draws the themed fallback the component defines.
- **Locale-aware repaint.** `UiEnv.t` is built per update by the
  consumer; render signature identity (env, theme) decides repaints.

## Development

```bash
npm test          # vitest
npm run check     # tsc --noEmit
npm run lint      # eslint over src
npm run prettier  # prettier --check (fix via prettier:format)
npm run build     # tsc declarations + esbuild ESM bundle to dist/
npm publish       # prepublishOnly runs check + build + test first
```
