const path = require('path');

module.exports = {
  entry: './src/index.ts',
  target: 'webworker',
  mode: process.env.NODE_ENV || 'production',
  devtool: 'source-map',
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@middleware': path.resolve(__dirname, 'src/middleware'),
      '@routes': path.resolve(__dirname, 'src/routes'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
  
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  
  optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: false,
  },
  
  externals: {
    // Cloudflare Workers runtime globals
    '__STATIC_CONTENT_MANIFEST': '__STATIC_CONTENT_MANIFEST',
  },
  
  performance: {
    hints: 'warning',
    maxEntrypointSize: 1024 * 1024, // 1MB
    maxAssetSize: 1024 * 1024, // 1MB
  },
};