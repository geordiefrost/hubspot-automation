const { MappingHistory } = require('../models');
const logger = require('../utils/logger');

class PropertyMapper {
  constructor() {
    // Pattern matchers for common field types
    this.patterns = {
      date: {
        patterns: [
          /date|time|created|updated|scheduled|deadline|due|birthday|anniversary/i,
          /\d{4}-\d{2}-\d{2}/, // ISO date format
          /\d{1,2}\/\d{1,2}\/\d{2,4}/, // Common date formats
          /\d{1,2}-\d{1,2}-\d{2,4}/ // Dash date formats
        ],
        hubspotType: 'date',
        fieldType: 'date'
      },
      datetime: {
        patterns: [
          /timestamp|datetime|created_at|updated_at/i,
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ // ISO datetime format
        ],
        hubspotType: 'datetime',
        fieldType: 'date'
      },
      email: {
        patterns: [
          /email|e-mail|contact|mail/i,
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/ // Email format
        ],
        hubspotType: 'string',
        fieldType: 'text',
        validation: { useDefaultBlockList: true }
      },
      phone: {
        patterns: [
          /phone|mobile|cell|tel|fax|telephone/i,
          /^\+?[\d\s\-\(\)\.]+$/ // Phone number format
        ],
        hubspotType: 'phone_number',
        fieldType: 'phonenumber'
      },
      number: {
        patterns: [
          /amount|price|cost|value|score|count|quantity|revenue|budget|salary|income|rate|fee|commission/i,
          /^\d+\.?\d*$/ // Numeric format
        ],
        hubspotType: 'number',
        fieldType: 'number'
      },
      boolean: {
        patterns: [
          /^(is|has|can|should|will|do|did|active|enabled|disabled|verified|confirmed)/i,
          /^(yes|no|true|false|0|1|y|n)$/i
        ],
        hubspotType: 'bool',
        fieldType: 'booleancheckbox'
      },
      enum: {
        patterns: [
          /status|stage|type|category|source|priority|level|grade|rating|gender|state|country|industry|department|role|position/i
        ],
        hubspotType: 'enumeration',
        fieldType: 'select'
      },
      multiline: {
        patterns: [
          /description|notes|comments|details|message|bio|summary|content|body|address|remarks/i,
          /\n/ // Contains line breaks
        ],
        hubspotType: 'string',
        fieldType: 'textarea'
      },
      url: {
        patterns: [
          /url|website|link|homepage|blog|linkedin|twitter|facebook/i,
          /^https?:\/\// // URL format
        ],
        hubspotType: 'string',
        fieldType: 'text'
      }
    };

    // Common field name transformations
    this.nameTransformations = {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Company Name': 'company_name',
      'Company': 'company_name',
      'Email Address': 'email',
      'Email': 'email',
      'Phone Number': 'phone',
      'Phone': 'phone',
      'Mobile': 'mobile_phone',
      'Date Created': 'created_date',
      'Last Updated': 'last_updated',
      'Website': 'website_url',
      'Address': 'address',
      'City': 'city',
      'State': 'state',
      'Zip Code': 'zip_code',
      'Postal Code': 'postal_code',
      'Country': 'country'
    };

    // HubSpot reserved property names that should be mapped carefully
    this.reservedNames = new Set([
      'firstname', 'lastname', 'email', 'phone', 'company', 'website',
      'address', 'city', 'state', 'zip', 'country', 'jobtitle',
      'lifecyclestage', 'hubspot_owner_id', 'createdate', 'lastmodifieddate'
    ]);

    // Property groups mapping
    this.groupMappings = {
      contact: {
        'personal': ['first_name', 'last_name', 'email', 'phone', 'mobile_phone', 'birthday', 'gender'],
        'company': ['company_name', 'job_title', 'department', 'industry'],
        'location': ['address', 'city', 'state', 'zip_code', 'postal_code', 'country'],
        'social': ['website_url', 'linkedin_url', 'twitter_url', 'facebook_url'],
        'sales': ['lead_status', 'lead_source', 'deal_amount', 'close_date', 'sales_stage'],
        'marketing': ['lifecycle_stage', 'lead_score', 'campaign_source', 'utm_source', 'utm_medium']
      },
      company: {
        'company_information': ['name', 'domain', 'industry', 'type', 'founded_year', 'description'],
        'location': ['address', 'city', 'state', 'zip_code', 'postal_code', 'country'],
        'financial': ['annual_revenue', 'number_of_employees', 'funding_stage'],
        'sales': ['deal_stage', 'account_status', 'contract_value'],
        'social': ['website', 'linkedin_company_page', 'twitter_handle']
      },
      deal: {
        'deal_information': ['deal_name', 'deal_stage', 'deal_type', 'priority'],
        'financial': ['amount', 'close_date', 'probability', 'contract_start_date', 'contract_end_date'],
        'sales': ['sales_rep', 'lead_source', 'deal_source', 'competitor'],
        'product': ['product_interest', 'use_case', 'implementation_date']
      }
    };
  }

  async analyseImportedData(headers, sampleRows, objectType = 'contact') {
    const mappings = [];

    for (const header of headers) {
      const mapping = {
        sourceField: header,
        suggestedName: this.transformFieldName(header),
        suggestedLabel: this.humanizeLabel(header),
        detectedType: null,
        confidence: 0,
        sampleValues: [],
        enumOptions: [],
        groupName: null,
        isReserved: false,
        historicalSuggestions: []
      };

      // Get sample values for this field
      const fieldSamples = sampleRows
        .map(row => row[header])
        .filter(val => val !== null && val !== undefined && val !== '')
        .slice(0, 10);

      mapping.sampleValues = fieldSamples;

      // Check if this maps to a reserved HubSpot property
      mapping.isReserved = this.reservedNames.has(mapping.suggestedName.toLowerCase());

      // Analyse field name
      const nameAnalysis = this.analyseFieldName(header);
      
      // Analyse sample data
      const dataAnalysis = this.analyseSampleData(fieldSamples);

      // Get historical suggestions
      mapping.historicalSuggestions = await this.getHistoricalSuggestions(header, objectType);

      // Combine analyses
      mapping.detectedType = this.combineAnalyses(nameAnalysis, dataAnalysis);
      mapping.confidence = this.calculateConfidence(nameAnalysis, dataAnalysis, mapping.historicalSuggestions);
      
      // Suggest property group
      mapping.groupName = this.suggestPropertyGroup(mapping.suggestedName, objectType);
      
      // If enum type, extract unique values
      if (mapping.detectedType.hubspotType === 'enumeration') {
        mapping.enumOptions = this.extractEnumOptions(fieldSamples);
      }

      mappings.push(mapping);
    }

    return this.optimizeMappings(mappings);
  }

  transformFieldName(fieldName) {
    // Check for common transformations
    if (this.nameTransformations[fieldName]) {
      return this.nameTransformations[fieldName];
    }

    // Convert to HubSpot naming convention
    return fieldName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50); // HubSpot max length
  }

  humanizeLabel(fieldName) {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  analyseFieldName(fieldName) {
    const lowerField = fieldName.toLowerCase();
    
    for (const [type, config] of Object.entries(this.patterns)) {
      for (const pattern of config.patterns) {
        if (typeof pattern === 'string' ? lowerField.includes(pattern) : pattern.test(fieldName)) {
          return {
            type,
            confidence: 0.7,
            source: 'field_name',
            ...config
          };
        }
      }
    }
    return null;
  }

  analyseSampleData(samples) {
    if (!samples || samples.length === 0) return null;

    const typeScores = {};

    // Score each type based on how many samples match
    for (const [type, config] of Object.entries(this.patterns)) {
      let matches = 0;
      
      for (const sample of samples) {
        const sampleStr = String(sample).trim();
        if (!sampleStr) continue;
        
        for (const pattern of config.patterns) {
          if (typeof pattern === 'string' ? 
              sampleStr.toLowerCase().includes(pattern) : 
              pattern.test(sampleStr)) {
            matches++;
            break;
          }
        }
      }

      if (matches > 0) {
        typeScores[type] = matches / samples.length;
      }
    }

    // Find best match
    const bestMatch = Object.entries(typeScores)
      .sort(([,a], [,b]) => b - a)[0];

    if (bestMatch && bestMatch[1] > 0.3) {
      return {
        type: bestMatch[0],
        confidence: bestMatch[1],
        source: 'sample_data',
        ...this.patterns[bestMatch[0]]
      };
    }

    // Check for enum pattern (limited unique values)
    const uniqueValues = [...new Set(samples)];
    if (uniqueValues.length > 1 && uniqueValues.length <= 20 && uniqueValues.length < samples.length * 0.7) {
      return {
        type: 'enum',
        confidence: 0.6,
        source: 'enum_detection',
        ...this.patterns.enum
      };
    }

    // Check string length patterns
    const avgLength = samples.reduce((sum, s) => sum + String(s).length, 0) / samples.length;
    if (avgLength > 100) {
      return {
        type: 'multiline',
        confidence: 0.5,
        source: 'length_analysis',
        ...this.patterns.multiline
      };
    }

    // Default to text
    return {
      type: 'text',
      confidence: 0.3,
      source: 'default',
      hubspotType: 'string',
      fieldType: 'text'
    };
  }

  async getHistoricalSuggestions(sourceField, objectType) {
    try {
      return await MappingHistory.getSuggestions(sourceField, objectType, 3);
    } catch (error) {
      logger.warn('Failed to get historical suggestions:', error);
      return [];
    }
  }

  extractEnumOptions(samples) {
    const validSamples = samples.filter(s => s !== null && s !== undefined && s !== '');
    const uniqueValues = [...new Set(validSamples)];
    
    return uniqueValues
      .slice(0, 50) // Limit options
      .map(value => ({
        label: String(value).trim(),
        value: this.transformFieldName(String(value))
      }))
      .filter(option => option.label && option.value);
  }

  combineAnalyses(nameAnalysis, dataAnalysis) {
    if (!nameAnalysis && !dataAnalysis) {
      return { hubspotType: 'string', fieldType: 'text' };
    }

    if (!nameAnalysis) return dataAnalysis;
    if (!dataAnalysis) return nameAnalysis;

    // If both agree, use that with boosted confidence
    if (nameAnalysis.type === dataAnalysis.type) {
      return {
        ...nameAnalysis,
        confidence: Math.min(0.95, nameAnalysis.confidence * 1.2),
        source: 'combined'
      };
    }

    // Data analysis usually more reliable for type detection
    if (dataAnalysis.confidence > nameAnalysis.confidence * 1.1) {
      return dataAnalysis;
    }

    return nameAnalysis;
  }

  calculateConfidence(nameAnalysis, dataAnalysis, historicalSuggestions) {
    let baseConfidence = 0.1;
    
    if (nameAnalysis) baseConfidence = Math.max(baseConfidence, nameAnalysis.confidence * 0.8);
    if (dataAnalysis) baseConfidence = Math.max(baseConfidence, dataAnalysis.confidence * 0.9);
    
    // Boost confidence if we have historical data
    if (historicalSuggestions && historicalSuggestions.length > 0) {
      const historicalConfidence = historicalSuggestions[0].confidence || 0.5;
      baseConfidence = Math.min(0.95, baseConfidence + (historicalConfidence * 0.2));
    }
    
    // Agreement between name and data analysis boosts confidence
    if (nameAnalysis && dataAnalysis && nameAnalysis.type === dataAnalysis.type) {
      baseConfidence = Math.min(0.95, baseConfidence * 1.3);
    }
    
    return Math.round(baseConfidence * 100) / 100;
  }

  suggestPropertyGroup(propertyName, objectType) {
    const groups = this.groupMappings[objectType] || {};
    
    for (const [groupName, properties] of Object.entries(groups)) {
      if (properties.some(prop => propertyName.includes(prop) || prop.includes(propertyName))) {
        return groupName;
      }
    }
    
    // Default groups by object type
    const defaults = {
      contact: 'contactinformation',
      company: 'companyinformation', 
      deal: 'dealinformation',
      ticket: 'ticketinformation'
    };
    
    return defaults[objectType] || 'information';
  }

  optimizeMappings(mappings) {
    // Check for duplicate suggested names
    const nameCounts = {};
    mappings.forEach(mapping => {
      nameCounts[mapping.suggestedName] = (nameCounts[mapping.suggestedName] || 0) + 1;
    });

    // Resolve duplicates by appending numbers
    const usedNames = new Set();
    mappings.forEach(mapping => {
      let finalName = mapping.suggestedName;
      let counter = 1;
      
      while (usedNames.has(finalName)) {
        finalName = `${mapping.suggestedName}_${counter}`;
        counter++;
      }
      
      mapping.suggestedName = finalName;
      usedNames.add(finalName);
    });

    // Sort by confidence (highest first)
    return mappings.sort((a, b) => b.confidence - a.confidence);
  }

  async recordSuccessfulMapping(sourceField, hubspotName, objectType, mappingData) {
    try {
      await MappingHistory.recordUsage(sourceField, hubspotName, objectType, {
        hubspotType: mappingData.hubspotType,
        fieldType: mappingData.fieldType,
        groupName: mappingData.groupName,
        options: mappingData.options,
        confidence: mappingData.confidence
      });
    } catch (error) {
      logger.warn('Failed to record mapping history:', error);
    }
  }

  validateMapping(mapping) {
    const errors = [];
    
    // Name validation
    if (!mapping.suggestedName || mapping.suggestedName.length === 0) {
      errors.push('Property name is required');
    } else if (mapping.suggestedName.length > 50) {
      errors.push('Property name too long (max 50 characters)');
    } else if (!/^[a-z0-9_]+$/.test(mapping.suggestedName)) {
      errors.push('Property name must contain only lowercase letters, numbers, and underscores');
    }
    
    // Label validation
    if (!mapping.suggestedLabel || mapping.suggestedLabel.trim().length === 0) {
      errors.push('Property label is required');
    }
    
    // Type validation
    if (!mapping.detectedType || !mapping.detectedType.hubspotType) {
      errors.push('Property type is required');
    }
    
    // Enum options validation
    if (mapping.detectedType?.hubspotType === 'enumeration') {
      if (!mapping.enumOptions || mapping.enumOptions.length === 0) {
        errors.push('Enumeration properties require at least one option');
      } else {
        const duplicateValues = mapping.enumOptions
          .map(o => o.value)
          .filter((value, index, arr) => arr.indexOf(value) !== index);
        
        if (duplicateValues.length > 0) {
          errors.push('Duplicate enumeration option values found');
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  generatePropertyConfig(mapping) {
    const config = {
      name: mapping.suggestedName,
      label: mapping.suggestedLabel,
      type: mapping.detectedType.hubspotType,
      fieldType: mapping.detectedType.fieldType,
      groupName: mapping.groupName
    };

    // Add type-specific configurations
    if (mapping.detectedType.hubspotType === 'enumeration' && mapping.enumOptions) {
      config.options = mapping.enumOptions;
    }

    if (mapping.detectedType.validation) {
      config.validation = mapping.detectedType.validation;
    }

    return config;
  }
}

module.exports = PropertyMapper;