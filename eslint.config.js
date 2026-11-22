// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/** Package boundaries (ADR-0001, ADR-0007). */
const noAppImports = {
  group: [
    '@factory-sim/web',
    '@factory-sim/web/*',
    '@factory-sim/api',
    '@factory-sim/api/*',
    '**/apps/**',
  ],
  message: 'Packages must never import from apps.',
};
const noPlatformImports = {
  group: [
    'node:*',
    'fs',
    'path',
    'os',
    'worker_threads',
    'child_process',
    'react',
    'react-dom',
    'three',
    '@react-three/*',
  ],
  message:
    'sim-engine and schema must run in browser and Node: no Node, DOM or rendering imports (ADR-0007/0008).',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/api/**', 'scripts/**', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@factory-sim/api', '@factory-sim/api/*'],
              message: 'web talks to api over HTTP only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@factory-sim/web', '@factory-sim/web/*'],
              message: 'api must not import web.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/sim-engine/**', 'packages/schema/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noAppImports, noPlatformImports] }],
    },
  },
  {
    // The engine must not depend on the schema package's internals beyond its public entry.
    files: ['packages/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value=/^@factory-sim\\/[^/]+\\/src/]',
          message: 'Import workspace packages via their public entry, not /src paths.',
        },
      ],
    },
  },
);
