const supabase = require('../../lib/supabase.js');
const { corsHeaders, handleError } = require('../../lib/cors.js');

module.exports = async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { limit = 10, offset = 0, status } = req.query;
      
      let query = supabase
        .from('deployments')
        .select(`
          id,
          clientName,
          status,
          startedAt,
          completedAt,
          executionTime,
          createdAt,
          templates(name, industry)
        `)
        .order('createdAt', { ascending: false })
        .limit(parseInt(limit))
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      res.status(200).json(data);
      
    } else if (req.method === 'POST') {
      const { clientName, templateId, config } = req.body;
      
      if (!clientName || !config) {
        return res.status(400).json({
          error: { code: '400', message: 'Client name and config are required' }
        });
      }
      
      // Create deployment record
      const { data, error } = await supabase
        .from('deployments')
        .insert({
          clientName,
          templateId,
          config,
          status: 'pending',
          apiKeyHash: 'placeholder', // Will be updated when actual deployment starts
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
    handleError(res, error, 'Failed to process deployments request');
  }
}