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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get total deployments count
    const { count: totalDeployments, error: countError } = await supabase
      .from('deployments')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting total deployments:', countError);
      return res.status(500).json({ error: 'Failed to get deployment statistics' });
    }

    // Get status counts
    const { data: statusData, error: statusError } = await supabase
      .from('deployments')
      .select('status')
      .neq('status', null);

    if (statusError) {
      console.error('Error getting status data:', statusError);
      return res.status(500).json({ error: 'Failed to get deployment statistics' });
    }

    // Count deployments by status
    const statusCounts = statusData.reduce((acc, deployment) => {
      const status = deployment.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Calculate success rate
    const completed = statusCounts.completed || 0;
    const failed = statusCounts.failed || 0;
    const total = completed + failed;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Get recent deployments (last 10)
    const { data: recentDeployments, error: recentError } = await supabase
      .from('deployments')
      .select('id, client_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Error getting recent deployments:', recentError);
      return res.status(500).json({ error: 'Failed to get deployment statistics' });
    }

    // Format status counts for frontend
    const formattedStatusCounts = {};
    ['completed', 'failed', 'in_progress', 'pending'].forEach(status => {
      formattedStatusCounts[status] = {
        count: statusCounts[status] || 0,
        percentage: totalDeployments > 0 ? Math.round(((statusCounts[status] || 0) / totalDeployments) * 100) : 0
      };
    });

    // Get deployment trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: trendData, error: trendError } = await supabase
      .from('deployments')
      .select('created_at, status')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    if (trendError) {
      console.error('Error getting trend data:', trendError);
    }

    // Group trend data by day
    const dailyStats = {};
    if (trendData) {
      trendData.forEach(deployment => {
        const date = deployment.created_at.split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { total: 0, completed: 0, failed: 0 };
        }
        dailyStats[date].total++;
        if (deployment.status === 'completed') {
          dailyStats[date].completed++;
        } else if (deployment.status === 'failed') {
          dailyStats[date].failed++;
        }
      });
    }

    const stats = {
      totalDeployments: totalDeployments || 0,
      successRate,
      statusCounts: formattedStatusCounts,
      recentDeployments: recentDeployments?.map(deployment => ({
        id: deployment.id,
        clientName: deployment.client_name,
        status: deployment.status,
        createdAt: deployment.created_at
      })) || [],
      trends: {
        last30Days: dailyStats,
        period: '30 days'
      },
      summary: {
        activeDeployments: formattedStatusCounts.in_progress?.count || 0,
        completedToday: 0, // Would need more complex query
        averageDeploymentTime: '45 seconds', // Would need to calculate from actual data
        mostCommonObjectType: 'contact' // Would need to analyze configurations
      }
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Deployment stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get deployment statistics',
      details: error.message 
    });
  }
};