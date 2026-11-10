// Hero cards component: the bottom-left party cards. Kit component per
// the 02 contract — the view model carries the party with all card texts
// prebuilt by the game-side adapter; layout is canvas-free; hits are
// semantic hero ids. The cards' inventory button opens the full-screen
// hero status component; the cards themselves carry no inventory view.

import type { Rect, UiTheme } from '@hoard-engine/primitives';
import {
  drawRoundedRect,
  isPointInRect,
  composeFont,
  truncateText,
  PER_CHAR_WIDTH_FALLBACK,
} from '@hoard-engine/primitives';
import type { UiContext } from '../env';

export interface HeroCardVm {
  /** Hit-test identity: the hero's name. */
  readonly heroId: string;
  readonly title: string;
  /** Actor colour; the theme's fallback applies when empty. */
  readonly colour: string;
  readonly isCurrent: boolean;
  readonly isTarget: boolean;
  readonly hpText: string;
  readonly actionsText?: string;
  readonly movesText?: string;
  readonly equipmentText?: string;
  readonly weaponText?: string;
  readonly armourText?: string;
  readonly shieldText?: string;
  readonly inventoryButtonIcon: string;
}

export interface HeroCardsViewModel {
  readonly cards: readonly HeroCardVm[];
}

export interface HeroCardLayoutItem {
  card: HeroCardVm;
  bounds: Rect;
  inventoryButtonBounds: Rect;
}

export interface HeroCardsLayout {
  containerBounds: Rect;
  cards: HeroCardLayoutItem[];
}

/** Semantic hit: which hero-card affordance is under the point. */
export type HeroCardsHit =
  | { kind: 'inventoryButton'; heroId: string }
  | { kind: 'card'; heroId: string }
  | null;

export const layoutHeroCards = (
  vm: HeroCardsViewModel,
  viewBounds: Rect,
): HeroCardsLayout => {
  const emptyLayout: HeroCardsLayout = {
    containerBounds: { x: 0, y: 0, width: 0, height: 0 },
    cards: [],
  };

  const { width: viewWidth, height: viewHeight } = viewBounds;
  if (viewWidth <= 0 || viewHeight <= 0 || vm.cards.length === 0) {
    return emptyLayout;
  }

  const marginX = 8;
  const marginY = 8;
  const cardGap = 6;
  const maxTotalWidth = viewWidth * 0.5;
  const availableWidth = Math.max(0, maxTotalWidth - marginX);

  const numHeroes = vm.cards.length;
  // Calculate card width such that total cards width with gaps <= 50% of viewWidth
  const calculatedCardWidth = Math.max(
    80,
    Math.floor((availableWidth - (numHeroes - 1) * cardGap) / numHeroes),
  );
  const cardWidth = Math.min(180, calculatedCardWidth);

  const cards: HeroCardLayoutItem[] = [];

  let currentX = marginX;
  let minCardY = viewHeight;

  vm.cards.forEach((card) => {
    const cardHeight = card.isCurrent ? 112 : 44; // Compact inactive card: Title (20px) + HP (16px) + padding (8px)

    const cardY = Math.max(8, viewHeight - marginY - cardHeight);
    if (cardY < minCardY) {
      minCardY = cardY;
    }

    const cardBounds: Rect = {
      x: currentX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
    };

    const invBtnSize = 18;
    const invBtnBounds: Rect = {
      x: cardBounds.x + cardBounds.width - invBtnSize - 4,
      y: cardBounds.y + 3,
      width: invBtnSize,
      height: invBtnSize,
    };

    cards.push({
      card,
      bounds: cardBounds,
      inventoryButtonBounds: invBtnBounds,
    });

    currentX += cardWidth + cardGap;
  });

  const totalWidth = currentX - cardGap - marginX;
  const containerBounds: Rect = {
    x: marginX,
    y: minCardY,
    width: totalWidth,
    height: viewHeight - marginY - minCardY,
  };

  return {
    containerBounds,
    cards,
  };
};

export const hitTestHeroCards = (
  layout: HeroCardsLayout,
  point: { x: number; y: number },
): HeroCardsHit => {
  // Check hero cards
  for (const card of layout.cards) {
    if (isPointInRect(point.x, point.y, card.bounds)) {
      // Check Backpack button
      if (isPointInRect(point.x, point.y, card.inventoryButtonBounds)) {
        return { kind: 'inventoryButton', heroId: card.card.heroId };
      }
      return { kind: 'card', heroId: card.card.heroId };
    }
  }

  return null;
};

export interface RenderHeroCardsOptions {
  /** Hovered inventory (backpack) button, by hero id. */
  readonly hoveredInventoryHeroId?: string | null;
}

export const renderHeroCards = (
  layout: HeroCardsLayout,
  vm: HeroCardsViewModel,
  ui: UiContext,
  options?: RenderHeroCardsOptions,
): void => {
  const { ctx } = ui;
  const theme: UiTheme = ui.theme;
  if (!ctx || layout.cards.length === 0) return;

  const hoveredInventoryHeroId = options?.hoveredInventoryHeroId ?? null;

  const titleFont = composeFont(
    theme,
    theme.typography.sizes.sm,
    theme.typography.weights.bold,
  );
  const statFont = composeFont(theme, theme.typography.sizes.xxs);
  const statBoldFont = composeFont(
    theme,
    theme.typography.sizes.xxs,
    theme.typography.weights.bold,
  );

  ctx.save();

  layout.cards.forEach((item) => {
    const { bounds, card } = item;

    // Card background
    drawRoundedRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 5);
    ctx.fillStyle = card.colour || theme.palette.surface.cardFallback;
    ctx.fill();

    // Border (highlight active hero)
    if (card.isCurrent) {
      ctx.lineWidth = theme.shape.strokeWidth.thick;
      ctx.strokeStyle = theme.palette.border.heroCurrent;
      ctx.stroke();
    } else {
      ctx.lineWidth = theme.shape.strokeWidth.thin;
      ctx.strokeStyle = theme.palette.border.card;
      ctx.stroke();
    }

    // Header / Title
    ctx.fillStyle = theme.palette.text.cardTitle;
    ctx.font = titleFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const maxTitleWidth = bounds.width - item.inventoryButtonBounds.width - 12;
    const displayTitle = truncateText(
      ctx,
      card.title,
      maxTitleWidth,
      titleFont,
      PER_CHAR_WIDTH_FALLBACK,
    );
    ctx.fillText(displayTitle, bounds.x + 5, bounds.y + 12);

    // Inventory Button
    const invBtn = item.inventoryButtonBounds;
    const isInvHovered = hoveredInventoryHeroId === card.heroId;
    drawRoundedRect(ctx, invBtn.x, invBtn.y, invBtn.width, invBtn.height, 3);
    ctx.fillStyle = isInvHovered
      ? theme.palette.surface.inventoryButtonHover
      : theme.palette.surface.inventoryButton;
    ctx.fill();
    ctx.strokeStyle = theme.palette.border.inventoryButton;
    ctx.lineWidth = theme.shape.strokeWidth.thin;
    ctx.stroke();

    ctx.font = composeFont(
      theme,
      theme.typography.sizes.md,
      theme.typography.weights.regular,
      theme.typography.families.plain,
    );
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      card.inventoryButtonIcon,
      invBtn.x + invBtn.width / 2,
      invBtn.y + invBtn.height / 2 + 1,
    );

    // HP Text
    ctx.font = statBoldFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.palette.text.cardStat;
    ctx.fillText(card.hpText, bounds.x + 5, bounds.y + 30);

    // If Current Actor, render actions, movement and equipment
    if (card.isCurrent) {
      ctx.font = statFont;

      // Actions and Moves
      if (card.actionsText && card.movesText) {
        ctx.fillText(
          `${card.actionsText}  ${card.movesText}`,
          bounds.x + 5,
          bounds.y + 46,
        );
      }

      // Equipment header
      if (card.equipmentText) {
        ctx.font = statBoldFont;
        ctx.fillText(card.equipmentText, bounds.x + 5, bounds.y + 61);
      }

      // Equipment items
      ctx.font = statFont;
      const maxItemWidth = bounds.width - 10;
      if (card.weaponText) {
        const wTxt = truncateText(
          ctx,
          card.weaponText,
          maxItemWidth,
          statFont,
          PER_CHAR_WIDTH_FALLBACK,
        );
        ctx.fillText(wTxt, bounds.x + 5, bounds.y + 75);
      }
      if (card.armourText) {
        const aTxt = truncateText(
          ctx,
          card.armourText,
          maxItemWidth,
          statFont,
          PER_CHAR_WIDTH_FALLBACK,
        );
        ctx.fillText(aTxt, bounds.x + 5, bounds.y + 88);
      }
      if (card.shieldText) {
        const sTxt = truncateText(
          ctx,
          card.shieldText,
          maxItemWidth,
          statFont,
          PER_CHAR_WIDTH_FALLBACK,
        );
        ctx.fillText(sTxt, bounds.x + 5, bounds.y + 101);
      }
    }
  });

  ctx.restore();
};
