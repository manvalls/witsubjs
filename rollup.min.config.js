import babel from 'rollup-plugin-babel';
import { uglify } from 'rollup-plugin-uglify';
import gzip from 'rollup-plugin-gzip';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/witsub.min.js',
    format: 'iife',
    name: 'witsub',
    globals: {
      jwit: 'wit'
    },
  },
  external: ['jwit'],
  plugins: [
    babel({
      babelrc: false,
      exclude: 'node_modules/**',
      presets: [
        ['@babel/env']
      ]
    }),
    uglify(),
    gzip()
  ],
};
