// Vercel API handler that proxies to our Express server
let app;

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
    
    // Lazy load the Express app to avoid initialization issues
    if (!app) {
      console.log('Initializing Express app...');
      console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      
      // Ensure NODE_ENV is set for Sequelize config
      process.env.NODE_ENV = process.env.NODE_ENV || 'production';
      
      app = require('../server/index.js');
    }
    
    // Proxy all API requests to our Express server
    app(req, res);
  } catch (error) {
    console.error('API Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: {
        code: '500',
        message: 'A server error has occurred',
        details: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      }
    });
  }
};