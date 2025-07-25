const { corsHeaders, handleError } = require('../lib/cors.js');

module.exports = async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: '405', message: 'Method not allowed' }
    });
  }

  try {
    const { action, ...params } = req.body;

    switch (action) {
      case 'api-key':
        return await handleApiKeyValidation(req, res, params);
      default:
        return res.status(400).json({
          error: { code: '400', message: 'Invalid action. Must be "api-key"' }
        });
    }
  } catch (error) {
    handleError(res, error, 'Validation failed');
  }
};

async function handleApiKeyValidation(req, res, { apiKey }) {
  if (!apiKey) {
    return res.status(400).json({ 
      error: 'API key is required',
      valid: false 
    });
  }

  // Basic API key format validation
  if (!apiKey.startsWith('pat-')) {
    return res.status(200).json({
      valid: false,
      error: 'API key must be a HubSpot Private App token (starts with "pat-")'
    });
  }

  if (apiKey.length < 20) {
    return res.status(200).json({
      valid: false,
      error: 'API key appears to be too short'
    });
  }

  // Test the API key by making a request to HubSpot
  try {
    const accountResponse = await fetch('https://api.hubapi.com/account-info/v3/details', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      
      // Also test properties API access (needed for deployment)
      const propertiesResponse = await fetch('https://api.hubapi.com/crm/v3/properties/contact', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const hasPropertiesAccess = propertiesResponse.ok;
      
      if (!hasPropertiesAccess) {
        return res.status(200).json({
          valid: false,
          error: 'API key does not have required CRM properties permissions. Please ensure your Private App has CRM scopes enabled.',
          accountInfo: {
            portalId: accountData.portalId,
            domain: accountData.uiDomain,
            timeZone: accountData.timeZone
          }
        });
      }

      return res.status(200).json({
        valid: true,
        accountInfo: {
          portalId: accountData.portalId,
          domain: accountData.uiDomain,
          timeZone: accountData.timeZone,
          currency: accountData.companyCurrency,
          hasPropertiesAccess: true
        }
      });

    } else {
      const errorData = await accountResponse.json().catch(() => ({}));
      
      let errorMessage = 'Invalid API key or insufficient permissions';
      
      if (accountResponse.status === 401) {
        errorMessage = 'API key is invalid or expired';
      } else if (accountResponse.status === 403) {
        errorMessage = 'API key does not have required permissions. Please check your Private App scopes.';
      } else if (accountResponse.status === 429) {
        errorMessage = 'Too many requests. Please try again in a moment.';
      }

      return res.status(200).json({
        valid: false,
        error: errorMessage,
        details: errorData.message
      });
    }

  } catch (networkError) {
    console.error('Network error validating API key:', networkError);
    
    return res.status(200).json({
      valid: false,
      error: 'Unable to connect to HubSpot. Please check your internet connection and try again.',
      details: networkError.message
    });
  }
}