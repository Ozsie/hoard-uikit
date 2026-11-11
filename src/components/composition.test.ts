import { describe, expect, it } from 'vitest';
import { defaultTheme } from '@hoard-engine/primitives';
import type { UiContext, UiEnv } from '../env';
import { createRecordingContext, createSentinelTheme } from '../testing';
import {
  hitTestComposition,
  layoutComposition,
  renderComposition,
  type CompositionNode,
} from './composition';

const env: UiEnv = {
  theme: defaultTheme,
  mode: 'regular',
  t: (key) => key,
  measure: { width: (text) => text.length * 8 },
};

const ui = (
  ctx: CanvasRenderingContext2D,
  theme = defaultTheme,
  get: (id: string) => CanvasImageSource | undefined = () => undefined,
): UiContext => ({
  ...env,
  theme,
  ctx,
  assets: { get },
});

describe('composition', () => {
  it('lays out rows with gaps, fixed sizes and weighted spacers', () => {
    const node: CompositionNode = {
      type: 'row',
      gap: 10,
      align: 'center',
      children: [
        {
          type: 'button',
          actionId: 'first',
          label: 'First',
          width: 100,
          height: 40,
        },
        { type: 'spacer', grow: 1, height: 60 },
        {
          type: 'button',
          actionId: 'last',
          label: 'Last',
          width: 80,
          height: 40,
        },
      ],
    };
    const layout = layoutComposition(
      node,
      { x: 10, y: 20, width: 300, height: 60 },
      env,
    );

    expect(layout.children.map(({ bounds }) => bounds)).toEqual([
      { x: 10, y: 30, width: 100, height: 40 },
      { x: 120, y: 20, width: 100, height: 60 },
      { x: 230, y: 30, width: 80, height: 40 },
    ]);
  });

  it('uses topmost interactive children and returns semantic action ids', () => {
    const layout = layoutComposition(
      {
        type: 'stack',
        children: [
          { type: 'button', actionId: 'under', label: 'Under' },
          { type: 'checkbox', actionId: 'over', label: 'Over', checked: true },
        ],
      },
      { x: 0, y: 0, width: 100, height: 40 },
      env,
    );

    expect(hitTestComposition(layout, { x: 5, y: 5 })).toEqual({
      kind: 'checkbox',
      actionId: 'over',
    });
    expect(hitTestComposition(layout, { x: 101, y: 5 })).toBeNull();
  });

  it('positions layered stack children independently', () => {
    const layout = layoutComposition(
      {
        type: 'stack',
        children: [
          { type: 'image', assetId: 'background' },
          {
            type: 'panel',
            width: 200,
            height: 100,
            alignSelf: 'center',
            justifySelf: 'center',
            children: [],
          },
          {
            type: 'text',
            text: 'Footer',
            width: 400,
            height: 10,
            align: 'center',
            justifySelf: 'end',
          },
        ],
      },
      { x: 0, y: 0, width: 400, height: 300 },
      env,
    );

    expect(layout.children.map(({ bounds }) => bounds)).toEqual([
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 100, y: 100, width: 200, height: 100 },
      { x: 0, y: 290, width: 400, height: 10 },
    ]);
  });

  it('lays out overlaid panel children from the panel origin', () => {
    const layout = layoutComposition(
      {
        type: 'panel',
        width: 100,
        height: 80,
        childrenLayout: 'stack',
        children: [
          {
            type: 'hitTarget',
            actionId: 'target',
            width: 20,
            height: 20,
            alignSelf: 'start',
            justifySelf: 'start',
            offsetX: 30,
            offsetY: 40,
          },
        ],
      },
      { x: 10, y: 20, width: 100, height: 80 },
      env,
    );

    expect(layout.children[0].bounds).toEqual({
      x: 40,
      y: 60,
      width: 20,
      height: 20,
    });
    expect(hitTestComposition(layout, { x: 45, y: 65 })).toEqual({
      kind: 'hitTarget',
      actionId: 'target',
    });
  });

  it('renders row buttons with themed list-row styling', () => {
    const layout = layoutComposition(
      {
        type: 'button',
        actionId: 'settings',
        label: 'Settings',
        variant: 'row',
      },
      { x: 10, y: 20, width: 200, height: 48 },
      env,
    );
    const rec = createRecordingContext();

    renderComposition(layout, ui(rec.ctx), { hoveredActionId: 'settings' });

    expect(rec.log).toContain('fillText("Settings", 22, 44)');
    expect(rec.log).toContain(
      `fillStyle="${defaultTheme.palette.text.bright}"`,
    );
  });

  it('does not draw a label for an unlabeled checkbox', () => {
    const layout = layoutComposition(
      { type: 'checkbox', actionId: 'selected', label: '', checked: true },
      { x: 0, y: 0, width: 20, height: 20 },
      env,
    );
    const rec = createRecordingContext();

    renderComposition(layout, ui(rec.ctx));

    expect(rec.log.some((entry) => entry.startsWith('fillText('))).toBe(false);
  });

  it('draws the welcome image fallback from theme tokens', () => {
    const sentinel = createSentinelTheme(defaultTheme);
    const layout = layoutComposition(
      {
        type: 'image',
        assetId: 'welcome.background',
        fit: 'cover',
        fallback: 'welcome',
      },
      { x: 0, y: 0, width: 800, height: 600 },
      { ...env, theme: sentinel },
    );
    const rec = createRecordingContext();

    renderComposition(layout, ui(rec.ctx, sentinel));

    expect(rec.log).toContain('fillStyle="⟦palette.surface.welcome⟧"');
    expect(rec.log).toContain(
      'addColorStop(0, "⟦palette.overlay.vignetteStart⟧")',
    );
    expect(rec.log).toContain(
      'addColorStop(1, "⟦palette.overlay.vignetteEnd⟧")',
    );
  });

  it('lays out and renders all generic controls and a meter', () => {
    const node: CompositionNode = {
      type: 'column',
      gap: 4,
      children: [
        { type: 'button', actionId: 'save', label: 'Save', height: 40 },
        {
          type: 'checkbox',
          actionId: 'enabled',
          label: 'Enabled',
          checked: true,
        },
        { type: 'textInput', actionId: 'name', value: 'Run', focused: true },
        { type: 'meter', value: 3, max: 5, label: 'Health', height: 20 },
      ],
    };
    const layout = layoutComposition(
      node,
      { x: 0, y: 0, width: 240, height: 160 },
      env,
    );
    const rec = createRecordingContext();

    renderComposition(layout, ui(rec.ctx), { hoveredActionId: 'save' });

    expect(layout.children.map(({ bounds }) => bounds.y)).toEqual([
      0, 44, 72, 112,
    ]);
    expect(hitTestComposition(layout, { x: 4, y: 4 })).toEqual({
      kind: 'button',
      actionId: 'save',
    });
    expect(hitTestComposition(layout, { x: 4, y: 48 })).toEqual({
      kind: 'checkbox',
      actionId: 'enabled',
    });
    expect(hitTestComposition(layout, { x: 4, y: 76 })).toEqual({
      kind: 'textInput',
      actionId: 'name',
    });
    expect(rec.log).toContain(
      `fillStyle="${defaultTheme.palette.surface.buttonPrimaryHover}"`,
    );
    expect(rec.log).toContain('fillText("Enabled", 30, 56)');
    expect(rec.log).toContain('fillText("Run", 10, 90)');
    expect(rec.log).toContain('fillText("Health", 120, 122)');
  });

  it('keeps bounds and semantic hits when an image override is missing', () => {
    const node: CompositionNode = {
      type: 'button',
      actionId: 'continue',
      label: 'Continue',
      width: 160,
      height: 40,
      imageOverride: { assetId: 'missing.button' },
    };
    const bounds = { x: 20, y: 10, width: 200, height: 60 };
    const layout = layoutComposition(node, bounds, env);
    const rec = createRecordingContext();

    renderComposition(layout, ui(rec.ctx));

    expect(layout.bounds).toEqual({ x: 40, y: 20, width: 160, height: 40 });
    expect(hitTestComposition(layout, { x: 50, y: 30 })).toEqual({
      kind: 'button',
      actionId: 'continue',
    });
    expect(rec.log).toContain(
      `fillStyle="${defaultTheme.palette.surface.buttonPrimary}"`,
    );
    expect(rec.log.some((entry) => entry.startsWith('drawImage('))).toBe(false);
  });

  it('draws an available image override in place of its visual', () => {
    const image = { width: 320, height: 80 } as CanvasImageSource;
    const layout = layoutComposition(
      {
        type: 'button',
        actionId: 'start',
        label: 'Start',
        width: 120,
        height: 40,
        imageOverride: { assetId: 'button.image', fit: 'contain' },
      },
      { x: 0, y: 0, width: 120, height: 40 },
      env,
    );
    const rec = createRecordingContext();

    renderComposition(
      layout,
      ui(rec.ctx, defaultTheme, () => image),
    );

    expect(rec.log).toContain('drawImage(image, 0, 5, 120, 30)');
    expect(rec.log).toContain('fillText("Start", 60, 20)');
    expect(rec.log).not.toContain('fill()');
    expect(hitTestComposition(layout, { x: 1, y: 1 })).toEqual({
      kind: 'button',
      actionId: 'start',
    });
  });

  it('uses a themed fallback for unavailable images and layers panel content', () => {
    const sentinel = createSentinelTheme(defaultTheme);
    const node: CompositionNode = {
      type: 'panel',
      title: 'Panel',
      width: 200,
      height: 120,
      imageOverride: { assetId: 'missing.panel' },
      children: [
        {
          type: 'image',
          assetId: 'missing.art',
          width: 40,
          height: 30,
        },
        { type: 'text', text: 'Content' },
      ],
    };
    const layout = layoutComposition(
      node,
      { x: 0, y: 0, width: 240, height: 140 },
      { ...env, theme: sentinel },
    );
    const rec = createRecordingContext();

    renderComposition(layout, ui(rec.ctx, sentinel));

    expect(rec.log[0]).toBe(`fillStyle="⟦palette.surface.panelDialog⟧"`);
    expect(rec.log).toContain('fillStyle="⟦palette.surface.row⟧"');
    expect(rec.log.indexOf('fillText("Panel", 38, 24)')).toBeLessThan(
      rec.log.indexOf('fillText("Content", 20, 99)'),
    );
    expect(layout.children[0].bounds).toEqual({
      x: 20,
      y: 58,
      width: 40,
      height: 30,
    });
    const styleWrites = rec.log.filter((entry) =>
      /^(fillStyle|strokeStyle|font)=/.test(entry),
    );
    expect(styleWrites.every((entry) => entry.includes('⟦'))).toBe(true);
  });

  it('wraps and clips text within its measured bounds', () => {
    const layout = layoutComposition(
      {
        type: 'text',
        text: 'first second',
        width: 40,
        height: 24,
        wrap: true,
        lineHeight: 12,
        maxLines: 2,
        clip: true,
        baseline: 'top',
      },
      { x: 4, y: 5, width: 40, height: 24 },
      env,
    );
    const rec = createRecordingContext();

    renderComposition(layout, ui(rec.ctx));

    expect(layout.textLines).toEqual(['first', 'second']);
    expect(rec.log).toContain('clip()');
    expect(rec.log).toContain('fillText("first", 4, 5)');
    expect(rec.log).toContain('fillText("second", 4, 17)');
  });

  it('uses theme tokens for custom panel and text styling', () => {
    const sentinel = createSentinelTheme(defaultTheme);
    const layout = layoutComposition(
      {
        type: 'stack',
        children: [
          {
            type: 'panel',
            width: 100,
            height: 60,
            themeStyle: {
              surface: 'panelCorner',
              border: 'hairline',
              strokeWidth: 'thin',
              radius: 6,
            },
            children: [],
          },
          {
            type: 'text',
            text: 'Styled',
            width: 100,
            height: 20,
            themeStyle: {
              text: 'cardTitle',
              fontSize: 'sm',
              fontWeight: 'bold',
            },
          },
        ],
      },
      { x: 0, y: 0, width: 100, height: 80 },
      { ...env, theme: sentinel },
    );
    const rec = createRecordingContext();

    renderComposition(layout, ui(rec.ctx, sentinel));

    expect(rec.log).toContain('fillStyle="⟦palette.surface.panelCorner⟧"');
    expect(rec.log).toContain('strokeStyle="⟦palette.border.hairline⟧"');
    expect(rec.log).toContain('fillStyle="⟦palette.text.cardTitle⟧"');
  });

  it('draws sprite frames and clips child hit regions with their container', () => {
    const image = { width: 64, height: 32 } as CanvasImageSource;
    const layout = layoutComposition(
      {
        type: 'row',
        clipChildren: true,
        children: [
          {
            type: 'button',
            actionId: 'wide',
            label: 'Wide',
            width: 200,
            height: 40,
          },
        ],
      },
      { x: 0, y: 0, width: 100, height: 40 },
      env,
    );
    const rec = createRecordingContext();

    renderComposition(
      layout,
      ui(rec.ctx, defaultTheme, (assetId) =>
        assetId === 'sheet' ? image : undefined,
      ),
    );

    const spriteLayout = layoutComposition(
      { type: 'image', sprite: { assetId: 'sheet', index: 5, size: 16 } },
      { x: 0, y: 0, width: 32, height: 32 },
      env,
    );
    renderComposition(
      spriteLayout,
      ui(rec.ctx, defaultTheme, (assetId) =>
        assetId === 'sheet' ? image : undefined,
      ),
    );

    expect(hitTestComposition(layout, { x: 50, y: 20 })).toEqual({
      kind: 'button',
      actionId: 'wide',
    });
    expect(hitTestComposition(layout, { x: 150, y: 20 })).toBeNull();
    expect(rec.log).toContain('drawImage(image, 16, 16, 16, 16, 0, 0, 32, 32)');
    expect(rec.log).toContain('rect(0, 0, 100, 40)');
    expect(rec.log.filter((entry) => entry === 'clip()')).toHaveLength(1);
  });

  it('renders themed fills, divider lines, and strikethrough text', () => {
    const sentinel = createSentinelTheme(defaultTheme);
    const rec = createRecordingContext();
    const fillLayout = layoutComposition(
      {
        type: 'fill',
        themeStyle: { overlay: 'scrimDialog' },
      },
      { x: 0, y: 0, width: 120, height: 80 },
      { ...env, theme: sentinel },
    );
    const lineLayout = layoutComposition(
      {
        type: 'line',
        orientation: 'horizontal',
        themeStyle: { border: 'divider', strokeWidth: 'thin' },
      },
      { x: 4, y: 10, width: 80, height: 0 },
      { ...env, theme: sentinel },
    );
    const textLayout = layoutComposition(
      {
        type: 'text',
        text: 'Done',
        width: 80,
        height: 20,
        decoration: 'strikethrough',
        baseline: 'middle',
      },
      { x: 4, y: 20, width: 80, height: 20 },
      { ...env, theme: sentinel },
    );

    renderComposition(fillLayout, ui(rec.ctx, sentinel));
    renderComposition(lineLayout, ui(rec.ctx, sentinel));
    renderComposition(textLayout, ui(rec.ctx, sentinel));

    expect(rec.log).toContain('fillStyle="⟦palette.overlay.scrimDialog⟧"');
    expect(rec.log).toContain('fillRect(0, 0, 120, 80)');
    expect(rec.log).toContain('strokeStyle="⟦palette.border.divider⟧"');
    expect(rec.log).toContain('moveTo(4, 10)');
    expect(rec.log).toContain('lineTo(84, 10)');
    expect(rec.log).toContain('lineTo(36, 30)');
  });

  it('positions invisible semantic targets and renders sprite fallback text', () => {
    const targetLayout = layoutComposition(
      {
        type: 'stack',
        children: [
          {
            type: 'hitTarget',
            actionId: 'card',
            width: 20,
            height: 20,
            offsetX: 20,
            offsetY: 10,
          },
        ],
      },
      { x: 0, y: 0, width: 100, height: 40 },
      env,
    );
    const imageLayout = layoutComposition(
      {
        type: 'image',
        sprite: { assetId: 'missing.sheet', index: 0, size: 16 },
        fallbackText: '⚔',
      },
      { x: 0, y: 0, width: 32, height: 32 },
      env,
    );
    const rec = createRecordingContext();

    renderComposition(targetLayout, ui(rec.ctx));
    renderComposition(imageLayout, ui(rec.ctx));

    expect(hitTestComposition(targetLayout, { x: 25, y: 25 })).toEqual({
      kind: 'hitTarget',
      actionId: 'card',
    });
    expect(hitTestComposition(targetLayout, { x: 5, y: 5 })).toBeNull();
    expect(rec.log).toContain('fillText("⚔", 16, 16)');
  });

  it('renders generic circles, asymmetric corners, and themed opacity', () => {
    const rec = createRecordingContext();
    const layout = layoutComposition(
      {
        type: 'stack',
        opacity: 'dimmed',
        children: [
          {
            type: 'fill',
            shape: 'circle',
            width: 20,
            height: 20,
            themeStyle: { overlay: 'scrimStrong', border: 'ring' },
          },
          {
            type: 'fill',
            shape: 'roundedRect',
            width: 40,
            height: 20,
            offsetX: 24,
            cornerRadii: [2, 8, 2, 8],
            themeStyle: { surface: 'item', border: 'subtle' },
          },
        ],
      },
      { x: 0, y: 0, width: 80, height: 30 },
      env,
    );

    renderComposition(layout, ui(rec.ctx));

    expect(rec.log).toContain('globalAlpha=0.5');
    expect(rec.log).toContain('arc(10, 15, 10, 0, 6.283185307179586)');
    expect(rec.log).toContain('arcTo(64, 5, 64, 13, 8)');
    expect(rec.log).toContain('arcTo(24, 5, 26, 5, 2)');
  });
});
