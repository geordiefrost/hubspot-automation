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
    const { mappings, objectType } = req.body;

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ error: 'Mappings are required' });
    }

    if (!objectType) {
      return res.status(400).json({ error: 'Object type is required' });
    }

    const validationErrors = [];
    const validatedMappings = [];

    // Validate each mapping
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      const fieldErrors = validateMapping(mapping, objectType, i);
      
      if (fieldErrors.length > 0) {
        validationErrors.push(...fieldErrors);
      } else {
        validatedMappings.push(mapping);
      }
    }

    // Check for duplicate property names
    const propertyNames = mappings.map(m => m.suggestedName);
    const duplicates = propertyNames.filter((name, index) => propertyNames.indexOf(name) !== index);
    
    if (duplicates.length > 0) {
      validationErrors.push({
        type: 'duplicate_names',
        message: `Duplicate property names found: ${[...new Set(duplicates)].join(', ')}`
      });
    }

    // Check for required fields
    const requiredFields = getRequiredFields(objectType);
    const mappedFields = mappings.map(m => m.suggestedName);
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));
    
    if (missingRequired.length > 0) {
      validationErrors.push({
        type: 'missing_required',
        message: `Missing required fields for ${objectType}: ${missingRequired.join(', ')}`
      });
    }

    const isValid = validationErrors.length === 0;

    res.status(200).json({
      success: true,
      data: {
        isValid,
        errors: validationErrors,
        validatedMappings: isValid ? mappings : validatedMappings,
        summary: {
          totalMappings: mappings.length,
          validMappings: validatedMappings.length,
          errorCount: validationErrors.length
        }
      }
    });

  } catch (error) {
    console.error('Mapping validation error:', error);
    res.status(500).json({ 
      error: 'Failed to validate mappings',
      details: error.message 
    });
  }
};

function validateMapping(mapping, objectType, index) {
  const errors = [];

  // Check required fields
  if (!mapping.sourceField || !mapping.suggestedName) {
    errors.push({
      type: 'missing_required',
      field: mapping.sourceField,
      index,
      message: 'Source field and suggested name are required'
    });
    return errors;
  }

  // Validate property name format
  const nameValidation = validatePropertyName(mapping.suggestedName);
  if (!nameValidation.isValid) {
    errors.push({
      type: 'invalid_name',
      field: mapping.sourceField,
      index,
      message: nameValidation.error
    });
  }

  // Validate property type
  if (!mapping.detectedType || !mapping.detectedType.hubspotType) {
    errors.push({
      type: 'missing_type',
      field: mapping.sourceField,
      index,
      message: 'Property type is required'
    });
  } else {
    const typeValidation = validatePropertyType(mapping.detectedType);
    if (!typeValidation.isValid) {
      errors.push({
        type: 'invalid_type',
        field: mapping.sourceField,
        index,
        message: typeValidation.error
      });
    }
  }

  // Validate enumeration options if applicable
  if (mapping.detectedType?.hubspotType === 'enumeration') {
    if (!mapping.enumOptions || mapping.enumOptions.length === 0) {
      errors.push({
        type: 'missing_enum_options',
        field: mapping.sourceField,
        index,
        message: 'Enumeration fields must have at least one option'
      });
    } else {
      const enumValidation = validateEnumOptions(mapping.enumOptions);
      if (!enumValidation.isValid) {
        errors.push({
          type: 'invalid_enum_options',
          field: mapping.sourceField,
          index,
          message: enumValidation.error
        });
      }
    }
  }

  // Check for reserved property names
  if (isReservedProperty(mapping.suggestedName, objectType)) {
    errors.push({
      type: 'reserved_name',
      field: mapping.sourceField,
      index,
      message: `"${mapping.suggestedName}" is a reserved property name for ${objectType} objects`
    });
  }

  return errors;
}

function validatePropertyName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Property name must be a non-empty string' };
  }

  // HubSpot property name requirements
  if (name.length > 64) {
    return { isValid: false, error: 'Property name must be 64 characters or less' };
  }

  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return { 
      isValid: false, 
      error: 'Property name must start with a lowercase letter and contain only lowercase letters, numbers, and underscores' 
    };
  }

  if (name.startsWith('hs_') || name.startsWith('hubspot_')) {
    return { isValid: false, error: 'Property names cannot start with "hs_" or "hubspot_"' };
  }

  return { isValid: true };
}

function validatePropertyType(detectedType) {
  const validTypes = ['string', 'number', 'date', 'datetime', 'enumeration', 'bool', 'phone_number'];
  
  if (!validTypes.includes(detectedType.hubspotType)) {
    return { 
      isValid: false, 
      error: `Invalid property type: ${detectedType.hubspotType}. Must be one of: ${validTypes.join(', ')}` 
    };
  }

  const validFieldTypes = {
    'string': ['text', 'textarea'],
    'number': ['number'],
    'date': ['date'],
    'datetime': ['date'],
    'enumeration': ['select', 'radio', 'checkbox'],
    'bool': ['booleancheckbox'],
    'phone_number': ['phonenumber']
  };

  const allowedFieldTypes = validFieldTypes[detectedType.hubspotType] || [];
  if (!allowedFieldTypes.includes(detectedType.fieldType)) {
    return { 
      isValid: false, 
      error: `Invalid field type "${detectedType.fieldType}" for ${detectedType.hubspotType} properties. Allowed: ${allowedFieldTypes.join(', ')}` 
    };
  }

  return { isValid: true };
}

function validateEnumOptions(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return { isValid: false, error: 'Enumeration options must be a non-empty array' };
  }

  if (options.length > 1000) {
    return { isValid: false, error: 'Too many enumeration options (maximum 1000)' };
  }

  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    
    if (!option.label || !option.value) {
      return { isValid: false, error: `Enumeration option ${i + 1} must have both label and value` };
    }

    if (option.label.length > 255) {
      return { isValid: false, error: `Enumeration option "${option.label}" is too long (maximum 255 characters)` };
    }

    if (!/^[a-z0-9_]+$/.test(option.value)) {
      return { 
        isValid: false, 
        error: `Enumeration option value "${option.value}" must contain only lowercase letters, numbers, and underscores` 
      };
    }
  }

  // Check for duplicate values
  const values = options.map(opt => opt.value);
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  
  if (duplicates.length > 0) {
    return { 
      isValid: false, 
      error: `Duplicate enumeration values found: ${[...new Set(duplicates)].join(', ')}` 
    };
  }

  return { isValid: true };
}

function isReservedProperty(propertyName, objectType) {
  const reservedProperties = {
    contact: [
      'email', 'firstname', 'lastname', 'phone', 'company', 'website', 
      'address', 'city', 'state', 'zip', 'country', 'jobtitle',
      'createdate', 'lastmodifieddate', 'hubspot_owner_id'
    ],
    company: [
      'name', 'domain', 'phone', 'address', 'city', 'state', 'zip', 
      'country', 'industry', 'createdate', 'lastmodifieddate', 'hubspot_owner_id'
    ],
    deal: [
      'dealname', 'amount', 'dealstage', 'pipeline', 'closedate',
      'createdate', 'lastmodifieddate', 'hubspot_owner_id'
    ]
  };

  return (reservedProperties[objectType] || []).includes(propertyName);
}

function getRequiredFields(objectType) {
  const requiredFields = {
    contact: [], // Email is technically required but handled separately
    company: [], // Name is technically required but handled separately  
    deal: [] // Deal name is technically required but handled separately
  };

  return requiredFields[objectType] || [];
}