import supabase from '../lib/supabase.js';
import { corsHeaders, handleError } from '../lib/cors.js';

export default async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  try {
    // Test database connection
    const { data, error } = await supabase
      .from('templates')
      .select('count(*)')
      .limit(1);
    
    if (error) throw error;
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development'
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
}