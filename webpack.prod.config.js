const Path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCSSExtractTextPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

module.exports = {
  entry: './src/scripts.js',
  devtool: 'none',
  output: {
    filename: 'scripts.js',
    path: Path.resolve(__dirname, 'docs'),
    publicPath: '/'
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCSSExtractTextPlugin.loader
          },
          'css-loader'
        ]
      },
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    }),
    new MiniCSSExtractTextPlugin({
      filename: 'styles.css'
    }),
    new webpack.DefinePlugin({
      __PROD__: JSON.stringify(true),
      __DEV__: JSON.stringify(false),
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
};
