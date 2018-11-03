const Path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCSSExtractTextPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './src/scripts.js',
  devtool: 'none',
  output: {
    filename: 'scripts.js',
    path: Path.resolve(__dirname, 'dist'),
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
    })
  ]
};
