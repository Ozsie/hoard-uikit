// Menu component: the drop-down panel opened from the top bar. Kit
// component per the 02 contract — the view model carries the menu view,
// header, item labels and footer text prebuilt by the game-side adapter
// (item ids are semantic); layout is canvas-free; the item rows use the
// asymmetric button shape the menu has always drawn.

import type { Rect } from '@hoard-engine/primitives';
import { isPointInRect } from '@hoard-engine/primitives';
import type { UiContext } from '../env';
import {
  layoutComposition,
  renderComposition,
  type CompositionNode,
} from './composition';

export interface MenuItemVm {
  /** Hit-test identity: the menu item's id. */
  readonly id: string;
  readonly label: string;
}

export interface MenuViewModel {
  /** The menu view name, for facade-side item resolution. */
  readonly view: string;
  readonly headerText: string;
  readonly items: readonly MenuItemVm[];
  /** Build-info line on the main view; empty when absent. */
  readonly footerText: string;
}

export interface MenuItemLayout {
  item: MenuItemVm;
  bounds: Rect;
}

export interface MenuLayout {
  view: string;
  backdropBounds: Rect;
  panelBounds: Rect;
  headerBounds: Rect & { text: string };
  items: MenuItemLayout[];
  footerBounds?: Rect & { text: string };
}

/** Semantic hit: which part of the menu is under the point. */
export type MenuHit =
  | { kind: 'item'; itemId: string }
  | { kind: 'panel' }
  | { kind: 'backdrop' }
  | null;

export const layoutMenu = (
  vm: MenuViewModel | null,
  viewBounds: Rect,
): MenuLayout => {
  const { width: viewWidth, height: viewHeight } = viewBounds;
  if (!vm || viewWidth <= 0 || viewHeight <= 0) {
    return {
      view: vm?.view ?? 'main',
      backdropBounds: { x: 0, y: 0, width: 0, height: 0 },
      panelBounds: { x: 0, y: 0, width: 0, height: 0 },
      headerBounds: { x: 0, y: 0, width: 0, height: 0, text: '' },
      items: [],
    };
  }

  const padding = 10;
  const panelWidth = Math.min(240, Math.max(120, viewWidth - 16));
  const panelX = 8;
  const panelY = 44; // Placed right under top bar (top 8 + height 32 + gap 4)
  const itemWidth = panelWidth - padding * 2;
  const itemHeight = 30;
  const itemGap = 6;
  const headerHeight = 26;
  const footerHeight = vm.footerText ? 18 : 0;

  const contentHeight =
    headerHeight +
    (vm.items.length > 0 ? vm.items.length * (itemHeight + itemGap) : 0) +
    footerHeight;

  const panelHeight = contentHeight + padding * 2;

  let currentY = panelY + padding;

  const headerBounds = {
    x: panelX + padding,
    y: currentY,
    width: itemWidth,
    height: headerHeight,
    text: vm.headerText,
  };

  currentY += headerHeight;

  const items: MenuItemLayout[] = vm.items.map((item) => {
    const itemLayout: MenuItemLayout = {
      item,
      bounds: {
        x: panelX + padding,
        y: currentY,
        width: itemWidth,
        height: itemHeight,
      },
    };
    currentY += itemHeight + itemGap;
    return itemLayout;
  });

  let footerBounds: MenuLayout['footerBounds'];
  if (vm.footerText) {
    footerBounds = {
      x: panelX + padding,
      y: currentY,
      width: itemWidth,
      height: footerHeight,
      text: vm.footerText,
    };
  }

  return {
    view: vm.view,
    backdropBounds: { x: 0, y: 0, width: viewWidth, height: viewHeight },
    panelBounds: {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
    },
    headerBounds,
    items,
    footerBounds,
  };
};

export const hitTestMenu = (
  layout: MenuLayout,
  point: { x: number; y: number },
): MenuHit => {
  if (layout.panelBounds.width === 0 || layout.panelBounds.height === 0) {
    return null;
  }

  for (const itemLayout of layout.items) {
    if (isPointInRect(point.x, point.y, itemLayout.bounds)) {
      return { kind: 'item', itemId: itemLayout.item.id };
    }
  }

  if (isPointInRect(point.x, point.y, layout.panelBounds)) {
    return { kind: 'panel' };
  }

  return { kind: 'backdrop' };
};

export interface RenderMenuOptions {
  readonly hoveredItemId?: string | null;
}

export const renderMenu = (
  layout: MenuLayout,
  ui: UiContext,
  options?: RenderMenuOptions,
): void => {
  const { ctx } = ui;
  if (!ctx || layout.panelBounds.width === 0 || layout.panelBounds.height === 0)
    return;

  const positioned = (
    node: CompositionNode,
    bounds: Rect,
  ): CompositionNode => ({
    ...node,
    width: bounds.width,
    height: bounds.height,
    alignSelf: 'start',
    justifySelf: 'start',
    offsetX: bounds.x,
    offsetY: bounds.y,
  });
  const children: CompositionNode[] = [
    positioned(
      {
        type: 'fill',
        themeStyle: { overlay: 'scrim' },
      },
      layout.backdropBounds,
    ),
    positioned(
      {
        type: 'fill',
        shape: 'roundedRect',
        themeStyle: {
          surface: 'panelMenu',
          border: 'subtle',
          strokeWidth: 'thin',
          radius: 6,
          roundedRectMode: 'native',
        },
      },
      layout.panelBounds,
    ),
    positioned(
      {
        type: 'text',
        text: layout.headerBounds.text,
        align: 'center',
        baseline: 'middle',
        themeStyle: {
          text: 'strong',
          fontSize: 'xxl',
          fontWeight: 'bold',
          fontFamily: 'plain',
        },
      },
      {
        ...layout.headerBounds,
        y: layout.headerBounds.y - 2,
      },
    ),
    ...layout.items.flatMap((itemLayout) => {
      const hovered = options?.hoveredItemId === itemLayout.item.id;
      return [
        positioned(
          {
            type: 'fill',
            shape: 'roundedRect',
            cornerRadii: [2, 8, 2, 8],
            themeStyle: {
              surface: hovered ? 'itemHover' : 'item',
              border: hovered ? 'soft' : 'subtle',
              strokeWidth: 'thin',
              roundedRectMode: 'native',
            },
          },
          itemLayout.bounds,
        ),
        positioned(
          {
            type: 'text',
            text: itemLayout.item.label,
            align: 'center',
            baseline: 'middle',
            themeStyle: {
              text: hovered ? 'bright' : 'body',
              fontSize: 'lg',
              fontFamily: 'plain',
            },
          },
          itemLayout.bounds,
        ),
      ];
    }),
    ...(layout.footerBounds
      ? [
          positioned(
            {
              type: 'text',
              text: layout.footerBounds.text,
              role: 'footer',
              align: 'center',
              baseline: 'middle',
              themeStyle: { fontFamily: 'plain' },
            },
            layout.footerBounds,
          ),
        ]
      : []),
  ];
  const bounds = layout.backdropBounds;
  ctx.save();
  renderComposition(
    layoutComposition({ type: 'stack', children }, bounds, ui),
    ui,
  );
  ctx.restore();
};
