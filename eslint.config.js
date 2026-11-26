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

/** Shared with the engine block below, which has to repeat it (flat config replaces rule options). */
const noSrcImports = {
  selector: 'ImportDeclaration[source.value=/^@factory-sim\\/[^/]+\\/src/]',
  message: 'Import workspace packages via their public entry, not /src paths.',
};

/** Engine determinism (CLAUDE.md, ADR-0007): seeded PRNG and sim clock only, exact math only. */
const inexactMath = [
  'log',
  'log1p',
  'log2',
  'log10',
  'exp',
  'expm1',
  'pow',
  'cbrt',
  'hypot',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
];
const engineRestrictedProperties = [
  { object: 'Math', property: 'random', message: 'Use the seeded Rng (ADR-0007).' },
  { object: 'Date', property: 'now', message: 'Use the simulation clock.' },
  ...inexactMath.map((property) => ({
    object: 'Math',
    property,
    message:
      "Implementation-approximated in JS; use the engine's exact-math version (bit-exact rule in api.ts).",
  })),
];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'docs/**', '.worktrees/**'] },
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
    // ADR-0016: migrated directories style through tokens and CSS Modules. Computed geometry (bar
    // widths, product colour swatches) may keep `style` with a disable comment saying why. Each
    // sprint 8 screen story adds its directory here.
    files: [
      'apps/web/src/{ui,auth,projects,products,layout,equipment,technicians,results,simulation}/**/*.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name=/^[a-z]/] > JSXAttribute[name.name='style']",
          message:
            'No inline style on DOM elements here: use the design tokens and a CSS Module (ADR-0016).',
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
      'no-restricted-syntax': ['error', noSrcImports],
    },
  },
  {
    files: ['packages/sim-engine/src/**'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': ['error', ...engineRestrictedProperties],
      'no-restricted-globals': [
        'error',
        ...[
          'setTimeout',
          'setInterval',
          'setImmediate',
          'queueMicrotask',
          'performance',
          'Date',
        ].map((name) => ({
          name,
          message: 'The engine never uses wall-clock time or timers (ADR-0007).',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        noSrcImports,
        {
          selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
          message:
            "`**` is as approximate as Math.pow; use exact multiplication or the engine's own pow.",
        },
      ],
    },
  },
);
