import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';

export default [
  // Background service worker
  {
    input: 'src/background/service-worker.ts',
    output: {
      file: 'dist/background/service-worker.js',
      format: 'iife',
      name: 'BackgroundService'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      terser({
        compress: {
          drop_console: false, // Keep console logs for debugging
          drop_debugger: true
        },
        mangle: {
          reserved: ['chrome', 'browser']
        }
      })
    ]
  },
  // Content script
  {
    input: 'src/content/youtube-music.ts',
    output: {
      file: 'dist/content/youtube-music.js',
      format: 'iife',
      name: 'YouTubeMusicDetector'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        mangle: {
          reserved: ['chrome', 'browser']
        }
      })
    ]
  },
  // Popup script
  {
    input: 'src/popup/popup.ts',
    output: {
      file: 'dist/popup/popup.js',
      format: 'iife',
      name: 'PopupController'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        mangle: {
          reserved: ['chrome', 'browser']
        }
      })
    ]
  },
  // Options script
  {
    input: 'src/options/options.ts',
    output: {
      file: 'dist/options/options.js',
      format: 'iife',
      name: 'OptionsController'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true
        },
        mangle: {
          reserved: ['chrome', 'browser']
        }
      })
    ]
  },
];
