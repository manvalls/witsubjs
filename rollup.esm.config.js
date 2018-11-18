import babel from 'rollup-plugin-babel';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/witsub.esm.js',
    format: 'esm',
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
  ],
};
