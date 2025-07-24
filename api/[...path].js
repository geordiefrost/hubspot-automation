// Vercel API handler that proxies to our Express server
const app = require('../server/index.js');

module.exports = async (req, res) => {
  try {
    // Add CORS headers for Vercel
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Proxy all API requests to our Express server
    app(req, res);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: {
        code: '500',
        message: 'A server error has occurred',
        details: error.message
      }
    });
  }
};