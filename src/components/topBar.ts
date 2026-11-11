// The top status bar component: menu button, latest log chip, score /
// timer / turn chips and the open log dropdown. Kit component per the
// 02 contract: the view model carries the texts (labels prebuilt by the
// game-side adapter), layout is canvas-free (it measures through
// `env.measure`), hit testing consumes the same layout, and rendering
// consumes layout + view model + context.

import type { Rect } from '@hoard-engine/primitives';
import { composeFont, isPointInRect } from '@hoard-engine/primitives';
import type { UiContext, UiEnv } from '../env';
import { type CompositionNode, layoutComposition, renderComposition, } from './composition';

export interface TopBarViewModel {
  readonly menuLabel: string;
  readonly debugLabel: string;
  /** Whether the debug chip is shown. */
  readonly showDebug: boolean;
  readonly turnText: string;
  readonly scoreText: string;
  /** Speedrunner mode: the live timer chip is shown. */
  readonly isSpeedrun: boolean;
  /** Live dungeon timer text; '' when the timer has not started. */
  readonly timerText: string;
  /** Fixed text the timer chip reserves width for. */
  readonly timerTemplateText: string;
  /** Counter width reservations in compact mode; '' in regular mode. */
  readonly turnTemplateText: string;
  readonly scoreTemplateText: string;
  readonly logText: string;
  readonly logEntries: readonly string[];
}

export interface TopBarElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TopBarLayout {
  topBar: TopBarElementBounds;
  menuButton: TopBarElementBounds;
  debugButton?: TopBarElementBounds;
  logSection: TopBarElementBounds;
  scoreCounter: TopBarElementBounds;
  /** Live dungeon timer chip; present only in speedrunner mode. */
  timerCounter?: TopBarElementBounds;
  turnCounter: TopBarElementBounds;
  logDropdown: TopBarElementBounds;
}

export type TopBarHitElement =
  'menu' | 'debug' | 'log' | 'turn' | 'logDropdown' | null;

export interface TopBarLayoutOptions {
  /** Overrides the view model's debug chip visibility decision. */
  readonly debugMode?: boolean;
}

/** Chip font shared by every top bar element. */
const chipFont = (env: UiEnv): string =>
  composeFont(
    env.theme,
    env.theme.typography.sizes.lg,
    env.theme.typography.weights.regular,
    env.theme.typography.families.plain,
  );

// On narrow screens the counters shrink to an emoji plus the number, so
// each chip only needs room for the icon plus its digits.
const TURN_COUNTER_FALLBACK_WIDTH = 80;
const SCORE_COUNTER_FALLBACK_WIDTH = 70;

export const layoutTopBar = (
  vm: TopBarViewModel,
  viewBounds: Rect,
  env: UiEnv,
  options?: TopBarLayoutOptions,
): TopBarLayout => {
  const font = chipFont(env);
  const measure = (text: string, withFont: string): number =>
    env.measure.width(text, withFont);
  const viewWidth = viewBounds.width;

  const margin = 8;
  const top = 8;
  const height = 32;
  const gap = 8;
  const paddingX = 12;

  const showDebug =
    options?.debugMode !== undefined ? options.debugMode : vm.showDebug;

  const menuTextWidth = measure(vm.menuLabel, font);
  const menuWidth = Math.max(48, Math.round(menuTextWidth + paddingX * 2));

  const debugTextWidth = measure(vm.debugLabel, font);
  const debugWidth = showDebug
    ? Math.max(48, Math.round(debugTextWidth + paddingX * 2))
    : 0;

  const compact = env.mode === 'compact';
  const counterPaddingX = compact ? 6 : paddingX;

  let turnCounterWidth: number;
  let scoreCounterWidth: number;
  if (compact) {
    // The view model's template texts reserve room for the icon plus two
    // round digits / five score digits, so the chips do not resize
    // whenever the numbers tick up.
    const turnTemplateWidth = measure(vm.turnTemplateText, font);
    const scoreTemplateWidth = measure(vm.scoreTemplateText, font);
    turnCounterWidth = Math.round(
      Math.max(turnTemplateWidth, measure(vm.turnText, font)) +
        counterPaddingX * 2,
    );
    scoreCounterWidth = Math.round(
      Math.max(scoreTemplateWidth, measure(vm.scoreText, font)) +
        counterPaddingX * 2,
    );
  } else {
    const tenCharsWidth = measure('0123456789', font);
    const turnTextWidth = measure(vm.turnText, font);
    // Ensure enough space for at least 10 characters
    turnCounterWidth = Math.max(
      Math.round(tenCharsWidth + paddingX * 2),
      Math.round(turnTextWidth + paddingX * 2),
      TURN_COUNTER_FALLBACK_WIDTH,
    );
    scoreCounterWidth = Math.max(
      Math.round(measure(vm.scoreText, font) + paddingX * 2),
      SCORE_COUNTER_FALLBACK_WIDTH,
    );
  }

  // Speedrunner HUD: the live dungeon timer sits left of the score chip.
  const isSpeedrun = vm.isSpeedrun;
  const timerCounterWidth = isSpeedrun
    ? Math.max(
        Math.round(measure(vm.timerTemplateText, font) + paddingX * 2),
        80,
      )
    : 0;

  const menuX = margin;
  const debugX = menuX + menuWidth + gap;
  const logX = showDebug ? debugX + debugWidth + gap : menuX + menuWidth + gap;
  const turnX = Math.max(logX, viewWidth - margin - turnCounterWidth);
  const scoreX = Math.max(logX, turnX - gap - scoreCounterWidth);
  const timerX = isSpeedrun
    ? Math.max(logX, scoreX - gap - timerCounterWidth)
    : scoreX;
  const logWidth = Math.max(0, timerX - gap - logX);

  const logItemHeight = 20;
  const logPaddingY = 6;
  const dropdownHeight =
    vm.logEntries.length > 0
      ? logPaddingY * 2 + vm.logEntries.length * logItemHeight
      : 0;
  return {
    topBar: {
      x: margin,
      y: top,
      width: Math.max(0, viewWidth - margin * 2),
      height,
    },
    menuButton: { x: menuX, y: top, width: menuWidth, height },
    ...(showDebug
      ? {
          debugButton: {
            x: debugX,
            y: top,
            width: debugWidth,
            height,
          },
        }
      : {}),
    logSection: { x: logX, y: top, width: logWidth, height },
    scoreCounter: { x: scoreX, y: top, width: scoreCounterWidth, height },
    ...(isSpeedrun
      ? {
          timerCounter: {
            x: timerX,
            y: top,
            width: timerCounterWidth,
            height,
          },
        }
      : {}),
    turnCounter: { x: turnX, y: top, width: turnCounterWidth, height },
    logDropdown: {
      x: logX,
      y: top + height + 4,
      width: logWidth,
      height: dropdownHeight,
    },
  };
};

export const hitTestTopBar = (
  layout: TopBarLayout,
  point: { x: number; y: number },
  isLogOpen = false,
): TopBarHitElement => {
  if (isPointInRect(point.x, point.y, layout.menuButton)) return 'menu';
  if (
    layout.debugButton &&
    layout.debugButton.width > 0 &&
    isPointInRect(point.x, point.y, layout.debugButton)
  ) {
    return 'debug';
  }
  if (isPointInRect(point.x, point.y, layout.logSection)) return 'log';
  if (isPointInRect(point.x, point.y, layout.turnCounter)) return 'turn';
  if (
    isLogOpen &&
    layout.logDropdown.height > 0 &&
    isPointInRect(point.x, point.y, layout.logDropdown)
  ) {
    return 'logDropdown';
  }
  return null;
};

export interface RenderTopBarOptions {
  isMenuHovered?: boolean;
  isDebugHovered?: boolean;
  isLogHovered?: boolean;
  isLogOpen?: boolean;
}

const positioned = (node: CompositionNode, bounds: Rect): CompositionNode => ({
  ...node,
  width: bounds.width,
  height: bounds.height,
  alignSelf: 'start',
  justifySelf: 'start',
  offsetX: bounds.x,
  offsetY: bounds.y,
});

export const renderTopBar = (
  layout: TopBarLayout,
  vm: TopBarViewModel,
  ui: UiContext,
  options?: RenderTopBarOptions,
): void => {
  const { ctx } = ui;
  if (!ctx || layout.topBar.width <= 0) return;

  const isMenuHovered = options?.isMenuHovered ?? false;
  const isDebugHovered = options?.isDebugHovered ?? false;
  const isLogHovered = options?.isLogHovered ?? false;
  const isLogOpen = options?.isLogOpen ?? false;

  const children: CompositionNode[] = [];
  const addChip = (
    bounds: Rect,
    text: string,
    surface: keyof UiContext['theme']['palette']['surface'],
    border: keyof UiContext['theme']['palette']['border'],
    textToken: keyof UiContext['theme']['palette']['text'],
  ): void => {
    if (bounds.width <= 0) return;
    children.push(
      positioned(
        {
          type: 'fill',
          shape: 'roundedRect',
          themeStyle: {
            surface,
            border,
            strokeWidth: 'thin',
            radius: 4,
            roundedRectMode: 'native',
          },
        },
        bounds,
      ),
      positioned(
        {
          type: 'text',
          text,
          align: 'center',
          baseline: 'middle',
          themeStyle: {
            text: textToken,
            fontSize: 'lg',
            fontFamily: 'plain',
            textOrder: 'colorFirst',
          },
        },
        bounds,
      ),
    );
  };

  const menu = layout.menuButton;
  addChip(
    menu,
    vm.menuLabel,
    isMenuHovered ? 'itemHover' : 'item',
    isMenuHovered ? 'soft' : 'subtle',
    'bright',
  );
  if (layout.debugButton) {
    addChip(
      layout.debugButton,
      vm.debugLabel,
      isDebugHovered ? 'itemHover' : 'item',
      isDebugHovered ? 'soft' : 'subtle',
      'bright',
    );
  }

  const log = layout.logSection;
  if (log.width > 0) {
    children.push(
      positioned(
        {
          type: 'fill',
          shape: 'roundedRect',
          themeStyle: {
            surface: isLogOpen
              ? 'hudLogOpen'
              : isLogHovered
                ? 'hudLogHover'
                : 'hudLog',
            border: isLogOpen
              ? 'hudLogOpen'
              : isLogHovered
                ? 'hudLogHover'
                : 'hudLog',
            strokeWidth: 'thin',
            radius: 4,
            roundedRectMode: 'native',
          },
        },
        log,
      ),
    );
    if (vm.logText) {
      children.push(
        positioned(
          {
            type: 'text',
            text: vm.logText,
            align: 'left',
            baseline: 'middle',
            clip: true,
            clipOrder: 'clipFirst',
            textInsetX: 6,
            truncateWidth: log.width - 16,
            truncateMaxCharacters: 8,
            themeStyle: {
              text: 'success',
              fontSize: 'md',
              fontFamily: 'mono',
              textOrder: 'colorFirst',
            },
          },
          { x: log.x + 2, y: log.y, width: log.width - 4, height: log.height },
        ),
      );
    }
  }

  addChip(layout.scoreCounter, vm.scoreText, 'item', 'hudScore', 'hudScore');
  if (layout.timerCounter) {
    addChip(layout.timerCounter, vm.timerText, 'item', 'hudTimer', 'success');
  }
  addChip(layout.turnCounter, vm.turnText, 'item', 'subtle', 'body');

  const dropdown = layout.logDropdown;
  if (isLogOpen && dropdown.width > 0 && vm.logEntries.length > 0) {
    children.push(
      positioned(
        {
          type: 'fill',
          shape: 'roundedRect',
          themeStyle: {
            surface: 'hudDropdown',
            border: 'hudLog',
            strokeWidth: 'thin',
            radius: 4,
            roundedRectMode: 'native',
          },
        },
        dropdown,
      ),
    );
    vm.logEntries.forEach((entry, index) => {
      const itemY = dropdown.y + 6 + index * 20;
      children.push(
        positioned(
          {
            type: 'text',
            text: entry,
            align: 'left',
            baseline: 'middle',
            clip: true,
            clipOrder: 'clipFirst',
            textInsetX: 6,
            truncateWidth: dropdown.width - 16,
            truncateMaxCharacters: 8,
            themeStyle: {
              text: index === 0 ? 'success' : 'hudLogEntry',
              fontSize: 'md',
              fontFamily: 'mono',
              textOrder: 'colorFirst',
            },
          },
          {
            x: dropdown.x + 2,
            y: itemY,
            width: dropdown.width - 4,
            height: 20,
          },
        ),
      );
    });
  }

  const width = Math.max(
    layout.topBar.x + layout.topBar.width,
    dropdown.x + (isLogOpen ? dropdown.width : 0),
  );
  const height = Math.max(
    layout.topBar.y + layout.topBar.height,
    dropdown.y + (isLogOpen ? dropdown.height : 0),
  );
  ctx.save();
  renderComposition(
    layoutComposition(
      { type: 'stack', children },
      { x: 0, y: 0, width, height },
      ui,
    ),
    ui,
  );
  ctx.restore();
};
