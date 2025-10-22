module.exports = {
  root: true,
  env: { node: true, es2020: true, jest: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-console': 'off',
    'semi': ['error', 'always'],
    'quotes': 'off',
    'indent': ['warn', 2, { SwitchCase: 1 }],
    'no-case-declarations': 'warn',
    'prefer-const': 'error',
    '@typescript-eslint/ban-types': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'logs/', 'packages/cli/dist/'],
  overrides: [
    {
      files: ['**/*.js'],
      parser: 'espree',
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'no-undef': 'warn',
      },
    },
    {
      files: ['src/routes/**/*.ts', 'src/services/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
        ],
      },
    },
  ],
};
