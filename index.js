const express = require('express');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');

const app = express();
const config = require('./webpack.config.js');
const compiler = webpack(config);

app.use(express.static('public'));

if (process.env.NODE_ENV !== 'production') {
  app.use(webpackDevMiddleware(compiler, {
    publicPath: config.output.publicPath
  }));
} else {
  app.use(express.static('dist'));
}
app.post('/moves', function (req, res) {
  req.pipe(process.stdout);
  req.addListener('end', function () { res.end(); });
})
const port = process.env.PORT || 3000
app.listen(port, function () {
  console.log('App is listening on port ' + port + '!\n');
});
