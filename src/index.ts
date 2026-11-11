// The public surface of the package — the single entry a consumer is
// meant to use. Everything the kit offers is re-exported here
// deliberately; if you need something that is not exported from this
// file, that is a missing surface, not a reason to deep-import (the
// boundary rules keep deep imports honest).
//
// The surface is organized top-down: the theme tokens and drawing
// primitives (both from the @hoard-engine/primitives engine package), the
// environment contracts, the kit widgets and the components. The testing
// helpers are deliberately NOT part of this surface: they live behind
// the './testing' subpath export, for consumers that want the harness
// (recording context, sentinel theme, literal budget).

export * from '@hoard-engine/primitives';
export * from './env';
export * from './kit/modalFrame';
export * from './kit/button';
export * from './kit/listRow';
export * from './kit/textInput';
export * from './kit/spriteFrame';
export * from './components/topBar';
export * from './components/menu';
export * from './components/welcome';
export * from './components/composition';
export * from './components/settings';
export * from './components/radialMenu';
