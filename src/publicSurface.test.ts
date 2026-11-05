// The public-surface completeness test: every source module outside the
// testing harness is re-exported from src/index.ts, so nothing can
// quietly fall outside the public surface — consuming the package
// through any other path is a bug. The testing helpers live behind the
// './testing' subpath and are covered by their own check below.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = fileURLToPath(new URL('.', import.meta.url));

const indexReExports = (): string[] =>
  [
    ...readFileSync(join(SRC_ROOT, 'index.ts'), 'utf8').matchAll(
      /export \* from '\.\/([^']+)';/g,
    ),
  ].map((m) => m[1].replace(/\.ts$/, ''));

const collectSourceModules = (dir: string, prefix: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'testing') continue; // subpath, not the index
      found.push(...collectSourceModules(path, `${prefix}${entry.name}/`));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      entry.name !== 'index.ts'
    ) {
      found.push(`${prefix}${entry.name.replace(/\.ts$/, '')}`);
    }
  }
  return found;
};

describe('package public surface', () => {
  it('re-exports every source module from src/index.ts', () => {
    const surface = indexReExports();
    const missing = collectSourceModules(SRC_ROOT, '').filter(
      (m) => !surface.includes(m),
    );
    expect(
      missing,
      `modules missing from src/index.ts: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('only re-exports modules that exist', () => {
    const existing = collectSourceModules(SRC_ROOT, '');
    const missing = indexReExports().filter((m) => !existing.includes(m));
    expect(
      missing,
      `re-exports of missing modules: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('exposes every testing helper through the ./testing subpath', () => {
    const testingIndex = readFileSync(
      join(SRC_ROOT, 'testing', 'index.ts'),
      'utf8',
    );
    const reExported = [
      ...testingIndex.matchAll(/export \* from '\.\/([^']+)';/g),
    ].map((m) => m[1]);
    const helpers = readdirSync(join(SRC_ROOT, 'testing'))
      .filter(
        (name) =>
          name.endsWith('.ts') &&
          !name.endsWith('.test.ts') &&
          name !== 'index.ts',
      )
      .map((name) => name.replace(/\.ts$/, ''));
    expect(reExported.sort()).toEqual(helpers.sort());
  });
});
