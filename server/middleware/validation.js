const joi = require('joi');
const logger = require('../utils/logger');

// Create validation middleware
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const data = req[property];
    
    const { error, value } = schema.validate(data, {
      abortEarly: false, // Get all validation errors
      allowUnknown: false, // Don't allow unknown properties
      stripUnknown: true // Remove unknown properties
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation failed', {
        endpoint: req.originalUrl,
        method: req.method,
        errors,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace request data with validated/sanitized data
    req[property] = value;
    next();
  };
};

// Common validation schemas
const schemas = {
  // User schemas
  userRegistration: joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one lowercase letter, uppercase letter, number, and special character'
      }),
    firstName: joi.string().min(1).max(50).required(),
    lastName: joi.string().min(1).max(50).required()
  }),

  userLogin: joi.object({
    email: joi.string().email().required(),
    password: joi.string().required()
  }),

  // Template schemas
  templateCreate: joi.object({
    name: joi.string().min(1).max(255).required(),
    description: joi.string().max(1000).optional(),
    industry: joi.string().max(100).optional(),
    config: joi.object({
      properties: joi.object().pattern(
        joi.string(),
        joi.array().items(joi.object({
          name: joi.string().pattern(/^[a-z][a-z0-9_]*[a-z0-9]$/).max(50).required(),
          label: joi.string().min(1).max(255).required(),
          type: joi.string().valid('string', 'number', 'date', 'datetime', 'enumeration', 'bool', 'phone_number').required(),
          fieldType: joi.string().required(),
          groupName: joi.string().max(100).optional(),
          required: joi.boolean().default(false),
          options: joi.when('type', {
            is: 'enumeration',
            then: joi.array().items(joi.object({
              label: joi.string().required(),
              value: joi.string().required()
            })).min(1).required(),
            otherwise: joi.forbidden()
          })
        }))
      ).required(),
      pipelines: joi.object().pattern(
        joi.string(),
        joi.array().items(joi.object({
          label: joi.string().min(1).max(255).required(),
          displayOrder: joi.number().integer().min(0).default(0),
          stages: joi.array().items(joi.object({
            label: joi.string().min(1).max(255).required(),
            displayOrder: joi.number().integer().min(0).required(),
            metadata: joi.object({
              probability: joi.number().min(0).max(1).default(0),
              isClosed: joi.boolean().default(false)
            }).optional()
          })).min(1).required()
        }))
      ).optional(),
      lifecycleStages: joi.object({
        stages: joi.array().items(joi.object({
          name: joi.string().required(),
          label: joi.string().required(),
          displayOrder: joi.number().integer().min(0).required()
        }))
      }).optional()
    }).required()
  }),

  templateUpdate: joi.object({
    name: joi.string().min(1).max(255).optional(),
    description: joi.string().max(1000).optional(),
    industry: joi.string().max(100).optional(),
    isActive: joi.boolean().optional(),
    config: joi.object().optional() // Same as create but optional
  }),

  // Deployment schemas
  deploymentCreate: joi.object({
    clientName: joi.string().min(1).max(255).required(),
    templateId: joi.string().uuid().optional(),
    config: joi.object().when('templateId', {
      is: joi.exist(),
      then: joi.optional(),
      otherwise: joi.required()
    }),
    apiKey: joi.string().pattern(/^(pat-|sk-)[a-zA-Z0-9-]+$/).required()
      .messages({
        'string.pattern.base': 'Invalid HubSpot API key format'
      })
  }),

  // Import schemas
  csvImport: joi.object({
    csvData: joi.string().required(),
    delimiter: joi.string().valid(',', ';', '\t').default(','),
    objectType: joi.string().valid('contact', 'company', 'deal', 'ticket').default('contact')
  }),

  excelPaste: joi.object({
    pastedData: joi.string().required(),
    objectType: joi.string().valid('contact', 'company', 'deal', 'ticket').default('contact')
  }),

  fieldAnalysis: joi.object({
    headers: joi.array().items(joi.string()).min(1).required(),
    sampleData: joi.array().items(joi.object()).min(1).required(),
    objectType: joi.string().valid('contact', 'company', 'deal', 'ticket').default('contact')
  }),

  // Validation schemas
  apiKeyValidation: joi.object({
    apiKey: joi.string().pattern(/^(pat-|sk-)[a-zA-Z0-9-]+$/).required()
  }),

  propertyNameValidation: joi.object({
    apiKey: joi.string().required(),
    propertyName: joi.string().pattern(/^[a-z][a-z0-9_]*[a-z0-9]$/).max(50).required(),
    objectType: joi.string().valid('contact', 'company', 'deal', 'ticket').default('contact')
  }),

  // Pagination and filtering
  pagination: joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    sortBy: joi.string().optional(),
    sortOrder: joi.string().valid('ASC', 'DESC').default('DESC')
  }),

  templateFilters: joi.object({
    industry: joi.string().optional(),
    isActive: joi.boolean().optional(),
    search: joi.string().max(255).optional()
  }).concat(schemas.pagination || joi.object()),

  deploymentFilters: joi.object({
    status: joi.string().valid('pending', 'in_progress', 'completed', 'failed', 'rolled_back').optional(),
    clientName: joi.string().max(255).optional(),
    templateId: joi.string().uuid().optional()
  }).concat(schemas.pagination || joi.object())
};

// Sanitization helpers
const sanitize = {
  email: (email) => email?.toLowerCase().trim(),
  
  name: (name) => name?.trim().replace(/\s+/g, ' '),
  
  propertyName: (name) => name?.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''),
  
  html: (text) => {
    // Basic HTML sanitization - remove script tags and event handlers
    if (!text) return text;
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  },
  
  sql: (text) => {
    // Basic SQL injection prevention
    if (!text) return text;
    return text.replace(/['"`;--]/g, '');
  }
};

// Rate limiting validation
const rateLimitValidation = joi.object({
  windowMs: joi.number().integer().min(1000).max(3600000).default(900000), // 15 minutes max
  max: joi.number().integer().min(1).max(1000).default(100),
  message: joi.string().optional()
});

// File upload validation
const fileUploadValidation = joi.object({
  fieldname: joi.string().required(),
  originalname: joi.string().required(),
  mimetype: joi.string().valid(
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ).required(),
  size: joi.number().max(10 * 1024 * 1024).required() // 10MB max
});

// Custom validation functions
const customValidators = {
  isValidHubSpotPropertyName: (value, helpers) => {
    if (!/^[a-z][a-z0-9_]*[a-z0-9]$/.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  isStrongPassword: (value, helpers) => {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    if (value.length < minLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  isValidApiKey: (value, helpers) => {
    // HubSpot API keys start with 'pat-' or 'sk-' followed by alphanumeric and hyphens
    if (!/^(pat-|sk-)[a-zA-Z0-9-]+$/.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }
};

module.exports = {
  validate,
  schemas,
  sanitize,
  customValidators,
  rateLimitValidation,
  fileUploadValidation
};