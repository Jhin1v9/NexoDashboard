const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const peerDepsExternal = require('rollup-plugin-peer-deps-external');
const postcss = require('rollup-plugin-postcss');
const dts = require('rollup-plugin-dts');

const packageJson = require('./package.json');

const commonPlugins = [
  peerDepsExternal(),
  resolve(),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    exclude: ['**/*.test.ts'],
  }),
  postcss({
    extract: true,
    minimize: true,
  }),
];

const commonExternal = ['react', 'react-dom', 'html2canvas', 'vue'];

module.exports = [
  // Build principal (CJS + ESM)
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: commonPlugins,
    external: commonExternal,
  },
  // React adapter
  {
    input: 'src/adapters/react.tsx',
    output: [
      {
        file: 'dist/adapters/react.js',
        format: 'esm',
        sourcemap: true,
        exports: 'named',
        inlineDynamicImports: true,
      },
    ],
    plugins: commonPlugins,
    external: commonExternal,
  },
  // Vue adapter
  {
    input: 'src/adapters/vue.ts',
    output: [
      {
        file: 'dist/adapters/vue.js',
        format: 'esm',
        sourcemap: true,
        exports: 'named',
        inlineDynamicImports: true,
      },
    ],
    plugins: commonPlugins,
    external: commonExternal,
  },
  // IIFE bundle (vanilla, para bookmarklet/extensão/userscript)
  {
    input: 'src/entry/iife.ts',
    output: [
      {
        file: 'dist/bug-detector.iife.js',
        format: 'iife',
        name: 'BugDetector',
        sourcemap: true,
        exports: 'default',
        inlineDynamicImports: true,
      },
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts'],
      }),
      postcss({
        inject: true, // CSS inline para funcionar em bookmarklet/injeção
        minimize: true,
      }),
    ],
    external: [], // bundleia html2canvas junto
  },
  // Type declarations bundle
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts.default()],
    external: commonExternal,
  },
];
