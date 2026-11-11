// Radial menu component: the circular action menu that opens around a
// hero — a ring of buttons with icons (item sprites through the asset
// port, emoji icons otherwise) and a tooltip for the hovered one. Kit
// component per the 02 contract — the view model carries the ring origin
// (grid coords) and the buttons with labels, icons and sprite refs
// prebuilt by the game-side adapter; the layout is pure geometry; hits
// are semantic button ids.

import type { Rect } from '@hoard-engine/primitives';
import { composeFont } from '@hoard-engine/primitives';
import type { SpriteRef, UiContext } from '../env';
import {
  layoutComposition,
  renderComposition,
  type CompositionNode,
} from './composition';

export interface RadialButtonVm {
  /** Hit-test identity: the button's index in the ring. */
  readonly id: number;
  readonly label: string;
  readonly icon: string;
  /** Item art, drawn through the asset port when set. */
  readonly sprite?: SpriteRef;
}

export interface RadialMenuViewModel {
  /** The cell the menu opened on, in grid coords. */
  readonly origin: { readonly x: number; readonly y: number };
  readonly buttons: readonly RadialButtonVm[];
}

export interface RadialButtonItemLayout {
  button: RadialButtonVm;
  x: number;
  y: number;
  radius: number;
}

export interface RadialMenuLayout {
  centerX: number;
  centerY: number;
  items: RadialButtonItemLayout[];
}

/** Semantic hit: which ring button is under the point. */
export type RadialMenuHit = { kind: 'button'; id: number } | null;

export const emptyRadialMenuLayout = (): RadialMenuLayout => ({
  centerX: 0,
  centerY: 0,
  items: [],
});

export const layoutRadialMenu = (
  vm: RadialMenuViewModel | null,
  cellSize: number,
): RadialMenuLayout => {
  if (!vm || vm.buttons.length === 0) return emptyRadialMenuLayout();

  const centerX = vm.origin.x * cellSize + cellSize / 2;
  const centerY = vm.origin.y * cellSize + cellSize / 2;
  const ringRadius = cellSize * 1.1;
  const buttonRadius = Math.max(16, cellSize * (16 / 48));

  return {
    centerX,
    centerY,
    items: vm.buttons.map((button, i) => {
      const angle = (i / vm.buttons.length) * 2 * Math.PI - Math.PI / 2;
      return {
        button,
        x: centerX + ringRadius * Math.cos(angle),
        y: centerY + ringRadius * Math.sin(angle),
        radius: buttonRadius,
      };
    }),
  };
};

export const hitTestRadialMenu = (
  layout: RadialMenuLayout,
  point: { x: number; y: number },
): RadialMenuHit => {
  for (const item of layout.items) {
    const dx = point.x - item.x;
    const dy = point.y - item.y;
    if (Math.hypot(dx, dy) <= item.radius) {
      return { kind: 'button', id: item.button.id };
    }
  }
  return null;
};

export interface RenderRadialMenuOptions {
  /** The hovered button id, for the highlight and the tooltip. */
  readonly hoveredId?: number | null;
}

const positioned = (
  node: CompositionNode,
  bounds: { x: number; y: number; width: number; height: number },
  originX = 0,
  originY = 0,
): CompositionNode => ({
  ...node,
  width: bounds.width,
  height: bounds.height,
  alignSelf: 'start',
  justifySelf: 'start',
  offsetX: bounds.x - originX,
  offsetY: bounds.y - originY,
});

const getTooltipBounds = (
  ctx: CanvasRenderingContext2D,
  theme: UiContext['theme'],
  button: { x: number; y: number; radius: number; label: string },
  saveContext = true,
): { x: number; y: number; width: number; height: number } => {
  const font = composeFont(
    theme,
    theme.typography.sizes.md,
    theme.typography.weights.regular,
    theme.typography.families.compact,
  );
  if (saveContext) ctx.save();
  ctx.font = font;
  const textWidth =
    typeof ctx.measureText === 'function'
      ? ctx.measureText(button.label).width
      : button.label.length * 7;
  if (saveContext) ctx.restore();
  const width = textWidth + 16;
  const height = 20;
  return {
    x: button.x - width / 2,
    y: button.y - button.radius - height - 4,
    width,
    height,
  };
};

const tooltipNodes = (
  button: { x: number; y: number; radius: number; label: string },
  bounds: Rect,
  originX: number,
  originY: number,
): CompositionNode[] => [
  positioned(
    {
      type: 'fill',
      shape: 'roundedRect',
      themeStyle: {
        overlay: 'tooltip',
        border: 'soft',
        strokeWidth: 'thin',
        radius: 4,
        roundedRectMode: 'native',
        shapeStyleOrder: 'allStylesFirst',
      },
    },
    bounds,
    originX,
    originY,
  ),
  positioned(
    {
      type: 'text',
      text: button.label,
      align: 'center',
      baseline: 'middle',
      skipFontWrite: true,
      themeStyle: {
        text: 'bright',
        fontSize: 'md',
        fontFamily: 'compact',
        textOrder: 'colorFirst',
      },
    },
    bounds,
    originX,
    originY,
  ),
];

export const renderRadialMenu = (
  layout: RadialMenuLayout,
  ui: UiContext,
  options?: RenderRadialMenuOptions,
): void => {
  const { ctx } = ui;
  if (!ctx || layout.items.length === 0) return;
  const hoveredId = options?.hoveredId;
  const hoveredButton =
    hoveredId !== undefined && hoveredId !== null && hoveredId >= 0
      ? layout.items.find((item) => item.button.id === hoveredId)
      : undefined;
  const minX = Math.min(...layout.items.map((item) => item.x - item.radius));
  const minY = Math.min(...layout.items.map((item) => item.y - item.radius));
  const maxX = Math.max(...layout.items.map((item) => item.x + item.radius));
  const maxY = Math.max(...layout.items.map((item) => item.y + item.radius));
  const rootBounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
  const children: CompositionNode[] = layout.items.flatMap((item) => {
    const isHovered = hoveredId === item.button.id;
    const circle = {
      x: item.x - item.radius,
      y: item.y - item.radius,
      width: item.radius * 2,
      height: item.radius * 2,
    };
    const iconStyle = {
      text: 'bright' as const,
      fontSize: 'md' as const,
      fontScale: Math.round(item.radius) / ui.theme.typography.sizes.md,
      fontFamily: 'plain' as const,
      textOrder: 'colorFirst' as const,
    };
    const icon = item.button.sprite
      ? positioned(
          {
            type: 'image',
            sprite: item.button.sprite,
            fallback: 'none',
            fallbackText: item.button.icon,
            themeStyle: iconStyle,
          },
          {
            x: item.x - Math.round(item.radius * 0.75),
            y: item.y - Math.round(item.radius * 0.75),
            width: Math.round(item.radius * 1.5),
            height: Math.round(item.radius * 1.5),
          },
          rootBounds.x,
          rootBounds.y,
        )
      : positioned(
          {
            type: 'text',
            text: item.button.icon,
            align: 'center',
            baseline: 'middle',
            themeStyle: iconStyle,
          },
          circle,
          rootBounds.x,
          rootBounds.y,
        );
    return [
      positioned(
        {
          type: 'fill',
          shape: 'circle',
          themeStyle: {
            fillColor: isHovered
              ? ui.theme.palette.hover.radialFill
              : ui.theme.palette.overlay.scrimStrong,
            strokeColor: isHovered
              ? ui.theme.palette.border.ringHover
              : ui.theme.palette.border.ring,
            strokeWidth: 'regular',
            strokeStyleOrder: 'widthFirst',
          },
        },
        circle,
        rootBounds.x,
        rootBounds.y,
      ),
      icon,
    ];
  });
  ctx.save();
  renderComposition(
    layoutComposition({ type: 'stack', children }, rootBounds, ui),
    ui,
  );
  if (hoveredButton) {
    renderRadialTooltip(
      ctx,
      {
        x: hoveredButton.x,
        y: hoveredButton.y,
        radius: hoveredButton.radius,
        label: hoveredButton.button.label,
      },
      ui.theme,
    );
  }
  ctx.restore();
};

/**
 * The hovered button's tooltip: a small centered box above the button.
 */
export const renderRadialTooltip = (
  ctx: CanvasRenderingContext2D,
  button: { x: number; y: number; radius: number; label: string },
  theme: UiContext['theme'],
): void => {
  if (!button.label) return;
  const ui: UiContext = {
    ctx,
    theme,
    mode: 'regular',
    t: (key) => key,
    measure: { width: () => 0 },
    assets: { get: () => undefined },
  };
  ctx.save();
  const bounds = getTooltipBounds(ctx, theme, button, false);
  renderComposition(
    layoutComposition(
      {
        type: 'stack',
        children: tooltipNodes(button, bounds, bounds.x, bounds.y),
      },
      bounds,
      ui,
    ),
    ui,
  );
  ctx.restore();
};
