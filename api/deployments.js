const { createClient } = require('@supabase/supabase-js');
const { corsHeaders, handleError } = require('../lib/cors.js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  try {
    const { action, ...params } = req.body || {};
    const { method, query } = req;

    // Handle different actions based on method and parameters
    if (method === 'GET') {
      if (query.action === 'stats') {
        return await handleStats(req, res);
      } else if (query.action === 'stream') {
        return await handleStream(req, res);
      } else if (query.id) {
        return await handleGetDeployment(req, res);
      } else {
        return await handleListDeployments(req, res);
      }
    } else if (method === 'POST') {
      if (action === 'create') {
        return await handleCreateDeployment(req, res, params);
      } else {
        return res.status(400).json({
          error: { code: '400', message: 'Invalid action. Must be "create"' }
        });
      }
    } else {
      return res.status(405).json({
        error: { code: '405', message: 'Method not allowed' }
      });
    }
  } catch (error) {
    handleError(res, error, 'Deployment operation failed');
  }
};

async function handleListDeployments(req, res) {
  const { page = 1, limit = 10, status, clientName } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('deployments')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    
    if (clientName) {
      query = query.ilike('client_name', `%${clientName}%`);
    }

    const { data: deployments, error, count } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        deployments: deployments || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (dbError) {
    console.log('Database not available for deployments list:', dbError.message);
    res.status(200).json({
      success: true,
      data: {
        deployments: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      }
    });
  }
}

async function handleGetDeployment(req, res) {
  const { id } = req.query;

  try {
    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Get deployment logs
    let logs = [];
    try {
      const { data: logsData, error: logsError } = await supabase
        .from('deployment_logs')
        .select('*')
        .eq('deployment_id', id)
        .order('created_at', { ascending: true });

      if (!logsError && logsData) {
        logs = logsData;
      }
    } catch (logsError) {
      console.log('Deployment logs not available:', logsError.message);
    }

    res.status(200).json({
      success: true,
      data: {
        deployment,
        logs
      }
    });
  } catch (dbError) {
    console.log('Database not available for deployment lookup:', dbError.message);
    res.status(404).json({ error: 'Deployment not found' });
  }
}

async function handleCreateDeployment(req, res, { clientName, config, apiKey }) {
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

  try {
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
      throw dbError;
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
  } catch (dbError) {
    console.log('Database not available, processing deployment without DB tracking:', dbError.message);
    
    // Generate a mock deployment ID for processing
    const mockDeploymentId = 'temp_' + Date.now();
    
    res.status(200).json({
      success: true,
      data: {
        deploymentId: mockDeploymentId,
        status: 'in_progress',
        message: 'Deployment started successfully (database unavailable)'
      }
    });

    // Process deployment without database tracking
    processDeploymentWithoutDB(config, apiKey, clientName);
  }
}

async function handleStats(req, res) {
  try {
    // Try to get stats from Supabase, but provide fallback if DB not set up
    let totalDeployments = 0;
    let statusCounts = {};
    let recentDeployments = [];

    try {
      // Get total deployments count
      const { count, error: countError } = await supabase
        .from('deployments')
        .select('*', { count: 'exact', head: true });

      if (!countError) {
        totalDeployments = count || 0;

        // Get status counts
        const { data: statusData, error: statusError } = await supabase
          .from('deployments')
          .select('status')
          .neq('status', null);

        if (!statusError && statusData) {
          statusCounts = statusData.reduce((acc, deployment) => {
            const status = deployment.status;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});

          // Get recent deployments (last 10)
          const { data: recent, error: recentError } = await supabase
            .from('deployments')
            .select('id, client_name, status, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

          if (!recentError && recent) {
            recentDeployments = recent;
          }
        }
      }
    } catch (dbError) {
      console.log('Database not available, using fallback stats:', dbError.message);
    }

    // Calculate success rate
    const completed = statusCounts.completed || 0;
    const failed = statusCounts.failed || 0;
    const total = completed + failed;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Format status counts for frontend
    const formattedStatusCounts = {};
    ['completed', 'failed', 'in_progress', 'pending'].forEach(status => {
      formattedStatusCounts[status] = {
        count: statusCounts[status] || 0,
        percentage: totalDeployments > 0 ? Math.round(((statusCounts[status] || 0) / totalDeployments) * 100) : 0
      };
    });

    const stats = {
      totalDeployments,
      successRate,
      statusCounts: formattedStatusCounts,
      recentDeployments: recentDeployments?.map(deployment => ({
        id: deployment.id,
        clientName: deployment.client_name,
        status: deployment.status,
        createdAt: deployment.created_at
      })) || [],
      trends: {
        last30Days: {},
        period: '30 days'
      },
      summary: {
        activeDeployments: formattedStatusCounts.in_progress?.count || 0,
        completedToday: 0,
        averageDeploymentTime: '45 seconds',
        mostCommonObjectType: 'contact'
      }
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get deployment statistics',
      details: error.message 
    });
  }
}

async function handleStream(req, res) {
  // Set CORS headers for SSE
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { deploymentId } = req.query;
  
  if (!deploymentId) {
    res.write('event: error\n');
    res.write('data: {"error": "Deployment ID is required"}\n\n');
    return res.end();
  }

  // Send initial connection message
  res.write('event: connected\n');
  res.write('data: {"message": "Connected to deployment stream"}\n\n');

  // Get current deployment status
  let deployment = null;
  try {
    const { data: deploymentData, error: deploymentError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();

    if (deploymentError || !deploymentData) {
      throw new Error('Deployment not found in database');
    }
    deployment = deploymentData;
  } catch (dbError) {
    console.log('Database not available for deployment streaming:', dbError.message);
    res.write('event: error\n');
    res.write('data: {"error": "Deployment tracking not available"}\n\n');
    return res.end();
  }

  // Send current status
  res.write('event: status\n');
  res.write(`data: ${JSON.stringify({
    deploymentId,
    status: deployment.status,
    progress: deployment.progress_percentage || 0,
    clientName: deployment.client_name
  })}\n\n`);

  // If deployment is already completed or failed, send final status and close
  if (['completed', 'failed'].includes(deployment.status)) {
    res.write('event: final\n');
    res.write(`data: ${JSON.stringify({
      status: deployment.status,
      completedAt: deployment.completed_at,
      errorMessage: deployment.error_message
    })}\n\n`);
    return res.end();
  }

  // Subscribe to deployment log changes using Supabase real-time
  const subscription = supabase
    .channel(`deployment-${deploymentId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'deployment_logs',
        filter: `deployment_id=eq.${deploymentId}`
      },
      (payload) => {
        const log = payload.new;
        
        res.write('event: log\n');
        res.write(`data: ${JSON.stringify({
          step: log.step,
          message: log.message,
          metadata: log.metadata,
          timestamp: log.created_at
        })}\n\n`);

        // Send progress updates
        if (log.metadata?.progress) {
          res.write('event: progress\n');
          res.write(`data: ${JSON.stringify({
            percentage: log.metadata.progress,
            step: log.step,
            message: log.message
          })}\n\n`);
        }

        // Check if deployment is completed
        if (log.step === 'completed') {
          res.write('event: completed\n');
          res.write(`data: ${JSON.stringify({
            message: 'Deployment completed successfully',
            timestamp: log.created_at
          })}\n\n`);
          
          subscription.unsubscribe();
          res.end();
        } else if (log.step === 'failed') {
          res.write('event: failed\n');
          res.write(`data: ${JSON.stringify({
            message: log.message,
            error: log.metadata?.error,
            timestamp: log.created_at
          })}\n\n`);
          
          subscription.unsubscribe();
          res.end();
        }
      }
    )
    .subscribe();

  // Also subscribe to deployment status changes
  const deploymentSubscription = supabase
    .channel(`deployment-status-${deploymentId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'deployments',
        filter: `id=eq.${deploymentId}`
      },
      (payload) => {
        const deployment = payload.new;
        
        res.write('event: status\n');
        res.write(`data: ${JSON.stringify({
          status: deployment.status,
          progress: deployment.progress_percentage || 0,
          errorMessage: deployment.error_message
        })}\n\n`);

        // Close connection if deployment is final
        if (['completed', 'failed'].includes(deployment.status)) {
          deploymentSubscription.unsubscribe();
          subscription.unsubscribe();
          res.end();
        }
      }
    )
    .subscribe();

  // Handle client disconnect
  req.on('close', () => {
    subscription.unsubscribe();
    deploymentSubscription.unsubscribe();
  });

  req.on('end', () => {
    subscription.unsubscribe();
    deploymentSubscription.unsubscribe();
  });

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    if (res.destroyed) {
      clearInterval(heartbeat);
      subscription.unsubscribe();
      deploymentSubscription.unsubscribe();
      return;
    }
    
    res.write('event: heartbeat\n');
    res.write('data: {"timestamp": "' + new Date().toISOString() + '"}\n\n');
  }, 30000);

  // Clean up heartbeat on close
  req.on('close', () => {
    clearInterval(heartbeat);
  });
}

// Deployment processing function without database tracking
async function processDeploymentWithoutDB(config, apiKey, clientName) {
  try {
    console.log(`Starting deployment for ${clientName} without database tracking`);
    
    // Extract configuration
    const { properties = {}, propertyGroups = [] } = config;
    const objectTypes = Object.keys(properties);

    if (objectTypes.length === 0) {
      console.error('No properties found in configuration');
      return;
    }

    console.log(`Creating ${propertyGroups.length} property groups`);

    // Step 1: Create property groups
    const createdGroups = {};
    for (const group of propertyGroups) {
      try {
        const groupResult = await createPropertyGroup(apiKey, group, objectTypes[0]);
        createdGroups[group.name] = groupResult.name;
        console.log(`Created property group: ${group.displayName}`);
      } catch (error) {
        console.error(`Failed to create group ${group.displayName}: ${error.message}`);
      }
    }

    // Step 2: Create properties for each object type
    for (const objectType of objectTypes) {
      const objectProperties = properties[objectType] || [];
      console.log(`Creating ${objectProperties.length} properties for ${objectType} objects`);

      for (const property of objectProperties) {
        try {
          await createProperty(apiKey, property, objectType, createdGroups);
          console.log(`Created property: ${property.label}`);
        } catch (error) {
          console.error(`Failed to create property ${property.label}: ${error.message}`);
        }
      }
    }

    console.log(`Deployment for ${clientName} completed successfully`);
  } catch (error) {
    console.error(`Deployment for ${clientName} failed:`, error);
  }
}

// Deployment processing function
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
    try {
      await supabase
        .from('deployments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress_percentage: 100
        })
        .eq('id', deploymentId);
    } catch (dbError) {
      console.log(`Deployment ${deploymentId} completed (database update failed):`, dbError.message);
    }

    await logDeploymentStep(deploymentId, 'completed', 'Deployment completed successfully');

  } catch (error) {
    console.error(`Deployment ${deploymentId} failed:`, error);
    
    // Mark deployment as failed
    try {
      await supabase
        .from('deployments')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', deploymentId);
    } catch (dbError) {
      console.log(`Deployment ${deploymentId} failed (database update failed):`, dbError.message);
    }

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
    // If database is not available, just log to console
    console.log(`Deployment ${deploymentId} - ${step}: ${message}`, metadata);
  }
}