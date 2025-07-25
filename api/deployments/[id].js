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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Deployment ID is required' });
    }

    // Get deployment details
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', id)
      .single();

    if (deploymentError || !deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Get deployment logs
    const { data: logs, error: logsError } = await supabase
      .from('deployment_logs')
      .select('*')
      .eq('deployment_id', id)
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('Error fetching deployment logs:', logsError);
      return res.status(500).json({ error: 'Failed to fetch deployment logs' });
    }

    // Process configuration for summary
    const config = deployment.configuration || {};
    const properties = config.properties || {};
    const propertyGroups = config.propertyGroups || [];
    
    let totalProperties = 0;
    let objectTypes = [];
    let propertiesByType = {};
    
    Object.keys(properties).forEach(objectType => {
      const props = properties[objectType] || [];
      totalProperties += props.length;
      objectTypes.push(objectType);
      propertiesByType[objectType] = props.length;
    });

    // Analyze logs for detailed progress
    const stepCounts = {};
    const errors = [];
    const createdProperties = [];
    const createdGroups = [];

    logs.forEach(log => {
      stepCounts[log.step] = (stepCounts[log.step] || 0) + 1;
      
      if (log.step.includes('error')) {
        errors.push({
          step: log.step,
          message: log.message,
          metadata: log.metadata,
          timestamp: log.created_at
        });
      }
      
      if (log.step === 'property_created') {
        createdProperties.push({
          name: log.metadata?.propertyName,
          objectType: log.metadata?.objectType,
          timestamp: log.created_at
        });
      }
      
      if (log.step === 'group_created') {
        createdGroups.push({
          name: log.metadata?.groupName,
          timestamp: log.created_at
        });
      }
    });

    // Calculate duration
    const duration = calculateDuration(deployment.started_at, deployment.completed_at);
    
    // Determine next steps or actions available
    const availableActions = getAvailableActions(deployment.status);

    const detailedDeployment = {
      id: deployment.id,
      clientName: deployment.client_name,
      status: deployment.status,
      progress: deployment.progress_percentage || 0,
      createdAt: deployment.created_at,
      startedAt: deployment.started_at,
      completedAt: deployment.completed_at,
      duration,
      errorMessage: deployment.error_message,
      
      configuration: {
        totalProperties,
        totalGroups: propertyGroups.length,
        objectTypes,
        propertiesByType,
        propertyGroups: propertyGroups.map(group => ({
          name: group.name,
          displayName: group.displayName,
          propertyCount: group.properties ? group.properties.length : 0
        }))
      },
      
      execution: {
        totalSteps: logs.length,
        completedSteps: stepCounts.completed || 0,
        errorSteps: Object.keys(stepCounts).filter(step => step.includes('error')).length,
        createdProperties: createdProperties.length,
        createdGroups: createdGroups.length,
        errors: errors.length
      },
      
      results: {
        createdProperties,
        createdGroups,
        errors
      },
      
      logs: logs.map(log => ({
        id: log.id,
        step: log.step,
        message: log.message,
        metadata: log.metadata,
        timestamp: log.created_at,
        type: getLogType(log.step)
      })),
      
      availableActions
    };

    res.status(200).json({
      success: true,
      data: detailedDeployment
    });

  } catch (error) {
    console.error('Deployment detail error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch deployment details',
      details: error.message 
    });
  }
};

function calculateDuration(startedAt, completedAt) {
  if (!startedAt) return null;
  
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const durationMs = end - start;
  
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${Math.round(durationMs / 1000)}s`;
  } else {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.round((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

function getLogType(step) {
  if (step.includes('error') || step === 'failed') {
    return 'error';
  } else if (step.includes('created') || step === 'completed') {
    return 'success';
  } else if (step.includes('creating') || step === 'started') {
    return 'info';
  } else {
    return 'info';
  }
}

function getAvailableActions(status) {
  const actions = [];
  
  switch (status) {
    case 'failed':
      actions.push({
        action: 'retry',
        label: 'Retry Deployment',
        description: 'Attempt to run the deployment again'
      });
      break;
      
    case 'completed':
      actions.push({
        action: 'rollback',
        label: 'Rollback Changes',
        description: 'Remove created properties and groups (if possible)'
      });
      break;
      
    case 'in_progress':
      actions.push({
        action: 'cancel',
        label: 'Cancel Deployment',
        description: 'Stop the current deployment process'
      });
      break;
  }
  
  // Always allow viewing in HubSpot (if we had the portal ID)
  actions.push({
    action: 'view_hubspot',
    label: 'View in HubSpot',
    description: 'Open HubSpot to see the created properties'
  });
  
  return actions;
}