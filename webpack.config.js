const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
  entry: {
    bootstrap: './src/bootstrap.js',
    chart: './src/chart.js',
    dataTables: './src/dataTables.js',
    moment: './src/moment.js',
    react: './src/react.js'
  },
  output: {
    filename: 'js/[name].js',
    path: path.resolve(__dirname, 'public')
  },
  plugins: [
  new webpack.ProvidePlugin({
    $: 'jquery',
    jQuery: 'jquery',
    'window.jQuery': 'jquery',
    Popper: ['popper.js', 'default']
  }),
  new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
  new ExtractTextPlugin('css/[name].css')
  ],
  module: {
    rules: [
    {
      test: /\.css$/,
      use: ExtractTextPlugin.extract({
       fallback: 'style-loader',
       use: 'css-loader'
     })
    },
    {
      test: /\.js$/,
      exclude: /node_modules/,
      loader: "babel-loader"
    },
    {
      test: require.resolve('jquery'),
      use: [{
        loader: 'expose-loader',
        options: 'jQuery'
      },{
        loader: 'expose-loader',
        options: '$'
      }]
    },
    {
      test: require.resolve('moment'),
      use: [{
        loader: 'expose-loader',
        query: 'moment'
      }]
    }
    ]
  }
};