const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = async (req, res) => {
  // Set CORS headers for SSE
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { deploymentId } = req.query;
  
  if (!deploymentId) {
    res.write('event: error\n');
    res.write('data: {"error": "Deployment ID is required"}\n\n');
    return res.end();
  }

  try {
    // Send initial connection message
    res.write('event: connected\n');
    res.write('data: {"message": "Connected to deployment stream"}\n\n');

    // Get current deployment status
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();

    if (deploymentError || !deployment) {
      res.write('event: error\n');
      res.write('data: {"error": "Deployment not found"}\n\n');
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

  } catch (error) {
    console.error('Deployment stream error:', error);
    res.write('event: error\n');
    res.write(`data: ${JSON.stringify({
      error: 'Failed to establish deployment stream',
      details: error.message
    })}\n\n`);
    res.end();
  }
};