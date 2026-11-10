// Hero status component: the full-screen status and inventory screen opened
// from a hero card's inventory button. Kit component per the 02 contract —
// the view model carries one hero's equipment slots, inventory grid, item
// detail, stats, status effects and every text prebuilt by the game-side
// adapter; layout is canvas-free (wrapped lines precomputed through the
// measure port); hits are semantic slot ids and item indices; item art
// arrives through the asset port.

import type { Rect, UiTheme } from '@hoard-engine/primitives';
import {
  composeFont,
  drawRoundedRect,
  isPointInRect,
  truncateText,
  wrapTextMeasured,
  PER_CHAR_WIDTH_FALLBACK,
} from '@hoard-engine/primitives';
import { drawSpriteFrame } from '../kit/spriteFrame';
import {
  drawDialogScrim,
  drawModalFrame,
  drawModalHeader,
} from '../kit/modalFrame';
import type { SpriteRef, UiContext, UiEnv } from '../env';

/** The equipment slots a hero carries; the adapter maps its own hero model onto these. */
export type HeroStatusSlotId = 'weapon' | 'armour' | 'shield';

export interface HeroStatusSlotVm {
  /** Hit-test identity: the equipment slot. */
  readonly slotId: HeroStatusSlotId;
  readonly labelText: string;
  /** The equipped item's display name, or the empty-slot label. */
  readonly nameText: string;
  /** The equipped item's effect line (dice/defense numbers), prebuilt. */
  readonly effectText: string;
  readonly isEmpty: boolean;
  readonly isSelected: boolean;
  readonly sprite?: SpriteRef;
  readonly icon?: string;
}

export interface HeroStatusItemVm {
  /** Hit-test identity: the item's index in the hero's inventory. */
  readonly itemIndex: number;
  readonly nameText: string;
  readonly effectText?: string;
  readonly isSelected: boolean;
  readonly sprite?: SpriteRef;
  readonly icon?: string;
}

export interface HeroStatusDetailVm {
  readonly nameText: string;
  readonly effectText?: string;
  /** Thematic description; empty when the game has no text for the item. */
  readonly descriptionText: string;
  /** Whether the item gets a use button (an active item). */
  readonly hasUse: boolean;
  readonly isUsable: boolean;
  readonly isUsed: boolean;
  /** Prebuilt button labels; the kit ships no strings. */
  readonly useText: string;
  readonly usedText: string;
}

export interface HeroStatusStatVm {
  readonly statId: 'health' | 'experience' | 'actions' | 'steps';
  readonly labelText: string;
  readonly valueText: string;
  readonly maxText: string;
}

export interface HeroStatusEffectVm {
  /** Effect identity; only meaningful to the adapter (hit results ignore it). */
  readonly effectId: string;
  readonly labelText: string;
}

export interface HeroStatusViewModel {
  /** Hit-test identity: the hero's name. */
  readonly heroId: string;
  readonly headerText: string;
  readonly closeIcon: string;
  readonly slots: readonly HeroStatusSlotVm[];
  readonly descriptionHeaderText: string;
  /** The selected item's detail, or null when nothing is selected. */
  readonly detail: HeroStatusDetailVm | null;
  readonly statusEffectsHeaderText: string;
  readonly effects: readonly HeroStatusEffectVm[];
  readonly inventoryLabelText: string;
  readonly inventory: readonly HeroStatusItemVm[];
  readonly inventoryEmptyText: string;
  readonly stats: readonly HeroStatusStatVm[];
}

export interface HeroStatusSlotLayout {
  vm: HeroStatusSlotVm;
  bounds: Rect;
}

export interface HeroStatusCellLayout {
  /** The item in the cell, or null for an empty grid cell. */
  vm: HeroStatusItemVm | null;
  itemIndex: number | null;
  bounds: Rect;
}

export interface HeroStatusStatLayout {
  vm: HeroStatusStatVm;
  bounds: Rect;
}

export interface HeroStatusEffectLayout {
  vm: HeroStatusEffectVm;
  bounds: Rect;
}

export interface HeroStatusDetailLayout {
  vm: HeroStatusDetailVm;
  bounds: Rect;
  /** Use-button bounds when the detail item has a use affordance. */
  useButtonBounds?: Rect;
  /** The wrapped description lines, precomputed through the measure port. */
  descriptionLines: readonly string[];
}

export interface HeroStatusLayout {
  /** False when the view makes no sense (empty view bounds); nothing renders or hits. */
  hasContent: boolean;
  vm: HeroStatusViewModel;
  panelBounds: Rect;
  closeButtonBounds: Rect;
  slots: readonly HeroStatusSlotLayout[];
  detail: HeroStatusDetailLayout | null;
  descriptionBounds: Rect;
  statusEffectsBounds: Rect;
  effects: readonly HeroStatusEffectLayout[];
  inventoryGrid: readonly HeroStatusCellLayout[];
  stats: readonly HeroStatusStatLayout[];
}

/** Semantic hit: which part of the status screen is under the point. */
export type HeroStatusHit =
  | { kind: 'slot'; slotId: HeroStatusSlotId }
  | { kind: 'item'; itemIndex: number }
  | { kind: 'use' }
  | { kind: 'close' }
  | { kind: 'panel' }
  | { kind: 'backdrop' }
  | null;

const HEADER_HEIGHT = 34;
const PANEL_PADDING = 16;
const COLUMN_GAP = 12;
const SLOT_GAP = 10;
const CLOSE_BUTTON_SIZE = 20;
const BOX_HEADER_HEIGHT = 22;
const GRID_COLUMNS = 4;
const GRID_GAP = 8;
const GRID_LABEL_HEIGHT = 22;
const STAT_HEIGHT = 36;
const STAT_GAP = 8;
const USE_BUTTON_WIDTH = 84;
const USE_BUTTON_HEIGHT = 22;
const DESCRIPTION_LINE_HEIGHT = 16;

export const layoutHeroStatus = (
  vm: HeroStatusViewModel,
  viewBounds: Rect,
  env: UiEnv,
): HeroStatusLayout => {
  const base = (
    overrides: Partial<HeroStatusLayout> = {},
  ): HeroStatusLayout => ({
    hasContent: true,
    vm,
    panelBounds: { x: 0, y: 0, width: 0, height: 0 },
    closeButtonBounds: { x: 0, y: 0, width: 0, height: 0 },
    slots: [],
    detail: null,
    descriptionBounds: { x: 0, y: 0, width: 0, height: 0 },
    statusEffectsBounds: { x: 0, y: 0, width: 0, height: 0 },
    effects: [],
    inventoryGrid: [],
    stats: [],
    ...overrides,
  });

  const { width: viewWidth, height: viewHeight } = viewBounds;
  if (viewWidth <= 0 || viewHeight <= 0) {
    return { ...base(), hasContent: false };
  }

  const marginX = viewWidth * 0.05;
  const marginY = viewHeight * 0.05;
  const panelBounds: Rect = {
    x: marginX,
    y: marginY,
    width: Math.max(0, viewWidth - marginX * 2),
    height: Math.max(0, viewHeight - marginY * 2),
  };

  const closeButtonBounds: Rect = {
    x: panelBounds.x + panelBounds.width - CLOSE_BUTTON_SIZE - 6,
    y: panelBounds.y + 7,
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
  };

  const contentX = panelBounds.x + PANEL_PADDING;
  const contentY = panelBounds.y + HEADER_HEIGHT + PANEL_PADDING;
  const contentWidth = panelBounds.width - PANEL_PADDING * 2;
  const contentHeight = panelBounds.height - HEADER_HEIGHT - PANEL_PADDING * 2;

  const slotColumnWidth = Math.floor(contentWidth * 0.25);
  const middleColumnWidth = Math.floor(contentWidth * 0.35);
  const rightColumnWidth = Math.max(
    0,
    contentWidth - slotColumnWidth - middleColumnWidth - COLUMN_GAP * 2,
  );
  const middleX = contentX + slotColumnWidth + COLUMN_GAP;
  const rightX = middleX + middleColumnWidth + COLUMN_GAP;

  // Left column: the three equipment slots stacked over the full height.
  const slotCount = Math.max(1, vm.slots.length);
  const slotHeight = Math.floor(
    (contentHeight - SLOT_GAP * (slotCount - 1)) / slotCount,
  );
  const slots: HeroStatusSlotLayout[] = vm.slots.map((slot, slotIndex) => ({
    vm: slot,
    bounds: {
      x: contentX,
      y: contentY + slotIndex * (slotHeight + SLOT_GAP),
      width: slotColumnWidth,
      height: slotHeight,
    },
  }));

  // Middle column: description panel above, status effects below.
  const descriptionHeight = Math.floor(contentHeight * 0.55);
  const descriptionBounds: Rect = {
    x: middleX,
    y: contentY,
    width: middleColumnWidth,
    height: descriptionHeight,
  };
  const statusEffectsBounds: Rect = {
    x: middleX,
    y: contentY + descriptionHeight + SLOT_GAP,
    width: middleColumnWidth,
    height: Math.max(0, contentHeight - descriptionHeight - SLOT_GAP),
  };

  // Status effect rows under the box header.
  const bodyFont = composeFont(env.theme, env.theme.typography.sizes.xs);
  const effectRowHeight = 20;
  const effectGap = 6;
  const effectsMaxRows = Math.floor(
    (statusEffectsBounds.height - BOX_HEADER_HEIGHT) /
      (effectRowHeight + effectGap),
  );
  const effects: HeroStatusEffectLayout[] = vm.effects
    .slice(0, Math.max(0, effectsMaxRows))
    .map((effect, effectIndex) => ({
      vm: effect,
      bounds: {
        x: statusEffectsBounds.x + PANEL_PADDING,
        y:
          statusEffectsBounds.y +
          BOX_HEADER_HEIGHT +
          effectIndex * (effectRowHeight + effectGap),
        width: statusEffectsBounds.width - PANEL_PADDING * 2,
        height: effectRowHeight,
      },
    }));

  // Description detail: wrapped lines precomputed, kept above the use
  // button when the selected item has one.
  let detail: HeroStatusDetailLayout | null = null;
  if (vm.detail) {
    const useButtonBounds: Rect | undefined = vm.detail.hasUse
      ? {
          x:
            descriptionBounds.x +
            descriptionBounds.width -
            USE_BUTTON_WIDTH -
            PANEL_PADDING,
          y:
            descriptionBounds.y +
            descriptionBounds.height -
            USE_BUTTON_HEIGHT -
            PANEL_PADDING,
          width: USE_BUTTON_WIDTH,
          height: USE_BUTTON_HEIGHT,
        }
      : undefined;

    const textTop = descriptionBounds.y + BOX_HEADER_HEIGHT + 30;
    const textBottom = useButtonBounds
      ? useButtonBounds.y - 10
      : descriptionBounds.y + descriptionBounds.height - PANEL_PADDING;
    const maxLines = Math.max(
      0,
      Math.floor((textBottom - textTop) / DESCRIPTION_LINE_HEIGHT),
    );
    const inset = (useButtonBounds ? USE_BUTTON_WIDTH + 30 : 0) + PANEL_PADDING;
    const widthForText = Math.max(
      PANEL_PADDING * 2,
      descriptionBounds.width - inset,
    );
    detail = {
      vm: vm.detail,
      bounds: descriptionBounds,
      useButtonBounds,
      descriptionLines: wrapTextMeasured(
        env.measure,
        vm.detail.descriptionText,
        widthForText,
        bodyFont,
      ).slice(0, Math.max(0, maxLines)),
    };
  }

  // Right column: the inventory grid above, the stat boxes below. The
  // grid grows row by row beyond four rows when the inventory is larger
  // than sixteen items, capped by the height the pinned stat column needs.
  const statsTotalHeight =
    vm.stats.length * STAT_HEIGHT + Math.max(0, vm.stats.length - 1) * STAT_GAP;
  const statsTop = contentY + contentHeight - statsTotalHeight;
  const gridTop = contentY + GRID_LABEL_HEIGHT;
  const gridMaxHeight = Math.max(0, statsTop - gridTop - STAT_GAP);

  const rows = Math.max(4, Math.ceil(vm.inventory.length / GRID_COLUMNS));
  const cellWidth = Math.floor(
    (rightColumnWidth - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS,
  );
  const lineHeight = Math.floor((gridMaxHeight - (rows - 1) * GRID_GAP) / rows);
  const cellHeight = Math.min(
    Math.max(24, cellWidth),
    Math.max(24, lineHeight),
  );

  const inventoryGrid: HeroStatusCellLayout[] = [];
  for (let index = 0; index < rows * GRID_COLUMNS; index++) {
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    inventoryGrid.push({
      vm: vm.inventory[index] ?? null,
      itemIndex: vm.inventory[index]?.itemIndex ?? null,
      bounds: {
        x: rightX + column * (cellWidth + GRID_GAP),
        y: gridTop + row * (cellHeight + GRID_GAP),
        width: cellWidth,
        height: cellHeight,
      },
    });
  }

  const stats: HeroStatusStatLayout[] = vm.stats.map((stat, statIndex) => ({
    vm: stat,
    bounds: {
      x: rightX,
      y: statsTop + statIndex * (STAT_HEIGHT + STAT_GAP),
      width: rightColumnWidth,
      height: STAT_HEIGHT,
    },
  }));

  return base({
    panelBounds,
    closeButtonBounds,
    slots,
    detail,
    descriptionBounds,
    statusEffectsBounds,
    effects,
    inventoryGrid,
    stats,
  });
};

export const hitTestHeroStatus = (
  layout: HeroStatusLayout,
  point: { x: number; y: number },
): HeroStatusHit => {
  if (!layout.hasContent) return null;
  if (!isPointInRect(point.x, point.y, layout.panelBounds)) {
    return { kind: 'backdrop' };
  }
  if (isPointInRect(point.x, point.y, layout.closeButtonBounds)) {
    return { kind: 'close' };
  }
  if (
    layout.detail?.useButtonBounds &&
    layout.detail.vm.isUsable &&
    isPointInRect(point.x, point.y, layout.detail.useButtonBounds)
  ) {
    return { kind: 'use' };
  }
  for (const slot of layout.slots) {
    if (isPointInRect(point.x, point.y, slot.bounds)) {
      return { kind: 'slot', slotId: slot.vm.slotId };
    }
  }
  for (const cell of layout.inventoryGrid) {
    if (cell.vm && isPointInRect(point.x, point.y, cell.bounds)) {
      return { kind: 'item', itemIndex: cell.vm.itemIndex };
    }
  }
  return { kind: 'panel' };
};

export interface RenderHeroStatusOptions {
  /** Whether the close button is hovered. */
  readonly isCloseHovered?: boolean;
  /** Whether the detail area's use button is hovered. */
  readonly isUseHovered?: boolean;
}

export const renderHeroStatus = (
  layout: HeroStatusLayout,
  vm: HeroStatusViewModel,
  ui: UiContext,
  viewBounds: Rect,
  options?: RenderHeroStatusOptions,
): void => {
  const { ctx } = ui;
  const theme: UiTheme = ui.theme;
  if (!ctx || !layout.hasContent) return;

  const boxHeaderFont = composeFont(
    theme,
    theme.typography.sizes.sm,
    theme.typography.weights.bold,
  );
  const itemNameFont = composeFont(
    theme,
    theme.typography.sizes.sm,
    theme.typography.weights.bold,
  );
  const bodyFont = composeFont(theme, theme.typography.sizes.xxs);
  const detailNameFont = composeFont(
    theme,
    theme.typography.sizes.lg,
    theme.typography.weights.bold,
  );
  const detailEffectFont = composeFont(theme, theme.typography.sizes.sm);
  const statFont = composeFont(
    theme,
    theme.typography.sizes.sm,
    theme.typography.weights.bold,
  );
  const iconFont = composeFont(
    theme,
    theme.typography.sizes.display,
    theme.typography.weights.regular,
    theme.typography.families.plain,
  );

  ctx.save();

  drawDialogScrim(ctx, viewBounds.width, viewBounds.height, theme);
  drawModalFrame(ctx, layout.panelBounds, theme);
  drawModalHeader(ctx, layout.panelBounds, vm.headerText, theme);

  // Close button
  const close = layout.closeButtonBounds;
  const isCloseHovered = options?.isCloseHovered ?? false;
  drawRoundedRect(ctx, close.x, close.y, close.width, close.height, 3);
  ctx.fillStyle = isCloseHovered
    ? theme.palette.surface.closeButtonHover
    : theme.palette.surface.closeButton;
  ctx.fill();
  ctx.lineWidth = theme.shape.strokeWidth.thin;
  ctx.strokeStyle = theme.palette.border.panelDialog;
  ctx.stroke();
  ctx.fillStyle = theme.palette.text.headerDialog;
  ctx.font = composeFont(
    theme,
    theme.typography.sizes.sm,
    theme.typography.weights.bold,
    theme.typography.families.plain,
  );
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    vm.closeIcon,
    close.x + close.width / 2,
    close.y + close.height / 2,
  );

  ctx.textBaseline = 'top';

  // Left column: equipment slots.
  layout.slots.forEach((slot) => {
    const { bounds, vm: slotVm } = slot;

    // Slot label
    ctx.fillStyle = theme.palette.text.headerDialog;
    ctx.font = boxHeaderFont;
    ctx.textAlign = 'left';
    ctx.fillText(slotVm.labelText, bounds.x, bounds.y + 4);

    // Slot box
    const boxBounds: Rect = {
      ...bounds,
      y: bounds.y + BOX_HEADER_HEIGHT,
      height: Math.max(0, bounds.height - BOX_HEADER_HEIGHT),
    };
    drawRoundedRect(
      ctx,
      boxBounds.x,
      boxBounds.y,
      boxBounds.width,
      boxBounds.height,
      5,
    );
    ctx.fillStyle = slotVm.isSelected
      ? theme.palette.surface.rowSelected
      : theme.palette.surface.row;
    ctx.fill();
    ctx.lineWidth = slotVm.isSelected
      ? theme.shape.strokeWidth.regular
      : theme.shape.strokeWidth.thin;
    ctx.strokeStyle = slotVm.isSelected
      ? theme.palette.border.rowSelected
      : theme.palette.border.row;
    ctx.stroke();

    if (slotVm.isEmpty) {
      ctx.fillStyle = theme.palette.text.faint;
      ctx.font = bodyFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = truncateText(
        ctx,
        slotVm.nameText,
        boxBounds.width - 12,
        bodyFont,
        PER_CHAR_WIDTH_FALLBACK,
      );
      ctx.fillText(
        name,
        boxBounds.x + boxBounds.width / 2,
        boxBounds.y + boxBounds.height / 2,
      );
      ctx.textBaseline = 'top';
      return;
    }

    // Equipped item: sprite (emoji icon fallback) with name and effect.
    const iconSize = Math.min(boxBounds.height - 20, 48);
    const hasIconColumn = Boolean(slotVm.sprite || slotVm.icon);
    const iconX = boxBounds.x + 6;
    const iconY = boxBounds.y + Math.floor((boxBounds.height - iconSize) / 2);
    const drawn = slotVm.sprite
      ? drawSpriteFrame(ctx, ui.assets, slotVm.sprite, iconX, iconY, iconSize)
      : false;
    if (!drawn && slotVm.icon) {
      ctx.fillStyle = theme.palette.text.inventoryItem;
      ctx.font = iconFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slotVm.icon, iconX + iconSize / 2, iconY + iconSize / 2);
      ctx.textBaseline = 'top';
    }

    const textLeft = hasIconColumn ? iconX + iconSize + 8 : boxBounds.x + 8;
    const textWidth = boxBounds.x + boxBounds.width - 8 - textLeft;
    const nameTop = iconY + Math.max(0, Math.floor(iconSize / 2) - 24);

    ctx.fillStyle = theme.palette.text.bright;
    ctx.font = itemNameFont;
    ctx.textAlign = 'left';
    const name = truncateText(
      ctx,
      slotVm.nameText,
      textWidth,
      itemNameFont,
      PER_CHAR_WIDTH_FALLBACK,
    );
    ctx.fillText(name, textLeft, nameTop);

    ctx.fillStyle = theme.palette.text.cardDetail;
    ctx.font = bodyFont;
    const effect = truncateText(
      ctx,
      slotVm.effectText,
      textWidth,
      bodyFont,
      PER_CHAR_WIDTH_FALLBACK,
    );
    ctx.fillText(effect, textLeft, nameTop + 20);
  });

  // Middle column: description panel.
  const desc = layout.descriptionBounds;
  drawRoundedRect(ctx, desc.x, desc.y, desc.width, desc.height, 5);
  ctx.fillStyle = theme.palette.surface.row;
  ctx.fill();
  ctx.lineWidth = theme.shape.strokeWidth.thin;
  ctx.strokeStyle = theme.palette.border.row;
  ctx.stroke();

  ctx.fillStyle = theme.palette.text.headerDialog;
  ctx.font = boxHeaderFont;
  ctx.textAlign = 'left';
  ctx.fillText(vm.descriptionHeaderText, desc.x + PANEL_PADDING, desc.y + 6);

  if (layout.detail) {
    const { vm: detailVm, descriptionLines } = layout.detail;
    let textTop = desc.y + BOX_HEADER_HEIGHT + 16;

    ctx.fillStyle = theme.palette.text.bright;
    ctx.font = detailNameFont;
    const name = truncateText(
      ctx,
      detailVm.nameText,
      desc.width - PANEL_PADDING * 2,
      detailNameFont,
      PER_CHAR_WIDTH_FALLBACK,
    );
    ctx.fillText(name, desc.x + PANEL_PADDING, textTop);

    textTop += 26;
    if (detailVm.effectText) {
      ctx.fillStyle = theme.palette.text.body;
      ctx.font = detailEffectFont;
      const effect = truncateText(
        ctx,
        detailVm.effectText,
        desc.width - PANEL_PADDING * 2,
        detailEffectFont,
        PER_CHAR_WIDTH_FALLBACK,
      );
      ctx.fillText(effect, desc.x + PANEL_PADDING, textTop);
      textTop += 20;
    }

    ctx.fillStyle = theme.palette.text.secondary;
    ctx.font = bodyFont;
    descriptionLines.forEach((line, lineIndex) => {
      ctx.fillText(
        line,
        desc.x + PANEL_PADDING,
        textTop + lineIndex * DESCRIPTION_LINE_HEIGHT,
      );
    });

    // Use button
    if (layout.detail.useButtonBounds) {
      const btn = layout.detail.useButtonBounds;
      const isUseHovered = options?.isUseHovered ?? false;
      drawRoundedRect(ctx, btn.x, btn.y, btn.width, btn.height, 3);
      if (detailVm.isUsable) {
        ctx.fillStyle = isUseHovered
          ? theme.palette.surface.useButtonHover
          : theme.palette.surface.useButton;
        ctx.fill();
        ctx.strokeStyle = theme.palette.border.useButton;
        ctx.lineWidth = theme.shape.strokeWidth.thin;
        ctx.stroke();

        ctx.fillStyle = theme.palette.text.bright;
        ctx.font = composeFont(
          theme,
          theme.typography.sizes.xxs,
          theme.typography.weights.bold,
        );
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          detailVm.useText,
          btn.x + btn.width / 2,
          btn.y + btn.height / 2,
        );
      } else {
        ctx.fillStyle = theme.palette.surface.useButtonDisabled;
        ctx.fill();
        ctx.strokeStyle = theme.palette.border.useButtonDisabled;
        ctx.lineWidth = theme.shape.strokeWidth.thin;
        ctx.stroke();

        ctx.fillStyle = theme.palette.text.inventoryUsed;
        ctx.font = composeFont(
          theme,
          theme.typography.sizes.xxs,
          theme.typography.weights.bold,
        );
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          detailVm.usedText,
          btn.x + btn.width / 2,
          btn.y + btn.height / 2,
        );
      }
      ctx.textBaseline = 'top';
    }
  }

  // Middle column: status effects panel.
  const effectsPanel = layout.statusEffectsBounds;
  if (effectsPanel.height > 0) {
    drawRoundedRect(
      ctx,
      effectsPanel.x,
      effectsPanel.y,
      effectsPanel.width,
      effectsPanel.height,
      5,
    );
    ctx.fillStyle = theme.palette.surface.row;
    ctx.fill();
    ctx.lineWidth = theme.shape.strokeWidth.thin;
    ctx.strokeStyle = theme.palette.border.row;
    ctx.stroke();

    ctx.fillStyle = theme.palette.text.headerDialog;
    ctx.font = boxHeaderFont;
    ctx.textAlign = 'left';
    ctx.fillText(
      vm.statusEffectsHeaderText,
      effectsPanel.x + PANEL_PADDING,
      effectsPanel.y + 6,
    );

    layout.effects.forEach((effect) => {
      const { bounds, vm: effectVm } = effect;
      drawRoundedRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 3);
      ctx.fillStyle = theme.palette.surface.input;
      ctx.fill();
      ctx.strokeStyle = theme.palette.border.row;
      ctx.lineWidth = theme.shape.strokeWidth.thin;
      ctx.stroke();
      ctx.fillStyle = theme.palette.text.body;
      ctx.font = statFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        truncateText(
          ctx,
          effectVm.labelText,
          bounds.width - 8,
          statFont,
          PER_CHAR_WIDTH_FALLBACK,
        ),
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      ctx.textBaseline = 'top';
    });
  }

  // Right column: inventory grid, the label above the first cell.
  if (layout.inventoryGrid.length > 0) {
    const firstCell = layout.inventoryGrid[0].bounds;
    ctx.fillStyle = theme.palette.text.headerDialog;
    ctx.font = boxHeaderFont;
    ctx.textAlign = 'left';
    ctx.fillText(
      vm.inventoryLabelText,
      firstCell.x,
      firstCell.y - GRID_LABEL_HEIGHT,
    );
  }

  layout.inventoryGrid.forEach((cell) => {
    const { bounds } = cell;
    drawRoundedRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 4);
    const vmCell = cell.vm;
    ctx.fillStyle = vmCell
      ? vmCell.isSelected
        ? theme.palette.surface.rowSelected
        : theme.palette.surface.row
      : theme.palette.surface.input;
    ctx.fill();
    ctx.lineWidth =
      vmCell && vmCell.isSelected
        ? theme.shape.strokeWidth.regular
        : theme.shape.strokeWidth.thin;
    ctx.strokeStyle =
      vmCell && vmCell.isSelected
        ? theme.palette.border.rowSelected
        : theme.palette.border.row;
    ctx.stroke();

    if (!vmCell) return;
    const iconSize = Math.min(bounds.width - 8, bounds.height - 8);
    const iconX = bounds.x + Math.floor((bounds.width - iconSize) / 2);
    const iconY = bounds.y + Math.floor((bounds.height - iconSize) / 2);
    const drawn = vmCell.sprite
      ? drawSpriteFrame(ctx, ui.assets, vmCell.sprite, iconX, iconY, iconSize)
      : false;
    if (!drawn && vmCell.icon) {
      ctx.fillStyle = theme.palette.text.inventoryItem;
      ctx.font = composeFont(
        theme,
        theme.typography.sizes.lg,
        theme.typography.weights.regular,
        theme.typography.families.plain,
      );
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(vmCell.icon, iconX + iconSize / 2, iconY + iconSize / 2);
      ctx.textBaseline = 'top';
    }
  });

  // Empty inventory: the empty note centered over the grid area.
  if (
    vm.inventory.length === 0 &&
    layout.inventoryGrid.length > 0 &&
    vm.inventoryEmptyText
  ) {
    const first = layout.inventoryGrid[0].bounds;
    const last = layout.inventoryGrid[layout.inventoryGrid.length - 1].bounds;
    ctx.fillStyle = theme.palette.text.faint;
    ctx.font = composeFont(
      theme,
      theme.typography.sizes.sm,
      theme.typography.weights.italic,
      theme.typography.families.compact,
    );
    ctx.textAlign = 'center';
    ctx.fillText(
      vm.inventoryEmptyText,
      (first.x + last.x + last.width) / 2,
      first.y + Math.floor((last.y + last.height - first.y) / 2),
    );
  }

  // Right column: stat rows.
  layout.stats.forEach((stat) => {
    const { bounds, vm: statVm } = stat;
    drawRoundedRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 4);
    ctx.fillStyle = theme.palette.surface.input;
    ctx.fill();
    ctx.strokeStyle = theme.palette.border.row;
    ctx.lineWidth = theme.shape.strokeWidth.thin;
    ctx.stroke();

    ctx.fillStyle = theme.palette.text.body;
    ctx.font = statFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(statVm.labelText, bounds.x + 10, bounds.y + bounds.height / 2);
    ctx.fillStyle = theme.palette.text.bright;
    ctx.textAlign = 'right';
    ctx.fillText(
      `${statVm.valueText} / ${statVm.maxText}`,
      bounds.x + bounds.width - 10,
      bounds.y + bounds.height / 2,
    );
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  });

  ctx.textAlign = 'left';
  ctx.restore();
};
