const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');

// GET /api/templates - List templates with filtering and pagination
router.get('/', templateController.list);

// GET /api/templates/industries - Get list of available industries
router.get('/industries', templateController.getIndustries);

// POST /api/templates - Create new template
router.post('/', templateController.create);

// POST /api/templates/import - Import template from JSON
router.post('/import', templateController.importTemplate);

// GET /api/templates/:id - Get template by ID with stats
router.get('/:id', templateController.getById);

// PUT /api/templates/:id - Update template
router.put('/:id', templateController.update);

// DELETE /api/templates/:id - Delete template (soft delete if has deployments)
router.delete('/:id', templateController.delete);

// POST /api/templates/:id/duplicate - Duplicate existing template
router.post('/:id/duplicate', templateController.duplicate);

// GET /api/templates/:id/export - Export template as JSON
router.get('/:id/export', templateController.exportTemplate);

module.exports = router;