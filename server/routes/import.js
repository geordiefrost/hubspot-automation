const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');

// POST /api/import/csv - Parse CSV data and return headers/sample
router.post('/csv', importController.parseCSV);

// POST /api/import/excel-paste - Parse Excel paste data
router.post('/excel-paste', importController.parseExcelPaste);

// POST /api/import/analyse - Analyse fields and suggest mappings
router.post('/analyse', importController.analyseFields);

// POST /api/import/validate-mappings - Validate property mappings
router.post('/validate-mappings', importController.validateMappings);

// POST /api/import/preview - Preview HubSpot configuration
router.post('/preview', importController.previewConfiguration);

module.exports = router;