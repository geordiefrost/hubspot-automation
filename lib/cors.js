// CORS middleware for API functions
function corsHeaders(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Indicates preflight was handled
  }
  
  return false; // Continue with normal request
}

function handleError(res, error, message = 'Internal server error') {
  console.error('API Error:', error);
  
  res.status(500).json({
    error: {
      code: '500',
      message,
      details: error.message
    }
  });
}

module.exports = { corsHeaders, handleError };