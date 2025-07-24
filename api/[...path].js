// Vercel API handler that proxies to our Express server
const app = require('../server/index.js');

module.exports = (req, res) => {
  // Proxy all API requests to our Express server
  app(req, res);
};