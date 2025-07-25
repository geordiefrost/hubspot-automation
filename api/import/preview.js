const { corsHeaders, handleError } = require('../../lib/cors.js');

module.exports = async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: '405', message: 'Method not allowed' }
    });
  }

  try {
    const { mappings, objectType = 'contact' } = req.body;
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({
        error: { code: '400', message: 'Mappings array is required' }
      });
    }
    
    // Generate HubSpot configuration
    const properties = mappings.map(mapping => ({
      name: mapping.suggestedName,
      label: mapping.suggestedLabel || mapping.sourceField,
      type: mapping.detectedType?.hubspotType || 'string',
      fieldType: mapping.detectedType?.fieldType || 'text',
      groupName: mapping.groupName || 'contactinformation',
      description: `Imported from field: ${mapping.sourceField}`,
      options: mapping.enumOptions || undefined
    }));
    
    // Group properties by type for summary
    const propertyTypes = properties.reduce((acc, prop) => {
      acc[prop.type] = (acc[prop.type] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate estimated deployment time
    const baseTime = 5; // Base setup time
    const propertyTime = properties.length * 0.5; // 0.5 seconds per property
    const groupTime = new Set(properties.map(p => p.groupName)).size * 1; // 1 second per group
    const estimatedSeconds = Math.round(baseTime + propertyTime + groupTime);
    
    const configuration = {
      properties: {
        [objectType]: properties
      },
      propertyGroups: [...new Set(properties.map(p => p.groupName))].map(groupName => ({
        name: groupName,
        label: groupName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase()),
        displayOrder: 0
      })),
      summary: {
        totalProperties: properties.length,
        groupsNeeded: new Set(properties.map(p => p.groupName)).size,
        propertyTypes: Object.entries(propertyTypes).map(([type, count]) => ({
          type,
          count
        }))
      }
    };
    
    const estimatedTime = {
      estimatedSeconds,
      breakdown: {
        properties: `${properties.length} properties (~${Math.round(propertyTime)}s)`,
        groups: `${configuration.summary.groupsNeeded} groups (~${Math.round(groupTime)}s)`,
        overhead: `Setup overhead (~${baseTime}s)`
      }
    };
    
    res.status(200).json({
      configuration,
      estimatedDeploymentTime: estimatedTime
    });
    
  } catch (error) {
    handleError(res, error, 'Failed to generate configuration preview');
  }
}