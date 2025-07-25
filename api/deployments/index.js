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
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabase
      .from('deployments')
      .select(`
        id,
        client_name,
        status,
        progress_percentage,
        created_at,
        started_at,
        completed_at,
        error_message,
        configuration
      `, { count: 'exact' });

    // Add filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('client_name', `%${search}%`);
    }

    // Add pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: deployments, error, count } = await query;

    if (error) {
      console.error('Error fetching deployments:', error);
      return res.status(500).json({ error: 'Failed to fetch deployments' });
    }

    // Enhance deployments with additional info
    const enhancedDeployments = deployments.map(deployment => {
      const config = deployment.configuration || {};
      const properties = config.properties || {};
      
      let totalProperties = 0;
      let objectTypes = [];
      
      Object.keys(properties).forEach(objectType => {
        const props = properties[objectType] || [];
        totalProperties += props.length;
        objectTypes.push(objectType);
      });

      return {
        id: deployment.id,
        clientName: deployment.client_name,
        status: deployment.status,
        progress: deployment.progress_percentage || 0,
        createdAt: deployment.created_at,
        startedAt: deployment.started_at,
        completedAt: deployment.completed_at,
        errorMessage: deployment.error_message,
        summary: {
          totalProperties,
          objectTypes,
          propertyGroups: (config.propertyGroups || []).length
        },
        duration: calculateDuration(deployment.started_at, deployment.completed_at)
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        deployments: enhancedDeployments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPreviousPage: parseInt(page) > 1
        },
        filters: {
          status: status || 'all',
          search: search || ''
        }
      }
    });

  } catch (error) {
    console.error('Deployments list error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch deployments',
      details: error.message 
    });
  }
};

function calculateDuration(startedAt, completedAt) {
  if (!startedAt || !completedAt) {
    return null;
  }

  const start = new Date(startedAt);
  const end = new Date(completedAt);
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