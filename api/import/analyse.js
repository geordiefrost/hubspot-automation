module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { headers, sampleData, objectType } = req.body;

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

  } catch (error) {
    console.error('Field analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze fields',
      details: error.message 
    });
  }
};

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