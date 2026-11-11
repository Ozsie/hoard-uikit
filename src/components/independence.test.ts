// The independence test: every component is driven by a hand-built view
// model alone — no GameState, no adapter, no fixture from the game side.
// For each component this builds a minimal view model, lays it out,
// hit-tests a region and renders into a recording context. It is both a
// usage contract (the kit is usable without the game) and a compile-time
// check that the view models are complete.
//
// The kit ships no strings: every label below is a stand-in the test
// itself provides (the translator is the identity), never a default.

import { describe, expect, it } from 'vitest';
import { createRecordingContext } from '../testing/index';
import { defaultTheme } from '@hoard-engine/primitives';
import type { UiContext, UiEnv } from '../env';

const env: UiEnv = {
  theme: defaultTheme,
  mode: 'regular',
  t: (key) => key,
  measure: { width: (text) => text.length * 6.5 },
};

const ui = (ctx: CanvasRenderingContext2D): UiContext => ({
  ...env,
  ctx,
  assets: { get: () => undefined },
});

const viewBounds = { x: 0, y: 0, width: 1280, height: 800 };

const rendersSomething = (log: readonly string[]): boolean =>
  log.some((entry) => entry.startsWith('fill') || entry.startsWith('stroke'));

import { hitTestMenu, layoutMenu, renderMenu } from './menu';
import {
  hitTestRadialMenu,
  layoutRadialMenu,
  renderRadialMenu,
} from './radialMenu';
import {
  hitTestSettings,
  layoutSettings,
  renderSettings,
  hitTestCredits,
  layoutCredits,
  renderCredits,
} from './settings';
import { hitTestTopBar, layoutTopBar, renderTopBar } from './topBar';
import { hitTestWelcome, layoutWelcome, renderWelcome } from './welcome';

describe('component independence (hand-built view models)', () => {
  it('topBar lays out, hit-tests and renders', () => {
    const vm = {
      menuLabel: 'Menu',
      debugLabel: 'Debug',
      showDebug: false,
      turnText: 'Turn 3',
      scoreText: 'Score 120',
      isSpeedrun: false,
      timerText: '',
      timerTemplateText: '00:00',
      turnTemplateText: 'Turn 000',
      scoreTemplateText: 'Score 000',
      logText: 'Nothing happened.',
      logEntries: ['Nothing happened.', 'Something happened.'],
    };
    const layout = layoutTopBar(vm, viewBounds, env);
    const hit = hitTestTopBar(layout, {
      x: layout.menuButton.x + 2,
      y: layout.menuButton.y + 2,
    });
    const rec = createRecordingContext();
    renderTopBar(layout, vm, ui(rec.ctx));
    expect(hit).toBe('menu');
    expect(rendersSomething(rec.log)).toBe(true);
  });

  it('menu lays out, hit-tests and renders', () => {
    const vm = {
      view: 'main',
      headerText: 'Menu',
      items: [
        { id: 'new_game', label: 'New Game' },
        { id: 'load_game', label: 'Load Game' },
      ],
      footerText: 'built today',
    };
    const layout = layoutMenu(vm, viewBounds);
    const hit = hitTestMenu(layout, {
      x: layout.items[0].bounds.x + 2,
      y: layout.items[0].bounds.y + 2,
    });
    const rec = createRecordingContext();
    renderMenu(layout, ui(rec.ctx));
    expect(hit?.kind).toBe('item');
    expect(rendersSomething(rec.log)).toBe(true);
  });

  it('welcome lays out, hit-tests and renders', () => {
    const vm = {
      headerText: 'Drakriddarna',
      buttons: [
        { id: 'newGame', label: 'New Game' },
        { id: 'loadGame', label: 'Load Game' },
        { id: 'settings', label: 'Settings' },
      ],
      footerText: 'built today',
      backgroundAssetId: 'welcomeBackground',
    };
    const layout = layoutWelcome(vm, viewBounds);
    const hit = hitTestWelcome(layout, {
      x: layout.buttons[0].bounds.x + 2,
      y: layout.buttons[0].bounds.y + 2,
    });
    const rec = createRecordingContext();
    renderWelcome(layout, vm, ui(rec.ctx));
    expect(hit).toBe('newGame');
    expect(rendersSomething(rec.log)).toBe(true);
  });

  it('settings and credits lay out, hit-test and render', () => {
    const settingsVm = {
      headerText: 'Settings',
      backButtonLabel: 'Back',
      rows: [
        {
          id: 'music',
          kind: 'toggle' as const,
          label: 'Music: On',
          dimmed: false,
        },
        {
          id: 'musicVolume',
          kind: 'slider' as const,
          label: 'Music volume',
          dimmed: false,
          value: 0.5,
        },
      ],
    };
    const settingsLayout = layoutSettings(settingsVm, viewBounds);
    const settingsHit = hitTestSettings(settingsLayout, {
      x: settingsLayout.rows[0].bounds.x + 2,
      y: settingsLayout.rows[0].bounds.y + 2,
    });
    const rec = createRecordingContext();
    renderSettings(settingsLayout, ui(rec.ctx));
    expect(settingsHit?.kind).toBe('toggle');
    expect(rendersSomething(rec.log)).toBe(true);

    const creditsVm = {
      headerText: 'Credits',
      backButtonLabel: 'Back',
      rows: [
        { id: 'music', label: 'Music license', url: 'https://example.com' },
      ],
    };
    const creditsLayout = layoutCredits(creditsVm, viewBounds);
    const creditsHit = hitTestCredits(creditsLayout, {
      x: creditsLayout.rows[0].bounds.x + 2,
      y: creditsLayout.rows[0].bounds.y + 2,
    });
    const rec2 = createRecordingContext();
    renderCredits(creditsLayout, ui(rec2.ctx));
    expect(creditsHit?.kind).toBe('row');
    expect(rendersSomething(rec2.log)).toBe(true);
  });

  it('radialMenu lays out, hit-tests and renders', () => {
    const vm = {
      origin: { x: 3, y: 2 },
      buttons: [
        { id: 0, label: 'Search', icon: '🔍' },
        { id: 1, label: 'Open door', icon: '🚪' },
      ],
    };
    const layout = layoutRadialMenu(vm, 48);
    const hit = hitTestRadialMenu(layout, {
      x: layout.items[0].x,
      y: layout.items[0].y,
    });
    const rec = createRecordingContext();
    renderRadialMenu(layout, ui(rec.ctx), { hoveredId: 0 });
    expect(hit?.kind).toBe('button');
    expect(rendersSomething(rec.log)).toBe(true);
  });
});
