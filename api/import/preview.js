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

    // Generate property configurations
    const properties = mappings.map(mapping => createPropertyConfiguration(mapping, objectType));

    // Group properties by their suggested groups
    const propertyGroups = groupProperties(mappings);

    // Generate configuration summary
    const summary = generateConfigurationSummary(properties, propertyGroups);

    // Estimate deployment time
    const estimatedTime = estimateDeploymentTime(properties, propertyGroups);

    const configuration = {
      properties,
      propertyGroups,
      summary,
      objectType,
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: {
        configuration,
        estimatedDeploymentTime: estimatedTime
      }
    });

  } catch (error) {
    console.error('Configuration preview error:', error);
    res.status(500).json({ 
      error: 'Failed to generate configuration preview',
      details: error.message 
    });
  }
};

function createPropertyConfiguration(mapping, objectType) {
  const config = {
    name: mapping.suggestedName,
    label: mapping.suggestedLabel || generateLabel(mapping.sourceField),
    description: `Property mapped from "${mapping.sourceField}" field`,
    groupName: mapping.groupName || 'Custom Properties',
    type: mapping.detectedType.hubspotType,
    fieldType: mapping.detectedType.fieldType,
    hasUniqueValue: false,
    hidden: false,
    displayOrder: -1,
    formField: true,
    sourceField: mapping.sourceField,
    confidence: mapping.confidence
  };

  // Add type-specific configurations
  switch (mapping.detectedType.hubspotType) {
    case 'enumeration':
      config.options = mapping.enumOptions || [];
      break;
    
    case 'number':
      config.numberDisplayHint = 'unformatted';
      break;
    
    case 'string':
      if (mapping.detectedType.validation === 'email') {
        config.description += ' (Email format)';
      } else if (mapping.detectedType.validation === 'url') {
        config.description += ' (URL format)';
      }
      break;
    
    case 'phone_number':
      config.description += ' (Phone number format)';
      break;
  }

  return config;
}

function groupProperties(mappings) {
  const groups = {};

  mappings.forEach(mapping => {
    const groupName = mapping.groupName || 'Custom Properties';
    
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        displayName: groupName,
        displayOrder: getGroupDisplayOrder(groupName),
        properties: []
      };
    }

    groups[groupName].properties.push(mapping.suggestedName);
  });

  return Object.values(groups);
}

function getGroupDisplayOrder(groupName) {
  const groupOrder = {
    'Contact Information': 1,
    'Company Information': 2,
    'Financial Information': 3,
    'Important Dates': 4,
    'Custom Properties': 5
  };

  return groupOrder[groupName] || 10;
}

function generateConfigurationSummary(properties, propertyGroups) {
  const propertyTypes = {};
  
  properties.forEach(prop => {
    propertyTypes[prop.type] = (propertyTypes[prop.type] || 0) + 1;
  });

  return {
    totalProperties: properties.length,
    groupsNeeded: propertyGroups.length,
    objectType: properties[0]?.objectType || 'contact',
    propertyTypes: Object.entries(propertyTypes).map(([type, count]) => ({
      type,
      count
    })),
    highConfidenceProperties: properties.filter(p => p.confidence >= 0.8).length,
    mediumConfidenceProperties: properties.filter(p => p.confidence >= 0.5 && p.confidence < 0.8).length,
    lowConfidenceProperties: properties.filter(p => p.confidence < 0.5).length
  };
}

function estimateDeploymentTime(properties, propertyGroups) {
  // Base time estimates (in seconds)
  const baseTime = 5; // Setup and validation
  const timePerGroup = 2; // Creating property groups
  const timePerProperty = 1.5; // Creating individual properties
  const timePerEnumProperty = 3; // Enumeration properties take longer
  const overhead = 10; // API delays, rate limiting buffer

  const enumProperties = properties.filter(p => p.type === 'enumeration').length;
  const regularProperties = properties.length - enumProperties;

  const groupTime = propertyGroups.length * timePerGroup;
  const propertyTime = (regularProperties * timePerProperty) + (enumProperties * timePerEnumProperty);
  
  const totalSeconds = Math.ceil(baseTime + groupTime + propertyTime + overhead);

  return {
    estimatedSeconds: totalSeconds,
    breakdown: {
      groups: `${propertyGroups.length} property groups (~${groupTime}s)`,
      properties: `${properties.length} properties (~${Math.ceil(propertyTime)}s)`,
      overhead: `Setup and API overhead (~${baseTime + overhead}s)`
    },
    factors: {
      totalProperties: properties.length,
      propertyGroups: propertyGroups.length,
      enumerationProperties: enumProperties,
      estimatedApiCalls: propertyGroups.length + properties.length + 2
    }
  };
}

function generateLabel(fieldName) {
  return fieldName
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}