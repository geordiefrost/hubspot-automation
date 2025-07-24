const HubSpotAPI = require('../services/HubSpotAPI');
const logger = require('../utils/logger');

class ValidationController {
  async validateApiKey(req, res, next) {
    try {
      const { apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }

      // Test the API key by making a simple request
      const hubspot = new HubSpotAPI(apiKey);
      const testResult = await hubspot.testConnection();

      if (testResult.success) {
        logger.info('API key validation successful', {
          portalId: testResult.accountInfo.portalId
        });

        res.json({
          valid: true,
          accountInfo: testResult.accountInfo,
          message: 'API key is valid and active'
        });
      } else {
        logger.warn('API key validation failed', {
          error: testResult.error,
          status: testResult.status
        });

        res.status(401).json({
          valid: false,
          error: testResult.error,
          message: 'Invalid or expired API key'
        });
      }
    } catch (error) {
      logger.error('API key validation error:', error);
      
      if (error.isHubSpotError) {
        return res.status(401).json({
          valid: false,
          error: error.message,
          message: 'Invalid API key or insufficient permissions'
        });
      }
      
      next(error);
    }
  }

  async validatePropertyName(req, res, next) {
    try {
      const { apiKey, propertyName, objectType = 'contact' } = req.body;

      if (!apiKey || !propertyName) {
        return res.status(400).json({ 
          error: 'API key and property name are required' 
        });
      }

      // Validate property name format
      const nameValidation = this.validatePropertyNameFormat(propertyName);
      if (!nameValidation.valid) {
        return res.json({
          available: false,
          valid: false,
          errors: nameValidation.errors,
          suggestions: nameValidation.suggestions
        });
      }

      const hubspot = new HubSpotAPI(apiKey);
      const result = await hubspot.validatePropertyName(objectType, propertyName);

      res.json({
        available: !result.exists,
        valid: true,
        exists: result.exists,
        propertyName,
        objectType,
        message: result.exists ? 
          'Property name already exists in HubSpot' : 
          'Property name is available'
      });

    } catch (error) {
      logger.error('Property name validation error:', error);
      
      if (error.isHubSpotError && error.status === 404) {
        // Property doesn't exist, which means it's available
        return res.json({
          available: true,
          valid: true,
          exists: false,
          message: 'Property name is available'
        });
      }
      
      next(error);
    }
  }

  async validatePipelineName(req, res, next) {
    try {
      const { apiKey, pipelineName, objectType = 'deals' } = req.body;

      if (!apiKey || !pipelineName) {
        return res.status(400).json({ 
          error: 'API key and pipeline name are required' 
        });
      }

      const hubspot = new HubSpotAPI(apiKey);
      const result = await hubspot.validatePipelineName(objectType, pipelineName);

      res.json({
        available: !result.exists,
        exists: result.exists,
        pipelineName,
        objectType,
        message: result.exists ? 
          'Pipeline name already exists in HubSpot' : 
          'Pipeline name is available'
      });

    } catch (error) {
      logger.error('Pipeline name validation error:', error);
      next(error);
    }
  }

  async validateConfiguration(req, res, next) {
    try {
      const { apiKey, configuration } = req.body;

      if (!apiKey || !configuration) {
        return res.status(400).json({ 
          error: 'API key and configuration are required' 
        });
      }

      const validationResults = {
        valid: true,
        errors: [],
        warnings: [],
        summary: {
          totalProperties: 0,
          totalPipelines: 0,
          totalGroups: 0,
          estimatedTime: 0
        }
      };

      const hubspot = new HubSpotAPI(apiKey);

      // Validate API key first
      const apiKeyTest = await hubspot.testConnection();
      if (!apiKeyTest.success) {
        validationResults.valid = false;
        validationResults.errors.push({
          type: 'api_key',
          message: 'Invalid API key or insufficient permissions'
        });
        return res.json(validationResults);
      }

      // Validate property groups
      if (configuration.propertyGroups) {
        for (const group of configuration.propertyGroups) {
          if (!group.name || !group.label) {
            validationResults.errors.push({
              type: 'property_group',
              message: `Property group missing name or label: ${JSON.stringify(group)}`
            });
            validationResults.valid = false;
          }
        }
        validationResults.summary.totalGroups = configuration.propertyGroups.length;
      }

      // Validate properties
      if (configuration.properties) {
        const propertyNames = new Set();
        
        for (const [objectType, properties] of Object.entries(configuration.properties)) {
          if (!Array.isArray(properties)) continue;
          
          for (const property of properties) {
            // Check required fields
            if (!property.name || !property.label || !property.type) {
              validationResults.errors.push({
                type: 'property',
                objectType,
                message: `Property missing required fields: ${JSON.stringify(property)}`
              });
              validationResults.valid = false;
              continue;
            }

            // Check for duplicate names within object type
            const key = `${objectType}.${property.name}`;
            if (propertyNames.has(key)) {
              validationResults.errors.push({
                type: 'duplicate_property',
                objectType,
                propertyName: property.name,
                message: `Duplicate property name: ${property.name} in ${objectType}`
              });
              validationResults.valid = false;
            }
            propertyNames.add(key);

            // Validate property name format
            const nameValidation = this.validatePropertyNameFormat(property.name);
            if (!nameValidation.valid) {
              validationResults.errors.push({
                type: 'property_name_format',
                objectType,
                propertyName: property.name,
                message: `Invalid property name format: ${nameValidation.errors.join(', ')}`
              });
              validationResults.valid = false;
            }

            // Validate enumeration options
            if (property.type === 'enumeration') {
              if (!property.options || property.options.length === 0) {
                validationResults.errors.push({
                  type: 'enumeration_options',
                  objectType,
                  propertyName: property.name,
                  message: 'Enumeration property requires at least one option'
                });
                validationResults.valid = false;
              } else if (property.options.length > 100) {
                validationResults.warnings.push({
                  type: 'too_many_options',
                  objectType,
                  propertyName: property.name,
                  message: `Property has ${property.options.length} options. Consider reducing for better performance.`
                });
              }
            }
          }
          
          validationResults.summary.totalProperties += properties.length;
        }
      }

      // Validate pipelines
      if (configuration.pipelines) {
        for (const [objectType, pipelines] of Object.entries(configuration.pipelines)) {
          if (!Array.isArray(pipelines)) continue;
          
          for (const pipeline of pipelines) {
            if (!pipeline.label || !pipeline.stages || !Array.isArray(pipeline.stages)) {
              validationResults.errors.push({
                type: 'pipeline',
                objectType,
                message: `Pipeline missing required fields: ${JSON.stringify(pipeline)}`
              });
              validationResults.valid = false;
              continue;
            }

            // Validate stages
            for (const stage of pipeline.stages) {
              if (!stage.label) {
                validationResults.errors.push({
                  type: 'pipeline_stage',
                  objectType,
                  pipelineName: pipeline.label,
                  message: `Pipeline stage missing label: ${JSON.stringify(stage)}`
                });
                validationResults.valid = false;
              }
            }
          }
          
          validationResults.summary.totalPipelines += pipelines.length;
        }
      }

      // Calculate estimated deployment time
      validationResults.summary.estimatedTime = this.calculateEstimatedTime(
        validationResults.summary.totalProperties,
        validationResults.summary.totalPipelines,
        validationResults.summary.totalGroups
      );

      res.json(validationResults);

    } catch (error) {
      logger.error('Configuration validation error:', error);
      next(error);
    }
  }

  validatePropertyNameFormat(name) {
    const errors = [];
    const suggestions = [];

    // Check basic requirements
    if (!name || typeof name !== 'string') {
      errors.push('Property name must be a non-empty string');
      return { valid: false, errors, suggestions };
    }

    // Check length
    if (name.length === 0) {
      errors.push('Property name cannot be empty');
    } else if (name.length > 50) {
      errors.push('Property name cannot exceed 50 characters');
      suggestions.push(`Shorten to: ${name.substring(0, 47)}...`);
    }

    // Check format
    if (!/^[a-z]/.test(name)) {
      errors.push('Property name must start with a lowercase letter');
      suggestions.push(`Try: ${name.charAt(0).toLowerCase()}${name.slice(1)}`);
    }

    if (!/^[a-z0-9_]+$/.test(name)) {
      errors.push('Property name can only contain lowercase letters, numbers, and underscores');
      const cleaned = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      suggestions.push(`Try: ${cleaned}`);
    }

    // Check for consecutive underscores
    if (/__+/.test(name)) {
      errors.push('Property name cannot contain consecutive underscores');
      suggestions.push(`Try: ${name.replace(/_+/g, '_')}`);
    }

    // Check for leading/trailing underscores
    if (name.startsWith('_') || name.endsWith('_')) {
      errors.push('Property name cannot start or end with underscores');
      suggestions.push(`Try: ${name.replace(/^_+|_+$/g, '')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      suggestions: [...new Set(suggestions)] // Remove duplicates
    };
  }

  calculateEstimatedTime(properties, pipelines, groups) {
    // Base times in seconds
    const groupTime = groups * 2;
    const propertyTime = Math.ceil(properties / 10) * 15; // Batch by 10
    const pipelineTime = pipelines * 5;
    const baseOverhead = 10;

    return {
      total: groupTime + propertyTime + pipelineTime + baseOverhead,
      breakdown: {
        groups: groupTime,
        properties: propertyTime,
        pipelines: pipelineTime,
        overhead: baseOverhead
      }
    };
  }
}

module.exports = new ValidationController();