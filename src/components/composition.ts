// An opt-in, data-only composition tree for generic canvas UI. Layout,
// hit testing and rendering share one tree; state and actions remain with
// the consumer, which supplies the tree and handles semantic action ids.

import type { Rect, UiTheme } from '@hoard-engine/primitives';
import {
  composeFont,
  drawRoundedRect,
  isPointInRect,
  wrapTextMeasured,
} from '@hoard-engine/primitives';
import type { AssetId, SpriteRef, UiContext, UiEnv } from '../env';
import { drawButton } from '../kit/button';
import { drawListRow, listRowStyles } from '../kit/listRow';
import {
  drawModalFrame,
  drawModalHeader,
  MODAL_HEADER_OFFSET_X,
  MODAL_HEADER_OFFSET_Y,
} from '../kit/modalFrame';
import { drawSpriteFrame } from '../kit/spriteFrame';
import { drawTextInput } from '../kit/textInput';

export type CompositionImageFit = 'cover' | 'contain' | 'stretch';
export type CompositionAlign = 'start' | 'center' | 'end' | 'stretch';
export type CompositionJustify = 'start' | 'center' | 'end' | 'space-between';
export type CompositionPosition = 'start' | 'center' | 'end';

/** An optional replacement visual. An explicit null source suppresses lookup. */
export interface CompositionImageOverride {
  readonly assetId?: AssetId;
  readonly source?: CanvasImageSource | null;
  readonly fit?: CompositionImageFit;
}

/** Theme-token styling with optional consumer-provided dynamic colors. */
export interface CompositionThemeStyle {
  readonly text?: keyof UiTheme['palette']['text'];
  readonly surface?: keyof UiTheme['palette']['surface'];
  readonly border?: keyof UiTheme['palette']['border'];
  readonly overlay?: keyof UiTheme['palette']['overlay'];
  /** Dynamic data such as an actor color; ordinary UI colors use theme tokens. */
  readonly textColor?: string;
  readonly fillColor?: string;
  readonly strokeColor?: string;
  readonly fontSize?: keyof UiTheme['typography']['sizes'];
  readonly fontWeight?: keyof UiTheme['typography']['weights'];
  readonly fontFamily?: keyof UiTheme['typography']['families'];
  readonly strokeWidth?: keyof UiTheme['shape']['strokeWidth'];
  readonly radius?: number;
}

interface CompositionNodeBase {
  /** Optional fixed size; otherwise the parent allocates intrinsic/flex space. */
  readonly width?: number;
  readonly height?: number;
  /** Extra main-axis space is distributed by this non-negative weight. */
  readonly grow?: number;
  readonly alignSelf?: CompositionAlign;
  readonly justifySelf?: CompositionPosition;
  readonly offsetX?: number;
  readonly offsetY?: number;
  /** Replaces this node's canvas-drawn visual when the image is available. */
  readonly imageOverride?: CompositionImageOverride;
  /** Clips a container's children to its bounds for both drawing and hits. */
  readonly clipChildren?: boolean;
  readonly themeStyle?: CompositionThemeStyle;
  readonly hoverThemeStyle?: CompositionThemeStyle;
}

interface CompositionContainerBase extends CompositionNodeBase {
  readonly children: readonly CompositionNode[];
  readonly gap?: number;
  readonly padding?: number;
  readonly align?: CompositionAlign;
  readonly justify?: CompositionJustify;
}

export interface CompositionRow extends CompositionContainerBase {
  readonly type: 'row';
}

export interface CompositionColumn extends CompositionContainerBase {
  readonly type: 'column';
}

/** A layered container; children share its content bounds and draw in order. */
export interface CompositionStack extends CompositionNodeBase {
  readonly type: 'stack';
  readonly children: readonly CompositionNode[];
  readonly padding?: number;
}

export interface CompositionPanel extends CompositionNodeBase {
  readonly type: 'panel';
  readonly title?: string;
  readonly children: readonly CompositionNode[];
  readonly childrenLayout?: 'flow' | 'stack';
  readonly gap?: number;
  readonly padding?: number;
  readonly align?: CompositionAlign;
  readonly justify?: CompositionJustify;
}

export interface CompositionSpacer extends CompositionNodeBase {
  readonly type: 'spacer';
  /** Preferred main-axis size when no explicit width/height is supplied. */
  readonly size?: number;
}

export interface CompositionText extends CompositionNodeBase {
  readonly type: 'text';
  readonly text: string;
  readonly role?: 'body' | 'muted' | 'heading' | 'footer';
  readonly align?: CanvasTextAlign;
  readonly baseline?: CanvasTextBaseline;
  readonly wrap?: boolean;
  readonly lineHeight?: number;
  readonly maxLines?: number;
  readonly clip?: boolean;
  readonly decoration?: 'strikethrough';
}

export interface CompositionFill extends CompositionNodeBase {
  readonly type: 'fill';
  readonly shape?: 'rect' | 'roundedRect';
}

export interface CompositionLine extends CompositionNodeBase {
  readonly type: 'line';
  readonly orientation: 'horizontal' | 'vertical';
}

/** An invisible semantic region for visuals that are composed separately. */
export interface CompositionHitTarget extends CompositionNodeBase {
  readonly type: 'hitTarget';
  readonly actionId: string;
}

export interface CompositionButton extends CompositionNodeBase {
  readonly type: 'button';
  readonly actionId: string;
  readonly label: string;
  readonly variant?: 'primary' | 'secondary' | 'row';
}

export interface CompositionCheckbox extends CompositionNodeBase {
  readonly type: 'checkbox';
  readonly actionId: string;
  readonly label: string;
  readonly checked: boolean;
}

export interface CompositionTextInput extends CompositionNodeBase {
  readonly type: 'textInput';
  readonly actionId: string;
  readonly value: string;
  readonly focused?: boolean;
}

export type CompositionImage = CompositionNodeBase & {
  readonly type: 'image';
  readonly fit?: CompositionImageFit;
  readonly fallback?: 'surface' | 'welcome';
  readonly fallbackText?: string;
} & (
    | { readonly assetId: AssetId; readonly sprite?: never }
    | { readonly assetId?: never; readonly sprite: SpriteRef }
  );

export interface CompositionMeter extends CompositionNodeBase {
  readonly type: 'meter';
  readonly value: number;
  readonly max: number;
  readonly label?: string;
}

/** The image override applies to a node's own visual, not its children. */
export type CompositionNode =
  | CompositionRow
  | CompositionColumn
  | CompositionStack
  | CompositionPanel
  | CompositionSpacer
  | CompositionText
  | CompositionFill
  | CompositionLine
  | CompositionHitTarget
  | CompositionButton
  | CompositionCheckbox
  | CompositionTextInput
  | CompositionImage
  | CompositionMeter;

export interface CompositionLayoutNode {
  readonly node: CompositionNode;
  readonly bounds: Rect;
  readonly children: readonly CompositionLayoutNode[];
  readonly textLines?: readonly string[];
}

export type CompositionHit =
  | { readonly kind: 'button'; readonly actionId: string }
  | { readonly kind: 'checkbox'; readonly actionId: string }
  | { readonly kind: 'textInput'; readonly actionId: string }
  | { readonly kind: 'hitTarget'; readonly actionId: string }
  | null;

export interface CompositionRenderOptions {
  readonly hoveredActionId?: string | null;
  readonly focusedActionId?: string | null;
}

type Axis = 'horizontal' | 'vertical';
type ContainerNode =
  CompositionRow | CompositionColumn | CompositionStack | CompositionPanel;

const clampSize = (value: number): number => Math.max(0, value);
const dimension = (bounds: Rect, axis: Axis): number =>
  axis === 'horizontal' ? bounds.width : bounds.height;
const crossDimension = (bounds: Rect, axis: Axis): number =>
  axis === 'horizontal' ? bounds.height : bounds.width;
const axisSize = (node: CompositionNode, axis: Axis): number | undefined =>
  axis === 'horizontal' ? node.width : node.height;

const textFont = (
  env: UiEnv,
  role: CompositionText['role'],
  style?: CompositionThemeStyle,
): string => {
  const defaultSize =
    role === 'heading'
      ? 'title'
      : role === 'footer'
        ? 'xxs'
        : role === 'muted'
          ? 'sm'
          : 'md';
  const defaultWeight = role === 'heading' ? 'bold' : 'regular';
  return composeFont(
    env.theme,
    env.theme.typography.sizes[style?.fontSize ?? defaultSize],
    env.theme.typography.weights[style?.fontWeight ?? defaultWeight],
    style?.fontFamily
      ? env.theme.typography.families[style.fontFamily]
      : undefined,
  );
};

const lineHeight = (node: CompositionText): number =>
  Math.max(0, node.lineHeight ?? (node.role === 'heading' ? 28 : 22));

const intrinsicSize = (
  node: CompositionNode,
  axis: Axis,
  env: UiEnv,
): number => {
  const explicit = axisSize(node, axis);
  if (explicit !== undefined) return clampSize(explicit);
  switch (node.type) {
    case 'spacer':
      return clampSize(node.size ?? 0);
    case 'fill':
    case 'hitTarget':
      return 0;
    case 'line':
      return axis === 'horizontal' ? 0 : 1;
    case 'text':
      return axis === 'horizontal'
        ? env.measure.width(
            node.text,
            textFont(env, node.role, node.themeStyle),
          )
        : node.wrap && node.maxLines !== undefined
          ? lineHeight(node) * Math.max(0, node.maxLines)
          : lineHeight(node);
    case 'button':
      return axis === 'horizontal'
        ? env.measure.width(
            node.label,
            composeFont(
              env.theme,
              node.variant === 'row'
                ? env.theme.typography.sizes.lg
                : env.theme.typography.sizes.xl,
              env.theme.typography.weights.bold,
            ),
          ) + 24
        : 40;
    case 'checkbox':
      return axis === 'horizontal'
        ? 30 +
            env.measure.width(
              node.label,
              composeFont(env.theme, env.theme.typography.sizes.lg),
            )
        : 24;
    case 'textInput':
      return axis === 'horizontal' ? 160 : 36;
    case 'image':
      return 48;
    case 'meter':
      return axis === 'horizontal' ? 160 : 24;
    case 'row':
    case 'column':
    case 'panel': {
      const direction: Axis = node.type === 'row' ? 'horizontal' : 'vertical';
      const padding = clampSize(node.padding ?? 0);
      const gap = clampSize(node.gap ?? 0);
      const sizes = node.children.map((child) =>
        intrinsicSize(child, direction, env),
      );
      const crossSizes = node.children.map((child) =>
        intrinsicSize(
          child,
          direction === 'horizontal' ? 'vertical' : 'horizontal',
          env,
        ),
      );
      const main =
        sizes.reduce((sum, size) => sum + size, 0) +
        gap * Math.max(0, sizes.length - 1) +
        padding * 2 +
        (node.type === 'panel' && node.title ? 48 : 0);
      const cross = Math.max(0, ...crossSizes) + padding * 2;
      return direction === axis ? main : cross;
    }
    case 'stack': {
      const padding = clampSize(node.padding ?? 0);
      return (
        Math.max(
          0,
          ...node.children.map((child) => intrinsicSize(child, axis, env)),
        ) +
        padding * 2
      );
    }
  }
};

const centeredBounds = (node: CompositionNode, bounds: Rect): Rect => {
  const width = Math.min(bounds.width, clampSize(node.width ?? bounds.width));
  const height = Math.min(
    bounds.height,
    clampSize(node.height ?? bounds.height),
  );
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  };
};

const insetBounds = (bounds: Rect, padding: number): Rect => {
  const inset = clampSize(padding);
  return {
    x: bounds.x + inset,
    y: bounds.y + inset,
    width: clampSize(bounds.width - inset * 2),
    height: clampSize(bounds.height - inset * 2),
  };
};

const makeLayoutNode = (
  node: CompositionNode,
  bounds: Rect,
  env: UiEnv,
): CompositionLayoutNode => {
  const ownBounds = centeredBounds(node, {
    ...bounds,
    x: bounds.x + (node.offsetX ?? 0),
    y: bounds.y + (node.offsetY ?? 0),
  });
  if (!isContainer(node)) {
    const textLines =
      node.type === 'text'
        ? node.wrap
          ? wrapTextMeasured(
              env.measure,
              node.text,
              ownBounds.width,
              textFont(env, node.role, node.themeStyle),
            )
          : node.text.split('\n')
        : undefined;
    return {
      node,
      bounds: ownBounds,
      children: [],
      textLines:
        textLines && node.type === 'text' && node.maxLines !== undefined
          ? textLines.slice(0, Math.max(0, node.maxLines))
          : textLines,
    };
  }

  const inner = insetBounds(ownBounds, node.padding ?? 0);
  if (
    node.type === 'stack' ||
    (node.type === 'panel' && node.childrenLayout === 'stack')
  ) {
    const stackContent =
      node.type === 'panel' && node.title
        ? {
            ...inner,
            y: inner.y + 48,
            height: clampSize(inner.height - 48),
          }
        : inner;
    return {
      node,
      bounds: ownBounds,
      children: node.children.map((child) => {
        const align = child.alignSelf ?? 'stretch';
        const width = Math.min(
          stackContent.width,
          child.width ??
            (align === 'stretch'
              ? stackContent.width
              : intrinsicSize(child, 'horizontal', env)),
        );
        const height = Math.min(
          stackContent.height,
          child.height ?? stackContent.height,
        );
        const justify = child.justifySelf ?? 'center';
        const horizontalOffset =
          align === 'center'
            ? (stackContent.width - width) / 2
            : align === 'end'
              ? stackContent.width - width
              : 0;
        const verticalOffset =
          justify === 'center'
            ? (stackContent.height - height) / 2
            : justify === 'end'
              ? stackContent.height - height
              : 0;
        const childBounds = {
          x: stackContent.x + horizontalOffset,
          y: stackContent.y + verticalOffset,
          width: clampSize(width),
          height: clampSize(height),
        };
        return makeLayoutNode(child, childBounds, env);
      }),
    };
  }

  const direction: Axis = node.type === 'row' ? 'horizontal' : 'vertical';
  const content =
    node.type === 'panel' && node.title
      ? {
          ...inner,
          y: inner.y + 48,
          height: clampSize(inner.height - 48),
        }
      : inner;
  const gap = clampSize(node.gap ?? 0);
  const mainSize = dimension(content, direction);
  const crossSize = crossDimension(content, direction);
  const bases = node.children.map((child) =>
    axisSize(child, direction) === undefined && (child.grow ?? 0) > 0
      ? 0
      : intrinsicSize(child, direction, env),
  );
  const gapsSize = gap * Math.max(0, node.children.length - 1);
  const growTotal = node.children.reduce(
    (sum, child) => sum + Math.max(0, child.grow ?? 0),
    0,
  );
  const free = Math.max(
    0,
    mainSize - gapsSize - bases.reduce((a, b) => a + b, 0),
  );
  const sizes = node.children.map(
    (child, index) =>
      bases[index] +
      (growTotal > 0 ? (free * Math.max(0, child.grow ?? 0)) / growTotal : 0),
  );
  const used = sizes.reduce((sum, size) => sum + size, 0) + gapsSize;
  const leftover = Math.max(0, mainSize - used);
  const justify = node.justify ?? 'start';
  const offset =
    justify === 'center' ? leftover / 2 : justify === 'end' ? leftover : 0;
  const distributedGap =
    justify === 'space-between' && node.children.length > 1
      ? leftover / (node.children.length - 1)
      : 0;
  let cursor = (direction === 'horizontal' ? content.x : content.y) + offset;

  const children = node.children.map((child, index) => {
    const main = sizes[index];
    const align = child.alignSelf ?? node.align ?? 'stretch';
    const naturalCross = intrinsicSize(
      child,
      direction === 'horizontal' ? 'vertical' : 'horizontal',
      env,
    );
    const cross =
      (direction === 'horizontal' ? child.height : child.width) ??
      (align === 'stretch' ? crossSize : Math.min(crossSize, naturalCross));
    const crossOffset =
      align === 'center'
        ? (crossSize - cross) / 2
        : align === 'end'
          ? crossSize - cross
          : 0;
    const childBounds: Rect =
      direction === 'horizontal'
        ? {
            x: cursor,
            y: content.y + crossOffset,
            width: clampSize(main),
            height: clampSize(cross),
          }
        : {
            x: content.x + crossOffset,
            y: cursor,
            width: clampSize(cross),
            height: clampSize(main),
          };
    cursor += main + gap + distributedGap;
    return makeLayoutNode(child, childBounds, env);
  });
  return { node, bounds: ownBounds, children };
};

const isContainer = (node: CompositionNode): node is ContainerNode =>
  node.type === 'row' ||
  node.type === 'column' ||
  node.type === 'stack' ||
  node.type === 'panel';

/** Computes deterministic, canvas-free bounds for a declarative tree. */
export const layoutComposition = (
  node: CompositionNode,
  viewBounds: Rect,
  env: UiEnv,
): CompositionLayoutNode => makeLayoutNode(node, viewBounds, env);

const hitTestNode = (
  layout: CompositionLayoutNode,
  point: { readonly x: number; readonly y: number },
): CompositionHit => {
  if (
    layout.node.clipChildren &&
    !isPointInRect(point.x, point.y, layout.bounds)
  ) {
    return null;
  }
  for (let index = layout.children.length - 1; index >= 0; index -= 1) {
    const hit = hitTestNode(layout.children[index], point);
    if (hit) return hit;
  }
  if (!isPointInRect(point.x, point.y, layout.bounds)) return null;
  switch (layout.node.type) {
    case 'button':
      return { kind: 'button', actionId: layout.node.actionId };
    case 'checkbox':
      return { kind: 'checkbox', actionId: layout.node.actionId };
    case 'textInput':
      return { kind: 'textInput', actionId: layout.node.actionId };
    case 'hitTarget':
      return { kind: 'hitTarget', actionId: layout.node.actionId };
    default:
      return null;
  }
};

/** Returns the top-most interactive node's consumer-owned action id. */
export const hitTestComposition = (
  layout: CompositionLayoutNode,
  point: { readonly x: number; readonly y: number },
): CompositionHit => hitTestNode(layout, point);

const imageDimensions = (
  image: CanvasImageSource,
): { width: number; height: number } => {
  const dimensions = image as {
    naturalWidth?: number;
    naturalHeight?: number;
    width?: number;
    height?: number;
  };
  return {
    width: dimensions.naturalWidth || dimensions.width || 0,
    height: dimensions.naturalHeight || dimensions.height || 0,
  };
};

const resolveImage = (
  ui: UiContext,
  override: CompositionImageOverride | undefined,
): CanvasImageSource | undefined => {
  if (!override) return undefined;
  if (override.source !== undefined) return override.source ?? undefined;
  return override.assetId ? ui.assets.get(override.assetId) : undefined;
};

const drawImage = (
  ui: UiContext,
  image: CanvasImageSource,
  bounds: Rect,
  fit: CompositionImageFit = 'cover',
): void => {
  const { ctx } = ui;
  const { width: sourceWidth, height: sourceHeight } = imageDimensions(image);
  if (bounds.width <= 0 || bounds.height <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.clip();
  if (fit === 'stretch' || sourceWidth <= 0 || sourceHeight <= 0) {
    ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
  } else {
    const scale =
      fit === 'cover'
        ? Math.max(bounds.width / sourceWidth, bounds.height / sourceHeight)
        : Math.min(bounds.width / sourceWidth, bounds.height / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    ctx.drawImage(
      image,
      bounds.x + (bounds.width - width) / 2,
      bounds.y + (bounds.height - height) / 2,
      width,
      height,
    );
  }
  ctx.restore();
};

const drawOverride = (
  ui: UiContext,
  node: CompositionNode,
  bounds: Rect,
): boolean => {
  const image = resolveImage(ui, node.imageOverride);
  if (!image) return false;
  drawImage(ui, image, bounds, node.imageOverride?.fit);
  return true;
};

const drawFallbackTile = (ui: UiContext, bounds: Rect): void => {
  const { ctx, theme } = ui;
  ctx.fillStyle = theme.palette.surface.row;
  drawRoundedRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 4);
  ctx.fill();
  ctx.strokeStyle = theme.palette.border.row;
  ctx.lineWidth = theme.shape.strokeWidth.thin;
  drawRoundedRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 4);
  ctx.stroke();
};

const drawWelcomeFallback = (ui: UiContext, bounds: Rect): void => {
  const { ctx, theme } = ui;
  const { width, height } = bounds;
  ctx.fillStyle = theme.palette.surface.welcome;
  ctx.fillRect(bounds.x, bounds.y, width, height);
  const gradient = ctx.createRadialGradient(
    bounds.x + width / 2,
    bounds.y + height / 2,
    Math.min(width, height) / 3,
    bounds.x + width / 2,
    bounds.y + height / 2,
    Math.max(width, height) / 1.5,
  );
  gradient.addColorStop(0, theme.palette.overlay.vignetteStart);
  gradient.addColorStop(1, theme.palette.overlay.vignetteEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(bounds.x, bounds.y, width, height);
};

const drawImageFallback = (
  ui: UiContext,
  bounds: Rect,
  fallback: CompositionImage['fallback'],
): void => {
  if (fallback === 'welcome') drawWelcomeFallback(ui, bounds);
  else drawFallbackTile(ui, bounds);
};

const drawCompositionImageFallback = (
  ui: UiContext,
  node: CompositionImage,
  bounds: Rect,
): void => {
  drawImageFallback(ui, bounds, node.fallback);
  if (node.fallbackText) {
    drawText(
      ui,
      [node.fallbackText],
      bounds,
      'body',
      'center',
      'middle',
      node.themeStyle,
    );
  }
};

const drawText = (
  ui: UiContext,
  lines: readonly string[],
  bounds: Rect,
  role: CompositionText['role'] = 'body',
  align: CanvasTextAlign = 'left',
  baseline: CanvasTextBaseline = 'middle',
  style?: CompositionThemeStyle,
  lineHeightPx = role === 'heading' ? 28 : 22,
  clip = false,
  decoration?: CompositionText['decoration'],
): void => {
  const { ctx, theme } = ui;
  ctx.font = textFont(ui, role, style);
  const defaultTextToken =
    role === 'heading'
      ? 'headerDialog'
      : role === 'footer'
        ? 'faint'
        : role === 'muted'
          ? 'muted'
          : 'body';
  ctx.fillStyle =
    style?.textColor ?? theme.palette.text[style?.text ?? defaultTextToken];
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  const x =
    align === 'center'
      ? bounds.x + bounds.width / 2
      : align === 'right' || align === 'end'
        ? bounds.x + bounds.width
        : bounds.x;
  if (clip) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.clip();
  }
  lines.forEach((line, index) => {
    const y =
      baseline === 'bottom'
        ? bounds.y + bounds.height - (lines.length - index - 1) * lineHeightPx
        : baseline === 'top'
          ? bounds.y + index * lineHeightPx
          : bounds.y +
            bounds.height / 2 +
            (index - (lines.length - 1) / 2) * lineHeightPx;
    ctx.fillText(line, x, y);
    if (decoration === 'strikethrough') {
      const strikeY =
        baseline === 'top'
          ? y + lineHeightPx / 2
          : baseline === 'bottom'
            ? y - lineHeightPx / 2
            : y;
      ctx.strokeStyle =
        style?.textColor ?? theme.palette.text[style?.text ?? defaultTextToken];
      ctx.lineWidth = theme.shape.strokeWidth[style?.strokeWidth ?? 'thin'];
      ctx.beginPath();
      ctx.moveTo(x, strikeY);
      ctx.lineTo(x + ctx.measureText(line).width, strikeY);
      ctx.stroke();
    }
  });
  if (clip) ctx.restore();
};

const drawCheckbox = (
  ui: UiContext,
  bounds: Rect,
  checked: boolean,
  hovered: boolean,
  style?: CompositionThemeStyle,
): void => {
  const { ctx, theme } = ui;
  const size = Math.min(20, bounds.height);
  const box = {
    x: bounds.x,
    y: bounds.y + (bounds.height - size) / 2,
    width: size,
    height: size,
  };
  const surfaceToken =
    style?.surface ?? (checked ? 'checkboxSelected' : 'checkbox');
  const borderToken =
    style?.border ??
    (checked ? 'checkboxSelected' : hovered ? 'rowHover' : 'input');
  ctx.fillStyle = style?.fillColor ?? theme.palette.surface[surfaceToken];
  drawRoundedRect(ctx, box.x, box.y, box.width, box.height, style?.radius ?? 4);
  ctx.fill();
  ctx.strokeStyle = style?.strokeColor ?? theme.palette.border[borderToken];
  ctx.lineWidth = theme.shape.strokeWidth[style?.strokeWidth ?? 'thin'];
  drawRoundedRect(ctx, box.x, box.y, box.width, box.height, style?.radius ?? 4);
  ctx.stroke();
  if (checked) {
    ctx.strokeStyle =
      style?.textColor ?? theme.palette.text[style?.text ?? 'bright'];
    ctx.lineWidth = theme.shape.strokeWidth[style?.strokeWidth ?? 'regular'];
    ctx.beginPath();
    ctx.moveTo(box.x + 5, box.y + box.height / 2);
    ctx.lineTo(box.x + box.width / 2 - 1, box.y + box.height - 5);
    ctx.lineTo(box.x + box.width - 4, box.y + 4);
    ctx.stroke();
  }
};

const activeThemeStyle = (
  style: CompositionThemeStyle | undefined,
  hoverStyle: CompositionThemeStyle | undefined,
  hovered: boolean,
): CompositionThemeStyle | undefined =>
  style || (hovered && hoverStyle)
    ? { ...style, ...(hovered ? hoverStyle : undefined) }
    : undefined;

const drawStyledButton = (
  ui: UiContext,
  bounds: Rect,
  label: string,
  variant: CompositionButton['variant'],
  style: CompositionThemeStyle,
  hovered: boolean,
): void => {
  const { ctx, theme } = ui;
  const isRow = variant === 'row';
  const isSecondary = variant === 'secondary';
  const defaultSurface = isRow
    ? hovered
      ? 'rowHover'
      : 'row'
    : isSecondary
      ? hovered
        ? 'buttonSecondaryHover'
        : 'buttonSecondary'
      : hovered
        ? 'buttonPrimaryHover'
        : 'buttonPrimary';
  const defaultBorder = isRow
    ? 'row'
    : isSecondary
      ? 'buttonSecondary'
      : 'buttonPrimary';
  drawRoundedRect(
    ctx,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    style.radius ?? 6,
  );
  ctx.fillStyle =
    style.fillColor ?? theme.palette.surface[style.surface ?? defaultSurface];
  ctx.fill();
  ctx.strokeStyle =
    style.strokeColor ?? theme.palette.border[style.border ?? defaultBorder];
  ctx.lineWidth = theme.shape.strokeWidth[style.strokeWidth ?? 'medium'];
  ctx.stroke();
  drawText(
    ui,
    [label],
    {
      x: bounds.x + (isRow ? 12 : 0),
      y: bounds.y,
      width: bounds.width - (isRow ? 12 : 0),
      height: bounds.height,
    },
    'body',
    isRow ? 'left' : 'center',
    'middle',
    {
      ...style,
      text:
        style.text ??
        (isRow
          ? hovered
            ? 'bright'
            : 'dialogValue'
          : isSecondary
            ? 'body'
            : 'bright'),
      fontSize: style.fontSize ?? (isRow ? 'lg' : 'xl'),
      fontWeight: style.fontWeight ?? 'bold',
    },
  );
};

const drawStyledTextInput = (
  ui: UiContext,
  bounds: Rect,
  value: string,
  focused: boolean,
  style: CompositionThemeStyle,
): void => {
  const { ctx, theme } = ui;
  drawRoundedRect(
    ctx,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    style.radius ?? 4,
  );
  ctx.fillStyle =
    style.fillColor ?? theme.palette.surface[style.surface ?? 'input'];
  ctx.fill();
  ctx.strokeStyle =
    style.strokeColor ??
    theme.palette.border[style.border ?? (focused ? 'inputFocus' : 'input')];
  ctx.lineWidth =
    theme.shape.strokeWidth[style.strokeWidth ?? (focused ? 'medium' : 'thin')];
  ctx.stroke();
  const centerY = bounds.y + bounds.height / 2;
  ctx.font = composeFont(
    theme,
    theme.typography.sizes[style.fontSize ?? 'xl'],
    theme.typography.weights[style.fontWeight ?? 'regular'],
    style.fontFamily ? theme.typography.families[style.fontFamily] : undefined,
  );
  ctx.fillStyle = style.textColor ?? theme.palette.text[style.text ?? 'strong'];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, bounds.x + 10, centerY);
  if (focused) {
    ctx.fillRect(
      bounds.x + 12 + ctx.measureText(value).width,
      centerY - 9,
      1,
      18,
    );
  }
};

const renderNode = (
  layout: CompositionLayoutNode,
  ui: UiContext,
  options: CompositionRenderOptions,
): void => {
  const { node, bounds } = layout;
  const { ctx, theme } = ui;
  if (isContainer(node)) {
    if (node.type === 'panel') {
      if (!drawOverride(ui, node, bounds)) {
        if (node.themeStyle) {
          const style = node.themeStyle;
          drawRoundedRect(
            ctx,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            style.radius ?? 10,
          );
          ctx.fillStyle =
            style.fillColor ??
            theme.palette.surface[style.surface ?? 'panelDialog'];
          ctx.fill();
          ctx.strokeStyle =
            style.strokeColor ??
            theme.palette.border[style.border ?? 'panelDialog'];
          ctx.lineWidth =
            theme.shape.strokeWidth[style.strokeWidth ?? 'regular'];
          ctx.stroke();
        } else {
          drawModalFrame(ctx, bounds, theme);
        }
      }
      if (node.title) {
        if (node.themeStyle) {
          drawText(
            ui,
            [node.title],
            {
              x: bounds.x + MODAL_HEADER_OFFSET_X,
              y: bounds.y + MODAL_HEADER_OFFSET_Y,
              width: bounds.width - MODAL_HEADER_OFFSET_X * 2,
              height: 28,
            },
            'heading',
            'left',
            'top',
            node.themeStyle,
          );
        } else {
          drawModalHeader(ctx, bounds, node.title, theme);
        }
      }
    } else if (node.imageOverride) {
      if (!drawOverride(ui, node, bounds)) drawFallbackTile(ui, bounds);
    }
    if (node.clipChildren) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.clip();
    }
    for (const child of layout.children) renderNode(child, ui, options);
    if (node.clipChildren) ctx.restore();
    return;
  }

  switch (node.type) {
    case 'spacer':
      if (node.imageOverride && !drawOverride(ui, node, bounds)) {
        drawFallbackTile(ui, bounds);
      }
      return;
    case 'text':
      if (!drawOverride(ui, node, bounds)) {
        drawText(
          ui,
          layout.textLines ?? [node.text],
          bounds,
          node.role,
          node.align,
          node.baseline,
          node.themeStyle,
          lineHeight(node),
          node.clip,
          node.decoration,
        );
      }
      return;
    case 'fill': {
      if (drawOverride(ui, node, bounds)) return;
      const style = node.themeStyle;
      const fill =
        style?.fillColor ??
        (style?.overlay
          ? theme.palette.overlay[style.overlay]
          : theme.palette.surface[style?.surface ?? 'row']);
      if (node.shape === 'roundedRect') {
        drawRoundedRect(
          ctx,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          style?.radius ?? 4,
        );
        ctx.fillStyle = fill;
        ctx.fill();
      } else {
        ctx.fillStyle = fill;
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }
      if (style?.border || style?.strokeColor) {
        ctx.strokeStyle =
          style.strokeColor ?? theme.palette.border[style.border ?? 'hairline'];
        ctx.lineWidth = theme.shape.strokeWidth[style.strokeWidth ?? 'thin'];
        if (node.shape === 'roundedRect') {
          ctx.stroke();
        } else {
          ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }
      }
      return;
    }
    case 'line': {
      if (drawOverride(ui, node, bounds)) return;
      const style = node.themeStyle;
      ctx.strokeStyle =
        style?.strokeColor ?? theme.palette.border[style?.border ?? 'hairline'];
      ctx.lineWidth = theme.shape.strokeWidth[style?.strokeWidth ?? 'thin'];
      ctx.beginPath();
      if (node.orientation === 'horizontal') {
        const y = bounds.y + bounds.height / 2;
        ctx.moveTo(bounds.x, y);
        ctx.lineTo(bounds.x + bounds.width, y);
      } else {
        const x = bounds.x + bounds.width / 2;
        ctx.moveTo(x, bounds.y);
        ctx.lineTo(x, bounds.y + bounds.height);
      }
      ctx.stroke();
      return;
    }
    case 'hitTarget':
      return;
    case 'button': {
      const hovered = options.hoveredActionId === node.actionId;
      const overridden = drawOverride(ui, node, bounds);
      const style = activeThemeStyle(
        node.themeStyle,
        node.hoverThemeStyle,
        hovered,
      );
      if (style) {
        if (!overridden) {
          drawStyledButton(
            ui,
            bounds,
            node.label,
            node.variant,
            style,
            hovered,
          );
        } else {
          drawText(
            ui,
            [node.label],
            bounds,
            'body',
            node.variant === 'row' ? 'left' : 'center',
            'middle',
            style,
          );
        }
      } else if (node.variant === 'row') {
        if (!overridden) {
          drawListRow(
            ctx,
            bounds,
            listRowStyles(theme, hovered ? 'hover' : 'rest'),
            6,
          );
        }
        ctx.font = composeFont(
          theme,
          theme.typography.sizes.lg,
          theme.typography.weights.bold,
        );
        ctx.fillStyle = hovered
          ? theme.palette.text.bright
          : theme.palette.text.dialogValue;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, bounds.x + 12, bounds.y + bounds.height / 2);
      } else if (!overridden) {
        drawButton(ctx, bounds, node.label, theme, {
          variant: node.variant ?? 'primary',
          hovered,
        });
      } else {
        ctx.font = composeFont(
          theme,
          theme.typography.sizes.xl,
          theme.typography.weights.bold,
        );
        ctx.fillStyle =
          node.variant === 'secondary'
            ? theme.palette.text.body
            : theme.palette.text.bright;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          node.label,
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
      }
      return;
    }
    case 'checkbox': {
      const hovered = options.hoveredActionId === node.actionId;
      const style = activeThemeStyle(
        node.themeStyle,
        node.hoverThemeStyle,
        hovered,
      );
      const size = Math.min(20, bounds.height);
      const box = {
        x: bounds.x,
        y: bounds.y + (bounds.height - size) / 2,
        width: size,
        height: size,
      };
      if (!drawOverride(ui, node, box)) {
        drawCheckbox(ui, bounds, node.checked, hovered, style);
      }
      if (node.label) {
        drawText(
          ui,
          [node.label],
          {
            x: bounds.x + size + 10,
            y: bounds.y,
            width: clampSize(bounds.width - size - 10),
            height: bounds.height,
          },
          'body',
          'left',
          'middle',
          style,
        );
      }
      return;
    }
    case 'textInput': {
      const focused = options.focusedActionId
        ? options.focusedActionId === node.actionId
        : (node.focused ?? false);
      const style = activeThemeStyle(
        node.themeStyle,
        node.hoverThemeStyle,
        options.hoveredActionId === node.actionId,
      );
      if (!drawOverride(ui, node, bounds)) {
        if (style) {
          drawStyledTextInput(ui, bounds, node.value, focused, style);
        } else {
          drawTextInput(ctx, bounds, node.value, theme, { focused });
        }
      } else {
        const centerY = bounds.y + bounds.height / 2;
        ctx.font = composeFont(theme, theme.typography.sizes.xl);
        ctx.fillStyle = theme.palette.text.strong;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.value, bounds.x + 10, centerY);
        if (focused) {
          ctx.fillRect(
            bounds.x + 12 + ctx.measureText(node.value).width,
            centerY - 9,
            1,
            18,
          );
        }
      }
      return;
    }
    case 'image': {
      const override = resolveImage(ui, node.imageOverride);
      const source =
        override ??
        (!node.imageOverride && node.sprite
          ? ui.assets.get(node.sprite.assetId)
          : !node.imageOverride && node.assetId
            ? ui.assets.get(node.assetId)
            : undefined);
      if (source && node.sprite && !node.imageOverride) {
        const size = Math.min(bounds.width, bounds.height);
        const x = bounds.x + (bounds.width - size) / 2;
        const y = bounds.y + (bounds.height - size) / 2;
        if (!drawSpriteFrame(ctx, ui.assets, node.sprite, x, y, size)) {
          drawCompositionImageFallback(ui, node, bounds);
        }
      } else if (source) {
        drawImage(ui, source, bounds, node.imageOverride?.fit ?? node.fit);
      } else {
        drawCompositionImageFallback(ui, node, bounds);
      }
      return;
    }
    case 'meter': {
      const overridden = drawOverride(ui, node, bounds);
      const style = node.themeStyle;
      const ratio =
        node.max > 0 ? Math.min(1, Math.max(0, node.value / node.max)) : 0;
      if (!overridden) {
        ctx.fillStyle =
          style?.fillColor ?? theme.palette.surface[style?.surface ?? 'input'];
        drawRoundedRect(
          ctx,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          style?.radius ?? 4,
        );
        ctx.fill();
        ctx.strokeStyle =
          style?.strokeColor ?? theme.palette.border[style?.border ?? 'input'];
        ctx.lineWidth = theme.shape.strokeWidth[style?.strokeWidth ?? 'thin'];
        drawRoundedRect(
          ctx,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          style?.radius ?? 4,
        );
        ctx.stroke();
        ctx.fillStyle = theme.palette.surface[style?.surface ?? 'sliderFill'];
        drawRoundedRect(
          ctx,
          bounds.x,
          bounds.y,
          bounds.width * ratio,
          bounds.height,
          style?.radius ?? 4,
        );
        ctx.fill();
      }
      if (node.label)
        drawText(ui, [node.label], bounds, 'muted', 'center', 'middle', style);
      return;
    }
  }
};

/** Draws the tree back-to-front in child order through the supplied context. */
export const renderComposition = (
  layout: CompositionLayoutNode,
  ui: UiContext,
  options: CompositionRenderOptions = {},
): void => {
  if (!ui.ctx) return;
  renderNode(layout, ui, options);
};
