const csv = require('csv-parser');
const { Readable } = require('stream');
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
      case 'csv':
        return await handleCsvImport(req, res, params);
      case 'paste':
        return await handlePasteImport(req, res, params);
      case 'analyse':
        return await handleAnalyse(req, res, params);
      case 'validate':
        return await handleValidate(req, res, params);
      case 'validate-mappings':
        return await handleValidateMappings(req, res, params);
      case 'preview':
        return await handlePreview(req, res, params);
      default:
        return res.status(400).json({
          error: { code: '400', message: 'Invalid action. Must be one of: csv, paste, analyse, validate, validate-mappings, preview' }
        });
    }
  } catch (error) {
    handleError(res, error, 'Import operation failed');
  }
};

async function handleCsvImport(req, res, { csvData, objectType, delimiter = ',' }) {
  if (!csvData) {
    return res.status(400).json({ error: 'CSV data is required' });
  }

  const results = [];
  const headers = [];
  let firstRow = true;

  // Parse CSV data
  const stream = Readable.from(csvData)
    .pipe(csv({ separator: delimiter }));

  for await (const data of stream) {
    if (firstRow) {
      headers.push(...Object.keys(data));
      firstRow = false;
    }
    results.push(data);
  }

  if (headers.length === 0) {
    return res.status(400).json({ error: 'No headers found in CSV data' });
  }

  // Extract sample data (first 10 rows)
  const sampleData = results.slice(0, 10);
  const totalRows = results.length;

  // Basic field type detection
  const fieldAnalysis = headers.map(header => {
    const sampleValues = sampleData
      .map(row => row[header])
      .filter(val => val && val.toString().trim() !== '');

    return {
      fieldName: header,
      sampleValues: sampleValues.slice(0, 5),
      detectedType: detectFieldType(header, sampleValues),
      confidence: calculateConfidence(header, sampleValues)
    };
  });

  res.status(200).json({
    success: true,
    data: {
      headers,
      sampleData,
      totalRows,
      objectType,
      fieldAnalysis,
      importMethod: 'csv'
    }
  });
}

async function handlePasteImport(req, res, { pastedData, objectType }) {
  if (!pastedData || !pastedData.trim()) {
    return res.status(400).json({ error: 'Pasted data is required' });
  }

  // Split data into rows
  const rows = pastedData.trim().split('\n').map(row => row.trim()).filter(row => row);
  
  if (rows.length < 2) {
    return res.status(400).json({ error: 'Data must include headers and at least one data row' });
  }

  // Detect delimiter (tab is most common from Excel, then comma)
  const firstRow = rows[0];
  const tabCount = (firstRow.match(/\t/g) || []).length;
  const commaCount = (firstRow.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  // Parse headers from first row
  const headers = rows[0].split(delimiter).map(header => header.trim().replace(/^"|"$/g, ''));
  
  if (headers.length === 0) {
    return res.status(400).json({ error: 'No headers found in pasted data' });
  }

  // Parse data rows
  const dataRows = rows.slice(1).map(row => {
    const values = row.split(delimiter).map(val => val.trim().replace(/^"|"$/g, ''));
    const rowData = {};
    
    headers.forEach((header, index) => {
      rowData[header] = values[index] || '';
    });
    
    return rowData;
  });

  // Extract sample data (first 10 rows)
  const sampleData = dataRows.slice(0, 10);
  const totalRows = dataRows.length;

  // Basic field type detection
  const fieldAnalysis = headers.map(header => {
    const sampleValues = sampleData
      .map(row => row[header])
      .filter(val => val && val.toString().trim() !== '');

    return {
      fieldName: header,
      sampleValues: sampleValues.slice(0, 5),
      detectedType: detectFieldType(header, sampleValues),
      confidence: calculateConfidence(header, sampleValues)
    };
  });

  res.status(200).json({
    success: true,
    data: {
      headers,
      sampleData,
      totalRows,
      objectType,
      fieldAnalysis,
      importMethod: 'paste',
      delimiter
    }
  });
}

async function handleAnalyse(req, res, { headers, sampleData, objectType }) {
  if (!headers || !Array.isArray(headers) || headers.length === 0) {
    return res.status(400).json({ error: 'Headers are required' });
  }

  if (!sampleData || !Array.isArray(sampleData)) {
    return res.status(400).json({ error: 'Sample data is required' });
  }

  // Analyze each field and create mappings
  const mappings = headers.map((header, index) => {
    const sampleValues = sampleData
      .map(row => row[header])
      .filter(val => val && val.toString().trim() !== '')
      .slice(0, 10); // Take first 10 non-empty values

    const detectedType = detectPropertyType(header, sampleValues);
    const suggestedName = generatePropertyName(header, objectType);
    const suggestedLabel = generatePropertyLabel(header);
    const confidence = calculateMappingConfidence(header, sampleValues, detectedType);

    return {
      sourceField: header,
      suggestedName,
      suggestedLabel,
      detectedType,
      confidence,
      sampleValues,
      isReserved: isReservedProperty(suggestedName, objectType),
      groupName: suggestPropertyGroup(header, detectedType),
      enumOptions: detectedType.hubspotType === 'enumeration' ? extractEnumOptions(sampleValues) : []
    };
  });

  // Generate analysis summary
  const summary = {
    total: mappings.length,
    highConfidence: mappings.filter(m => m.confidence >= 0.8).length,
    mediumConfidence: mappings.filter(m => m.confidence >= 0.5 && m.confidence < 0.8).length,
    lowConfidence: mappings.filter(m => m.confidence < 0.5).length
  };

  // Generate recommendations
  const recommendations = generateRecommendations(mappings, objectType);

  res.status(200).json({
    success: true,
    data: {
      mappings,
      summary,
      recommendations,
      timestamp: new Date().toISOString()
    }
  });
}

async function handleValidate(req, res, { apiKey }) {
  if (!apiKey) {
    return res.status(400).json({
      error: { code: '400', message: 'API key is required' }
    });
  }

  try {
    // Test HubSpot API connection
    const response = await fetch('https://api.hubapi.com/contacts/v1/lists/all', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      res.status(200).json({
        valid: true,
        message: 'API key is valid'
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      res.status(400).json({
        valid: false,
        error: errorData.message || 'Invalid API key'
      });
    }
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: 'Failed to validate API key'
    });
  }
}

async function handleValidateMappings(req, res, { mappings, objectType = 'contact' }) {
  if (!mappings || !Array.isArray(mappings)) {
    return res.status(400).json({
      error: { code: '400', message: 'Mappings array is required' }
    });
  }
  
  const errors = [];
  const warnings = [];
  
  // Validate each mapping
  mappings.forEach((mapping, index) => {
    // Check required fields
    if (!mapping.suggestedName) {
      errors.push({
        field: mapping.sourceField,
        index,
        message: 'Property name is required'
      });
    }
    
    // Check name format
    if (mapping.suggestedName && !/^[a-z][a-z0-9_]*$/.test(mapping.suggestedName)) {
      errors.push({
        field: mapping.sourceField,
        index,
        message: 'Property name must start with a letter and contain only lowercase letters, numbers, and underscores'
      });
    }
    
    // Check name length
    if (mapping.suggestedName && mapping.suggestedName.length > 50) {
      errors.push({
        field: mapping.sourceField,
        index,
        message: 'Property name must be 50 characters or less'
      });
    }
    
    // Check for duplicates
    const duplicates = mappings.filter(m => m.suggestedName === mapping.suggestedName);
    if (duplicates.length > 1) {
      errors.push({
        field: mapping.sourceField,
        index,
        message: `Duplicate property name: ${mapping.suggestedName}`
      });
    }
    
    // Low confidence warning
    if (mapping.confidence < 0.5) {
      warnings.push({
        field: mapping.sourceField,
        index,
        message: 'Low confidence field type detection. Please verify.'
      });
    }
  });
  
  // Object-specific validations
  if (objectType === 'contact') {
    const hasEmail = mappings.some(m => 
      m.detectedType?.hubspotType === 'email' || 
      m.suggestedName?.toLowerCase().includes('email')
    );
    
    if (!hasEmail) {
      warnings.push({
        field: 'general',
        message: 'No email field found. Contact records typically require an email address.'
      });
    }
  }
  
  const isValid = errors.length === 0;
  
  res.status(200).json({
    isValid,
    errors,
    warnings,
    summary: {
      totalMappings: mappings.length,
      errorCount: errors.length,
      warningCount: warnings.length
    }
  });
}

async function handlePreview(req, res, { mappings, sampleData, objectType }) {
  if (!mappings || !Array.isArray(mappings)) {
    return res.status(400).json({ error: 'Mappings are required' });
  }

  if (!sampleData || !Array.isArray(sampleData)) {
    return res.status(400).json({ error: 'Sample data is required' });
  }

  // Transform sample data using mappings
  const transformedData = sampleData.slice(0, 5).map((row, index) => {
    const transformedRow = { _originalIndex: index };
    
    mappings.forEach(mapping => {
      const originalValue = row[mapping.sourceField];
      const transformedValue = transformValue(originalValue, mapping.detectedType);
      transformedRow[mapping.suggestedName] = transformedValue;
    });
    
    return transformedRow;
  });

  // Generate preview statistics
  const stats = {
    totalRows: sampleData.length,
    previewRows: transformedData.length,
    totalFields: mappings.length,
    fieldTypes: mappings.reduce((acc, mapping) => {
      const type = mapping.detectedType.hubspotType;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {})
  };

  res.status(200).json({
    success: true,
    data: {
      preview: transformedData,
      mappings,
      stats,
      objectType
    }
  });
}

// Shared utility functions
function detectFieldType(fieldName, sampleValues) {
  const field = fieldName.toLowerCase();
  
  // Email detection
  if (field.includes('email') || sampleValues.some(val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))) {
    return {
      hubspotType: 'string',
      fieldType: 'text',
      isEmail: true
    };
  }

  // Phone detection
  if (field.includes('phone') || field.includes('mobile') || field.includes('tel') ||
      sampleValues.some(val => /^[\+]?[1-9][\d]{0,15}$/.test(val.replace(/[\s\-\(\)]/g, '')))) {
    return {
      hubspotType: 'phone_number',
      fieldType: 'phonenumber'
    };
  }

  // Date detection
  if (field.includes('date') || field.includes('created') || field.includes('modified') ||
      sampleValues.some(val => !isNaN(Date.parse(val)))) {
    return {
      hubspotType: 'datetime',
      fieldType: 'date'
    };
  }

  // Number detection
  if (field.includes('price') || field.includes('amount') || field.includes('revenue') || field.includes('value') ||
      sampleValues.every(val => !isNaN(parseFloat(val)))) {
    return {
      hubspotType: 'number',
      fieldType: 'number'
    };
  }

  // Boolean detection
  if (sampleValues.every(val => ['true', 'false', 'yes', 'no', '1', '0'].includes(val.toLowerCase()))) {
    return {
      hubspotType: 'bool',
      fieldType: 'booleancheckbox'
    };
  }

  // Enumeration detection (limited unique values)
  const uniqueValues = [...new Set(sampleValues)];
  if (uniqueValues.length <= 10 && uniqueValues.length >= 2 && sampleValues.length >= 5) {
    return {
      hubspotType: 'enumeration',
      fieldType: 'select',
      options: uniqueValues.map(val => ({ label: val, value: val.toLowerCase().replace(/\s+/g, '_') }))
    };
  }

  // Default to text
  return {
    hubspotType: 'string',
    fieldType: 'text'
  };
}

function calculateConfidence(fieldName, sampleValues) {
  const field = fieldName.toLowerCase();
  let confidence = 0.5; // Base confidence

  // High confidence field names
  const highConfidenceFields = ['email', 'phone', 'first_name', 'last_name', 'company', 'website'];
  if (highConfidenceFields.some(hcf => field.includes(hcf))) {
    confidence += 0.3;
  }

  // Data pattern matching increases confidence
  if (sampleValues.length > 0) {
    const firstValue = sampleValues[0];
    
    // Email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(firstValue)) {
      confidence += 0.2;
    }
    
    // Phone pattern
    if (/^[\+]?[1-9][\d]{0,15}$/.test(firstValue.replace(/[\s\-\(\)]/g, ''))) {
      confidence += 0.2;
    }
    
    // Date pattern
    if (!isNaN(Date.parse(firstValue))) {
      confidence += 0.1;
    }
  }

  return Math.min(confidence, 1.0);
}

// Additional utility functions from analyse.js
function detectPropertyType(fieldName, sampleValues) {
  const field = fieldName.toLowerCase().trim();
  
  // Email detection - high priority
  if (field.includes('email') || field === 'email_address' || 
      sampleValues.some(val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))) {
    return {
      hubspotType: 'string',
      fieldType: 'text',
      validation: 'email'
    };
  }

  // Phone detection
  if (field.includes('phone') || field.includes('mobile') || field.includes('tel') ||
      sampleValues.some(val => /^[\+]?[1-9][\d]{0,15}$/.test(val.replace(/[\s\-\(\)\.]/g, '')))) {
    return {
      hubspotType: 'phone_number',
      fieldType: 'phonenumber'
    };
  }

  // URL/Website detection
  if (field.includes('website') || field.includes('url') || field.includes('domain') ||
      sampleValues.some(val => /^https?:\/\//.test(val) || /^www\./.test(val))) {
    return {
      hubspotType: 'string',
      fieldType: 'text',
      validation: 'url'
    };
  }

  // Date detection
  if (field.includes('date') || field.includes('created') || field.includes('modified') || 
      field.includes('birth') || field.includes('anniversary') ||
      sampleValues.some(val => !isNaN(Date.parse(val)) && val.length > 5)) {
    
    // Check if it includes time
    const hasTime = sampleValues.some(val => /\d{1,2}:\d{2}/.test(val));
    return {
      hubspotType: hasTime ? 'datetime' : 'date',
      fieldType: 'date'
    };
  }

  // Number detection
  if (field.includes('price') || field.includes('amount') || field.includes('revenue') || 
      field.includes('value') || field.includes('salary') || field.includes('budget') ||
      field.includes('cost') || field.includes('fee') ||
      sampleValues.every(val => val && !isNaN(parseFloat(val.replace(/[$,]/g, ''))))) {
    return {
      hubspotType: 'number',
      fieldType: 'number'
    };
  }

  // Boolean detection
  if (field.includes('is_') || field.includes('has_') || field.includes('can_') ||
      sampleValues.every(val => ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(val.toLowerCase()))) {
    return {
      hubspotType: 'bool',
      fieldType: 'booleancheckbox'
    };
  }

  // Enumeration detection (limited unique values)
  const uniqueValues = [...new Set(sampleValues.filter(val => val && val.trim()))];
  if (uniqueValues.length <= 15 && uniqueValues.length >= 2 && sampleValues.length >= 3) {
    // Check if values look like categories/statuses
    const avgLength = uniqueValues.reduce((sum, val) => sum + val.length, 0) / uniqueValues.length;
    if (avgLength < 50) { // Short values are likely enum options
      return {
        hubspotType: 'enumeration',
        fieldType: 'select'
      };
    }
  }

  // Long text detection
  const avgLength = sampleValues.reduce((sum, val) => sum + (val ? val.length : 0), 0) / Math.max(sampleValues.length, 1);
  if (avgLength > 100) {
    return {
      hubspotType: 'string',
      fieldType: 'textarea'
    };
  }

  // Default to text
  return {
    hubspotType: 'string',
    fieldType: 'text'
  };
}

function generatePropertyName(fieldName, objectType) {
  // Clean and format field name for HubSpot property naming conventions
  let cleanName = fieldName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');

  // HubSpot reserved property names to avoid
  const reservedNames = {
    contact: ['email', 'firstname', 'lastname', 'phone', 'company', 'website', 'address', 'city', 'state', 'zip'],
    company: ['name', 'domain', 'phone', 'address', 'city', 'state', 'zip'],
    deal: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate']
  };

  const reserved = reservedNames[objectType] || [];
  if (reserved.includes(cleanName)) {
    cleanName = `custom_${cleanName}`;
  }

  // Ensure it doesn't start with a number
  if (/^\d/.test(cleanName)) {
    cleanName = `field_${cleanName}`;
  }

  return cleanName;
}

function generatePropertyLabel(fieldName) {
  // Create human-readable label
  return fieldName
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

function calculateMappingConfidence(fieldName, sampleValues, detectedType) {
  let confidence = 0.5; // Base confidence

  const field = fieldName.toLowerCase();
  
  // High confidence for standard field names
  const standardFields = {
    email: ['email', 'email_address', 'e_mail'],
    phone: ['phone', 'phone_number', 'mobile', 'telephone'],
    name: ['first_name', 'last_name', 'full_name', 'name'],
    company: ['company', 'company_name', 'organization'],
    website: ['website', 'url', 'domain']
  };

  for (const [type, variations] of Object.entries(standardFields)) {
    if (variations.some(variation => field.includes(variation))) {
      confidence += 0.3;
      break;
    }
  }

  // Boost confidence based on data pattern consistency
  if (sampleValues.length > 0) {
    const typeConsistency = checkTypeConsistency(sampleValues, detectedType);
    confidence += typeConsistency * 0.2;
  }

  // Reduce confidence for very generic field names
  const genericNames = ['field', 'column', 'data', 'value', 'info'];
  if (genericNames.some(generic => field.includes(generic))) {
    confidence -= 0.2;
  }

  return Math.max(0.1, Math.min(confidence, 1.0));
}

function checkTypeConsistency(sampleValues, detectedType) {
  if (sampleValues.length === 0) return 0;

  let consistentCount = 0;
  
  for (const value of sampleValues) {
    let isConsistent = false;
    
    switch (detectedType.hubspotType) {
      case 'string':
        if (detectedType.validation === 'email') {
          isConsistent = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        } else {
          isConsistent = typeof value === 'string';
        }
        break;
      case 'number':
        isConsistent = !isNaN(parseFloat(value.replace(/[$,]/g, '')));
        break;
      case 'phone_number':
        isConsistent = /^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)\.]/g, ''));
        break;
      case 'bool':
        isConsistent = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(value.toLowerCase());
        break;
      case 'date':
      case 'datetime':
        isConsistent = !isNaN(Date.parse(value));
        break;
      default:
        isConsistent = true;
    }
    
    if (isConsistent) consistentCount++;
  }

  return consistentCount / sampleValues.length;
}

function isReservedProperty(propertyName, objectType) {
  const reservedProperties = {
    contact: ['email', 'firstname', 'lastname', 'phone', 'company', 'website'],
    company: ['name', 'domain', 'phone'],
    deal: ['dealname', 'amount', 'dealstage', 'pipeline']
  };

  return (reservedProperties[objectType] || []).includes(propertyName);
}

function suggestPropertyGroup(fieldName, detectedType) {
  const field = fieldName.toLowerCase();
  
  // Contact information
  if (field.includes('email') || field.includes('phone') || field.includes('address') || 
      field.includes('city') || field.includes('state') || field.includes('zip')) {
    return 'Contact Information';
  }
  
  // Company information
  if (field.includes('company') || field.includes('organization') || field.includes('employer')) {
    return 'Company Information';
  }
  
  // Financial
  if (field.includes('price') || field.includes('amount') || field.includes('revenue') || 
      field.includes('budget') || field.includes('salary')) {
    return 'Financial Information';
  }
  
  // Dates
  if (detectedType.hubspotType === 'date' || detectedType.hubspotType === 'datetime') {
    return 'Important Dates';
  }
  
  return 'Custom Properties';
}

function extractEnumOptions(sampleValues) {
  const uniqueValues = [...new Set(sampleValues.filter(val => val && val.trim()))];
  
  return uniqueValues.map(value => ({
    label: value,
    value: value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_{2,}/g, '_')
  }));
}

function generateRecommendations(mappings, objectType) {
  const recommendations = [];
  
  // Check for missing standard fields
  const standardFields = {
    contact: ['email', 'firstname', 'lastname'],
    company: ['name', 'domain'],
    deal: ['dealname', 'amount']
  };
  
  const requiredFields = standardFields[objectType] || [];
  const mappedFields = mappings.map(m => m.suggestedName);
  
  for (const required of requiredFields) {
    if (!mappedFields.includes(required)) {
      recommendations.push({
        type: 'missing_field',
        message: `Consider adding a ${required} field mapping for complete ${objectType} records`
      });
    }
  }
  
  // Check for low confidence mappings
  const lowConfidenceMappings = mappings.filter(m => m.confidence < 0.5);
  if (lowConfidenceMappings.length > 0) {
    recommendations.push({
      type: 'review_required',
      message: `${lowConfidenceMappings.length} field mappings have low confidence and should be reviewed`
    });
  }
  
  // Check for enumeration fields that might need attention
  const enumFields = mappings.filter(m => m.detectedType.hubspotType === 'enumeration');
  if (enumFields.length > 0) {
    recommendations.push({
      type: 'enum_options',
      message: `Review dropdown options for ${enumFields.length} enumeration fields to ensure all values are included`
    });
  }
  
  return recommendations;
}

function transformValue(value, detectedType) {
  if (!value) return value;

  switch (detectedType.hubspotType) {
    case 'number':
      const numValue = parseFloat(value.toString().replace(/[$,]/g, ''));
      return isNaN(numValue) ? value : numValue;
    case 'bool':
      const lowerValue = value.toString().toLowerCase();
      if (['true', 'yes', '1', 'y'].includes(lowerValue)) return true;
      if (['false', 'no', '0', 'n'].includes(lowerValue)) return false;
      return value;
    case 'date':
    case 'datetime':
      const dateValue = new Date(value);
      return isNaN(dateValue.getTime()) ? value : dateValue.toISOString();
    default:
      return value;
  }
}