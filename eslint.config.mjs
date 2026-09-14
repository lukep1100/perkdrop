// Safety-focused JS/JSX lint. Edge TypeScript is checked separately by Deno;
// generated inline browser scripts are parsed by test:inline-scripts.
export default [{
  ignores: ['node_modules/**', '.next/**', '.vercel/**', '.audit/**', 'supabase/**'],
}, {
  files: ['pages/**/*.js', 'public/**/*.{js,mjs}', 'lib/**/*.js', 'scripts/*.mjs', 'tests/**/*.mjs', '*.config.{js,mjs}'],
  languageOptions: {ecmaVersion: 'latest', parserOptions: {ecmaFeatures: {jsx: true}}},
  rules: {
    'constructor-super': 'error',
    'for-direction': 'error',
    'getter-return': 'error',
    'no-async-promise-executor': 'error',
    'no-constant-binary-expression': 'error',
    'no-dupe-args': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-else-if': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-invalid-regexp': 'error',
    'no-new-native-nonconstructor': 'error',
    'no-obj-calls': 'error',
    'no-self-assign': 'error',
    'no-setter-return': 'error',
    'no-this-before-super': 'error',
    'no-unexpected-multiline': 'error',
    'no-unreachable': 'error',
    'no-unreachable-loop': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'no-unsafe-optional-chaining': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
  },
}];
