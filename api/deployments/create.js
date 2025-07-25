const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

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
    const { clientName, config, apiKey } = req.body;

    if (!clientName || !config || !apiKey) {
      return res.status(400).json({ 
        error: 'Client name, configuration, and API key are required' 
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('pat-')) {
      return res.status(400).json({ 
        error: 'Invalid API key format. Must be a HubSpot Private App token.' 
      });
    }

    // Create deployment record in database
    const { data: deployment, error: dbError } = await supabase
      .from('deployments')
      .insert({
        client_name: clientName,
        status: 'in_progress',
        configuration: config,
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to create deployment record' });
    }

    // Start deployment process
    res.status(200).json({
      success: true,
      data: {
        deploymentId: deployment.id,
        status: 'in_progress',
        message: 'Deployment started successfully'
      }
    });

    // Process deployment asynchronously
    processDeployment(deployment.id, config, apiKey, clientName);

  } catch (error) {
    console.error('Deployment creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create deployment',
      details: error.message 
    });
  }
};

async function processDeployment(deploymentId, config, apiKey, clientName) {
  try {
    // Log deployment start
    await logDeploymentStep(deploymentId, 'started', 'Deployment process initiated');

    // Extract configuration
    const { properties = {}, propertyGroups = [] } = config;
    const objectTypes = Object.keys(properties);

    if (objectTypes.length === 0) {
      throw new Error('No properties found in configuration');
    }

    let totalSteps = 0;
    let completedSteps = 0;

    // Count total steps
    for (const objectType of objectTypes) {
      const objectProperties = properties[objectType] || [];
      totalSteps += propertyGroups.length; // Property groups
      totalSteps += objectProperties.length; // Individual properties
    }

    // Step 1: Create property groups
    await logDeploymentStep(deploymentId, 'creating_groups', `Creating ${propertyGroups.length} property groups`);

    const createdGroups = {};
    for (const group of propertyGroups) {
      try {
        const groupResult = await createPropertyGroup(apiKey, group, objectTypes[0]);
        createdGroups[group.name] = groupResult.name;
        completedSteps++;
        
        await logDeploymentStep(
          deploymentId, 
          'group_created', 
          `Created property group: ${group.displayName}`,
          { groupName: group.name, progress: Math.round((completedSteps / totalSteps) * 100) }
        );
      } catch (error) {
        await logDeploymentStep(
          deploymentId, 
          'group_error', 
          `Failed to create group ${group.displayName}: ${error.message}`,
          { error: error.message }
        );
        // Continue with other groups
      }
    }

    // Step 2: Create properties for each object type
    for (const objectType of objectTypes) {
      const objectProperties = properties[objectType] || [];
      
      await logDeploymentStep(
        deploymentId, 
        'creating_properties', 
        `Creating ${objectProperties.length} properties for ${objectType} objects`
      );

      for (const property of objectProperties) {
        try {
          const propertyResult = await createProperty(apiKey, property, objectType, createdGroups);
          completedSteps++;
          
          await logDeploymentStep(
            deploymentId, 
            'property_created', 
            `Created property: ${property.label}`,
            { 
              propertyName: property.name, 
              objectType, 
              progress: Math.round((completedSteps / totalSteps) * 100) 
            }
          );
        } catch (error) {
          await logDeploymentStep(
            deploymentId, 
            'property_error', 
            `Failed to create property ${property.label}: ${error.message}`,
            { error: error.message, propertyName: property.name }
          );
          // Continue with other properties
        }
      }
    }

    // Mark deployment as completed
    await supabase
      .from('deployments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress_percentage: 100
      })
      .eq('id', deploymentId);

    await logDeploymentStep(deploymentId, 'completed', 'Deployment completed successfully');

  } catch (error) {
    console.error(`Deployment ${deploymentId} failed:`, error);
    
    // Mark deployment as failed
    await supabase
      .from('deployments')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', deploymentId);

    await logDeploymentStep(deploymentId, 'failed', `Deployment failed: ${error.message}`, { error: error.message });
  }
}

async function createPropertyGroup(apiKey, group, objectType) {
  const groupData = {
    name: group.name,
    displayName: group.displayName,
    displayOrder: group.displayOrder || -1
  };

  const response = await fetch(`https://api.hubapi.com/crm/v3/properties/${objectType}/groups`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(groupData)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // If group already exists, that's okay
    if (response.status === 409 || errorData.category === 'CONFLICT') {
      return { name: group.name, displayName: group.displayName };
    }
    
    throw new Error(`Failed to create property group: ${response.status} - ${errorData.message || 'Unknown error'}`);
  }

  return await response.json();
}

async function createProperty(apiKey, property, objectType, createdGroups) {
  const propertyData = {
    name: property.name,
    label: property.label,
    type: property.type,
    fieldType: property.fieldType,
    groupName: createdGroups[property.groupName] || property.groupName,
    description: property.description || '',
    hasUniqueValue: property.hasUniqueValue || false,
    hidden: property.hidden || false,
    displayOrder: property.displayOrder || -1,
    formField: property.formField !== false
  };

  // Add type-specific properties
  if (property.type === 'enumeration' && property.options) {
    propertyData.options = property.options.map(option => ({
      label: option.label,
      value: option.value,
      displayOrder: option.displayOrder || -1,
      hidden: false
    }));
  }

  if (property.type === 'number' && property.numberDisplayHint) {
    propertyData.numberDisplayHint = property.numberDisplayHint;
  }

  const response = await fetch(`https://api.hubapi.com/crm/v3/properties/${objectType}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(propertyData)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // If property already exists, that's okay
    if (response.status === 409 || errorData.category === 'CONFLICT') {
      return { name: property.name, label: property.label };
    }
    
    throw new Error(`Failed to create property: ${response.status} - ${errorData.message || 'Unknown error'}`);
  }

  return await response.json();
}

async function logDeploymentStep(deploymentId, step, message, metadata = {}) {
  try {
    await supabase
      .from('deployment_logs')
      .insert({
        deployment_id: deploymentId,
        step,
        message,
        metadata,
        created_at: new Date().toISOString()
      });

    // Update deployment progress if provided
    if (metadata.progress) {
      await supabase
        .from('deployments')
        .update({ progress_percentage: metadata.progress })
        .eq('id', deploymentId);
    }
  } catch (error) {
    console.error('Failed to log deployment step:', error);
  }
}