import supabase from '../../lib/supabase.js';
import { corsHeaders, handleError } from '../../lib/cors.js';

export default async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { limit = 10, offset = 0, industry } = req.query;
      
      let query = supabase
        .from('templates')
        .select('*')
        .eq('isActive', true)
        .order('usageCount', { ascending: false })
        .limit(parseInt(limit))
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
      
      if (industry) {
        query = query.eq('industry', industry);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      res.status(200).json(data);
      
    } else if (req.method === 'POST') {
      const { name, description, industry, config } = req.body;
      
      if (!name || !config) {
        return res.status(400).json({
          error: { code: '400', message: 'Name and config are required' }
        });
      }
      
      const { data, error } = await supabase
        .from('templates')
        .insert({
          name,
          description,
          industry,
          config,
          createdBy: 'api',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(201).json(data);
      
    } else {
      res.status(405).json({
        error: { code: '405', message: 'Method not allowed' }
      });
    }
    
  } catch (error) {
    handleError(res, error, 'Failed to process templates request');
  }
}