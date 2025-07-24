const Papa = require('papaparse');
const PropertyMapper = require('../services/PropertyMapper');
const logger = require('../utils/logger');

class ImportController {
  async parseCSV(req, res, next) {
    try {
      const { csvData, delimiter = ',', objectType = 'contact' } = req.body;

      if (!csvData) {
        return res.status(400).json({ error: 'CSV data is required' });
      }

      // Parse CSV data
      const parseResult = Papa.parse(csvData, {
        header: true,
        delimiter,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value ? value.trim() : value
      });

      if (parseResult.errors.length > 0) {
        logger.warn('CSV parsing errors:', parseResult.errors);
        return res.status(400).json({
          error: 'CSV parsing failed',
          details: parseResult.errors
        });
      }

      const { data, meta } = parseResult;

      if (data.length === 0) {
        return res.status(400).json({ error: 'No data found in CSV' });
      }

      // Get sample data for analysis (first 10 rows)
      const sampleData = data.slice(0, Math.min(10, data.length));

      res.json({
        success: true,
        headers: meta.fields,
        sampleData,
        totalRows: data.length,
        objectType,
        message: `Successfully parsed ${data.length} rows with ${meta.fields.length} columns`
      });

    } catch (error) {
      logger.error('CSV parsing error:', error);
      next(error);
    }
  }

  async analyseFields(req, res, next) {
    try {
      const { headers, sampleData, objectType = 'contact' } = req.body;

      if (!headers || !Array.isArray(headers)) {
        return res.status(400).json({ error: 'Headers array is required' });
      }

      if (!sampleData || !Array.isArray(sampleData)) {
        return res.status(400).json({ error: 'Sample data array is required' });
      }

      const propertyMapper = new PropertyMapper();
      
      logger.info('Starting field analysis', {
        headerCount: headers.length,
        sampleRowCount: sampleData.length,
        objectType
      });

      const mappings = await propertyMapper.analyseImportedData(
        headers,
        sampleData,
        objectType
      );

      // Group mappings by confidence level for better UX
      const highConfidence = mappings.filter(m => m.confidence >= 0.8);
      const mediumConfidence = mappings.filter(m => m.confidence >= 0.5 && m.confidence < 0.8);
      const lowConfidence = mappings.filter(m => m.confidence < 0.5);

      const summary = {
        total: mappings.length,
        highConfidence: highConfidence.length,
        mediumConfidence: mediumConfidence.length,
        lowConfidence: lowConfidence.length,
        requiresReview: mediumConfidence.length + lowConfidence.length
      };

      logger.info('Field analysis completed', summary);

      res.json({
        success: true,
        mappings,
        summary,
        recommendations: this.generateRecommendations(mappings)
      });

    } catch (error) {
      logger.error('Field analysis error:', error);
      next(error);
    }
  }

  async parseExcelPaste(req, res, next) {
    try {
      const { pastedData, objectType = 'contact' } = req.body;

      if (!pastedData) {
        return res.status(400).json({ error: 'Pasted data is required' });
      }

      // Parse tab-separated values (Excel paste format)
      const rows = pastedData.trim().split('\n');
      const headers = rows[0].split('\t').map(h => h.trim());
      
      const data = rows.slice(1).map(row => {
        const values = row.split('\t');
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] ? values[index].trim() : '';
        });
        return obj;
      });

      if (data.length === 0) {
        return res.status(400).json({ error: 'No data rows found' });
      }

      // Get sample data for analysis
      const sampleData = data.slice(0, Math.min(10, data.length));

      res.json({
        success: true,
        headers,
        sampleData,
        totalRows: data.length,
        objectType,
        message: `Successfully parsed ${data.length} rows with ${headers.length} columns from Excel paste`
      });

    } catch (error) {
      logger.error('Excel paste parsing error:', error);
      next(error);
    }
  }

  async validateMappings(req, res, next) {
    try {
      const { mappings, objectType = 'contact' } = req.body;

      if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ error: 'Mappings array is required' });
      }

      const propertyMapper = new PropertyMapper();
      const validationResults = [];
      const errors = [];

      for (const mapping of mappings) {
        const validation = propertyMapper.validateMapping(mapping);
        validationResults.push({
          sourceField: mapping.sourceField,
          suggestedName: mapping.suggestedName,
          ...validation
        });

        if (!validation.isValid) {
          errors.push({
            sourceField: mapping.sourceField,
            errors: validation.errors
          });
        }
      }

      // Check for duplicate property names
      const nameCount = {};
      mappings.forEach(m => {
        nameCount[m.suggestedName] = (nameCount[m.suggestedName] || 0) + 1;
      });

      const duplicates = Object.entries(nameCount)
        .filter(([name, count]) => count > 1)
        .map(([name, count]) => ({ name, count }));

      if (duplicates.length > 0) {
        errors.push({
          type: 'duplicate_names',
          message: 'Duplicate property names found',
          duplicates
        });
      }

      const isValid = errors.length === 0;

      res.json({
        success: true,
        isValid,
        validationResults,
        errors,
        summary: {
          total: mappings.length,
          valid: validationResults.filter(r => r.isValid).length,
          invalid: validationResults.filter(r => !r.isValid).length,
          duplicates: duplicates.length
        }
      });

    } catch (error) {
      logger.error('Mapping validation error:', error);
      next(error);
    }
  }

  async previewConfiguration(req, res, next) {
    try {
      const { mappings, objectType = 'contact' } = req.body;

      if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ error: 'Mappings array is required' });
      }

      const propertyMapper = new PropertyMapper();
      const propertyConfigs = [];
      const groupsNeeded = new Set();

      // Generate HubSpot property configurations
      for (const mapping of mappings) {
        const config = propertyMapper.generatePropertyConfig(mapping);
        propertyConfigs.push(config);
        
        if (config.groupName) {
          groupsNeeded.add(config.groupName);
        }
      }

      // Group properties by type for organization
      const propertyTypes = propertyConfigs.reduce((acc, prop) => {
        const type = prop.type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(prop);
        return acc;
      }, {});

      const configuration = {
        objectType,
        propertyGroups: Array.from(groupsNeeded).map(groupName => ({
          name: groupName,
          label: this.humanizeGroupName(groupName),
          displayOrder: this.getGroupDisplayOrder(groupName)
        })),
        properties: propertyConfigs,
        summary: {
          totalProperties: propertyConfigs.length,
          propertyTypes: Object.keys(propertyTypes).map(type => ({
            type,
            count: propertyTypes[type].length
          })),
          groupsNeeded: Array.from(groupsNeeded).length
        }
      };

      res.json({
        success: true,
        configuration,
        estimatedDeploymentTime: this.estimateDeploymentTime(propertyConfigs.length, groupsNeeded.size)
      });

    } catch (error) {
      logger.error('Configuration preview error:', error);
      next(error);
    }
  }

  generateRecommendations(mappings) {
    const recommendations = [];

    // High confidence mappings that might need review
    mappings.forEach(mapping => {
      if (mapping.isReserved && mapping.confidence < 0.9) {
        recommendations.push({
          type: 'warning',
          field: mapping.sourceField,
          message: `Field "${mapping.sourceField}" maps to reserved HubSpot property "${mapping.suggestedName}". Verify this is correct.`
        });
      }

      if (mapping.detectedType?.hubspotType === 'enumeration' && mapping.enumOptions.length > 30) {
        recommendations.push({
          type: 'warning',
          field: mapping.sourceField,
          message: `Field "${mapping.sourceField}" has ${mapping.enumOptions.length} options. Consider reducing for better performance.`
        });
      }

      if (mapping.confidence < 0.5) {
        recommendations.push({
          type: 'review',
          field: mapping.sourceField,
          message: `Field "${mapping.sourceField}" has low confidence mapping. Please review the suggested type and name.`
        });
      }
    });

    // General recommendations
    const enumFields = mappings.filter(m => m.detectedType?.hubspotType === 'enumeration');
    if (enumFields.length > 5) {
      recommendations.push({
        type: 'info',
        message: `You have ${enumFields.length} dropdown/select fields. Consider if some could be simplified to text fields.`
      });
    }

    return recommendations;
  }

  humanizeGroupName(groupName) {
    return groupName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getGroupDisplayOrder(groupName) {
    const groupOrder = {
      'contactinformation': 0,
      'companyinformation': 0,
      'dealinformation': 0,
      'personal': 1,
      'company': 2,
      'location': 3,
      'sales': 4,
      'marketing': 5,
      'financial': 6,
      'social': 7,
      'custom': 10
    };

    return groupOrder[groupName.toLowerCase()] || 5;
  }

  estimateDeploymentTime(propertyCount, groupCount) {
    // Rough estimates based on HubSpot API timing
    const groupTime = groupCount * 2; // 2 seconds per group
    const propertyTime = Math.ceil(propertyCount / 10) * 15; // 15 seconds per batch of 10
    const baseTime = 10; // Base overhead
    
    return {
      estimatedSeconds: groupTime + propertyTime + baseTime,
      breakdown: {
        groups: `${groupCount} groups (~${groupTime}s)`,
        properties: `${propertyCount} properties (~${propertyTime}s)`,
        overhead: `Base processing (~${baseTime}s)`
      }
    };
  }
}

module.exports = new ImportController();