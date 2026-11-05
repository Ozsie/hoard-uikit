// Walks the import graph of the package sources: the kit is plain
// TypeScript plus exactly one dependency — the @hoard-engine/primitives
// engine package (theme tokens, text, geometry, clipping). Nothing else
// may be imported: no game code, Svelte, aliases or other packages. Lint
// enforces the same rule; this test is the second line of defense that
// also catches dynamically built or re-exported paths lint misses
// (the spec history lives in the game repo's
// docs/ui-kit-spec/05-boundary-and-verification.md).

import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

// Anchored to this test file so the suite runs identically from the
// package folder and from any consumer's repo root.
const KIT_ROOT = fileURLToPath(new URL('.', import.meta.url));
const ALLOWED_EXTERNAL = new Set(['@hoard-engine/primitives']);
const importPattern =
  /(?:import|export)\s[^;]*?from\s["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const isInsideKit = (importPath: string, fromFile: string): boolean => {
  if (!importPath.startsWith('.')) return ALLOWED_EXTERNAL.has(importPath);
  const resolved = relative(
    KIT_ROOT,
    resolve(fromFile, '..', importPath),
  ).replaceAll('\\', '/');
  return !resolved.startsWith('..');
};

const collectViolations = (dir: string): string[] => {
  const violations: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...collectViolations(path));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      for (const match of readFileSync(path, 'utf8').matchAll(importPattern)) {
        const importPath = match[1] ?? match[2];
        if (importPath && !isInsideKit(importPath, path)) {
          violations.push(`${path}: imports '${importPath}'`);
        }
      }
    }
  }
  return violations;
};

describe('uikit boundary', () => {
  it('imports nothing from outside the package but the primitives package', () => {
    expect(collectViolations(KIT_ROOT)).toEqual([]);
  });
});
