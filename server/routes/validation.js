const express = require('express');
const router = express.Router();
const validationController = require('../controllers/validationController');

// POST /api/validate/api-key - Test HubSpot API key
router.post('/api-key', validationController.validateApiKey);

// POST /api/validate/property-name - Check if property name is available
router.post('/property-name', validationController.validatePropertyName);

// POST /api/validate/pipeline-name - Check if pipeline name is available
router.post('/pipeline-name', validationController.validatePipelineName);

// POST /api/validate/configuration - Validate complete deployment configuration
router.post('/configuration', validationController.validateConfiguration);

module.exports = router;