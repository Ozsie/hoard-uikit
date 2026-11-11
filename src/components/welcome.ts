// Welcome component: the title screen — a cover-fit background image
// (with a themed fallback while the art is missing), a centered panel in
// the dialog style with a stack of buttons, and a build footer. Kit
// component per the 02 contract — the view model carries the header,
// button labels and footer text prebuilt by the game-side adapter; the
// background art arrives through the asset port; hits are the semantic
// button ids.

import type { Rect } from '@hoard-engine/primitives';
import { isPointInRect } from '@hoard-engine/primitives';
import type { UiContext } from '../env';
import {
  layoutComposition,
  renderComposition,
  type CompositionNode,
} from './composition';

export interface WelcomeButtonVm {
  /** Hit-test identity: the button id. */
  readonly id: string;
  readonly label: string;
}

export interface WelcomeViewModel {
  readonly headerText: string;
  readonly buttons: readonly WelcomeButtonVm[];
  readonly footerText: string;
  /** Asset-port id of the background art. */
  readonly backgroundAssetId: string;
}

export interface WelcomeButtonLayout {
  id: string;
  label: string;
  bounds: Rect;
}

export interface WelcomeLayout {
  hasContent: boolean;
  viewBounds: Rect;
  panelBounds: Rect;
  headerText: string;
  buttons: WelcomeButtonLayout[];
  footerBounds: Rect;
  footerText: string;
}

/** Semantic hit: the pressed welcome button. */
export type WelcomeHit = string | null;

const ROW_HEIGHT = 48;
const ROW_GAP = 8;
// Rows never shrink below this, even on very short views.
const MIN_ROW_HEIGHT = 28;
const HEADER_HEIGHT = 48;
const PADDING_X = 18;
const PADDING_Y = 16;

const positioned = (node: CompositionNode, bounds: Rect): CompositionNode => ({
  ...node,
  width: bounds.width,
  height: bounds.height,
  alignSelf: 'start',
  justifySelf: 'start',
  offsetX: bounds.x,
  offsetY: bounds.y,
});

/**
 * Cover-fit bounds: the image scaled uniformly so it covers the whole
 * view, centered, overflowing edges cropped (CSS `background-size:
 * cover` semantics).
 */
export const getCoverFitBounds = (
  imageWidth: number,
  imageHeight: number,
  viewWidth: number,
  viewHeight: number,
): Rect => {
  if (
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    viewWidth <= 0 ||
    viewHeight <= 0
  ) {
    return { x: 0, y: 0, width: viewWidth, height: viewHeight };
  }
  const scale = Math.max(viewWidth / imageWidth, viewHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (viewWidth - width) / 2,
    y: (viewHeight - height) / 2,
    width,
    height,
  };
};

export const layoutWelcome = (
  vm: WelcomeViewModel | null,
  viewBounds: Rect,
): WelcomeLayout => {
  const { width: viewWidth, height: viewHeight } = viewBounds;
  const emptyLayout: WelcomeLayout = {
    hasContent: false,
    viewBounds: { x: 0, y: 0, width: 0, height: 0 },
    panelBounds: { x: 0, y: 0, width: 0, height: 0 },
    headerText: '',
    buttons: [],
    footerBounds: { x: 0, y: 0, width: 0, height: 0 },
    footerText: '',
  };
  if (!vm || viewWidth <= 0 || viewHeight <= 0) return emptyLayout;

  const buttons = vm.buttons;
  const marginX = Math.max(12, Math.floor(viewWidth * 0.05));
  const marginY = Math.max(12, Math.floor(viewHeight * 0.05));
  // Same centered sizing rule as the save/load dialog.
  const panelWidth = Math.min(560, Math.max(340, viewWidth - marginX * 2));
  const contentWidth = panelWidth - PADDING_X * 2;

  // Rows shrink when the view is short so the panel always fits.
  const availableHeight = viewHeight - marginY * 2;
  const fixedHeight =
    PADDING_Y * 2 + HEADER_HEIGHT + (buttons.length - 1) * ROW_GAP;
  const rowHeight = Math.max(
    MIN_ROW_HEIGHT,
    Math.min(
      ROW_HEIGHT,
      Math.floor((availableHeight - fixedHeight) / buttons.length),
    ),
  );

  const panelHeight =
    PADDING_Y * 2 +
    HEADER_HEIGHT +
    buttons.length * rowHeight +
    (buttons.length - 1) * ROW_GAP;
  const panelX = Math.floor((viewWidth - panelWidth) / 2);
  const panelY = Math.floor((viewHeight - panelHeight) / 2);

  return {
    hasContent: true,
    viewBounds: { x: 0, y: 0, width: viewWidth, height: viewHeight },
    panelBounds: {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
    },
    headerText: vm.headerText,
    buttons: buttons.map((button, index) => ({
      id: button.id,
      label: button.label,
      bounds: {
        x: panelX + PADDING_X,
        y: panelY + PADDING_Y + HEADER_HEIGHT + index * (rowHeight + ROW_GAP),
        width: contentWidth,
        height: rowHeight,
      },
    })),
    footerBounds: {
      x: 0,
      y: viewHeight - 22,
      width: viewWidth,
      height: 10,
    },
    footerText: vm.footerText,
  };
};

export const hitTestWelcome = (
  layout: WelcomeLayout,
  point: { x: number; y: number },
): WelcomeHit => {
  if (!layout.hasContent) return null;
  for (const button of layout.buttons) {
    if (isPointInRect(point.x, point.y, button.bounds)) {
      return button.id;
    }
  }
  return null;
};

export interface RenderWelcomeOptions {
  /** Hovered main-view button, for the row highlight. */
  readonly hoveredButtonId?: string | null;
  /** Background image override; when omitted the asset port is asked. */
  readonly backgroundImage?: HTMLImageElement | null;
}

/**
 * The background layer every welcome view shares: the welcome art
 * cover-fit over the whole canvas, or the flat fallback colour with a
 * subtle vignette while the art is missing.
 */
export const renderWelcomeBackground = (
  ui: UiContext,
  vm: WelcomeViewModel,
  viewBounds: Rect,
  options?: RenderWelcomeOptions,
): void => {
  if (!ui.ctx) return;
  const bounds = {
    x: 0,
    y: 0,
    width: viewBounds.width,
    height: viewBounds.height,
  };
  const image: CompositionNode = {
    type: 'image',
    assetId: vm.backgroundAssetId,
    fit: 'cover',
    fallback: 'welcome',
    ...(options?.backgroundImage !== undefined
      ? {
          imageOverride: {
            source: options.backgroundImage,
            fit: 'cover',
          },
        }
      : {}),
  };
  renderComposition(layoutComposition(image, bounds, ui), ui);
};

/**
 * The build footer, bottom center — drawn on every welcome view.
 */
export const renderWelcomeFooter = (
  ui: UiContext,
  layout: WelcomeLayout,
): void => {
  if (!ui.ctx || !layout.footerText) return;
  const { width: viewWidth, height: viewHeight } = layout.viewBounds;
  const node: CompositionNode = {
    type: 'text',
    text: layout.footerText,
    role: 'footer',
    align: 'center',
    baseline: 'bottom',
    themeStyle: { textOrder: 'colorFirst' },
  };
  const bounds = { x: 0, y: viewHeight - 12, width: viewWidth, height: 0 };
  renderComposition(
    layoutComposition(
      positioned(node, bounds),
      {
        x: 0,
        y: 0,
        width: viewWidth,
        height: viewHeight,
      },
      ui,
    ),
    ui,
  );
};

export const renderWelcome = (
  layout: WelcomeLayout,
  vm: WelcomeViewModel,
  ui: UiContext,
  options?: RenderWelcomeOptions,
): void => {
  if (!ui.ctx || !layout.hasContent) return;
  const { width: viewWidth, height: viewHeight } = layout.viewBounds;
  const bounds = { x: 0, y: 0, width: viewWidth, height: viewHeight };
  const background: CompositionNode = {
    type: 'image',
    assetId: vm.backgroundAssetId,
    fit: 'cover',
    fallback: 'welcome',
    ...(options?.backgroundImage !== undefined
      ? {
          imageOverride: {
            source: options.backgroundImage,
            fit: 'cover',
          },
        }
      : {}),
  };
  const children: CompositionNode[] = [
    positioned(background, bounds),
    positioned(
      {
        type: 'panel',
        title: layout.headerText,
        children: [],
      },
      layout.panelBounds,
    ),
    ...layout.buttons.map((button) =>
      positioned(
        {
          type: 'button',
          actionId: button.id,
          label: button.label,
          variant: 'row',
        },
        button.bounds,
      ),
    ),
    ...(layout.footerText
      ? [
          positioned(
            {
              type: 'text',
              text: layout.footerText,
              role: 'footer',
              align: 'center',
              baseline: 'bottom',
              themeStyle: { textOrder: 'colorFirst' },
            },
            { x: 0, y: viewHeight - 12, width: viewWidth, height: 0 },
          ),
        ]
      : []),
  ];
  const composition = layoutComposition(
    { type: 'stack', children },
    bounds,
    ui,
  );
  ui.ctx.save();
  renderComposition(composition, ui, {
    hoveredActionId: options?.hoveredButtonId,
  });
  ui.ctx.restore();
};
