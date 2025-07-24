const express = require('express');
const router = express.Router();
const deploymentController = require('../controllers/deploymentController');

// GET /api/deployments - List deployments with filtering and pagination
router.get('/', deploymentController.list);

// GET /api/deployments/stats - Get deployment statistics
router.get('/stats', deploymentController.getStats);

// POST /api/deployments - Start new deployment (returns SSE stream)
router.post('/', deploymentController.deploy);

// POST /api/deployments/validate - Validate deployment configuration
router.post('/validate', deploymentController.validate);

// GET /api/deployments/:id - Get deployment status and details
router.get('/:id', deploymentController.getStatus);

// POST /api/deployments/:id/rollback - Rollback deployment
router.post('/:id/rollback', deploymentController.rollback);

// POST /api/deployments/:id/retry - Retry failed deployment
router.post('/:id/retry', deploymentController.retry);

module.exports = router;