import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

// Standalone lint config for the package: strict TypeScript with prettier
// enforced, plus the kit boundary rules ported from the game repo — the
// sources import nothing but relative files and the one dependency,
// @hoard-engine/primitives, and converted modules hold no style literals
// (every color and font comes from the theme tokens). Test files may
// additionally import 'vitest'.
export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      prettierRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      'prettier/prettier': 'error',
    },
  },
  // Canvas-mock test objects are `as unknown as CanvasRenderingContext2D`,
  // so mock method references trip unbound-method even though the values
  // are plain recorders. The rule has no value in tests.
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  // Kit boundary: relative imports within the package and the single
  // allowed dependency, @hoard-engine/primitives. The boundary test walks
  // the import graph as a second line of defense.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^(?!(\\.|@hoard-engine\\/primitives$))/], ImportExpression[source.value=/^(?!(\\.|@hoard-engine\\/primitives$))/], ExportAllDeclaration[source.value=/^(?!(\\.|@hoard-engine\\/primitives$))/], ExportNamedDeclaration[source.value=/^(?!(\\.|@hoard-engine\\/primitives$))/]',
          message:
            'The kit imports nothing but relative files and @hoard-engine/primitives.',
        },
        {
          selector:
            'Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/], Literal[value=/^(rgba?|hsla?)\\(/]',
          message:
            'Style literals live in the theme tokens (@hoard-engine/primitives); components read them from the theme.',
        },
      ],
    },
  },
);
