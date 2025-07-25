const supabase = require('../lib/supabase.js');
const { corsHeaders, handleError } = require('../lib/cors.js');

module.exports = async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  try {
    const { method, query, body } = req;
    const { action, id } = query;

    if (method === 'GET') {
      if (id) {
        return await handleGetTemplate(req, res, id);
      } else {
        return await handleListTemplates(req, res);
      }
    } else if (method === 'POST') {
      if (action === 'create') {
        return await handleCreateTemplate(req, res, body);
      } else {
        return res.status(400).json({
          error: { code: '400', message: 'Invalid action. Must be "create"' }
        });
      }
    } else if (method === 'PUT' && id) {
      return await handleUpdateTemplate(req, res, id, body);
    } else if (method === 'DELETE' && id) {
      return await handleDeleteTemplate(req, res, id);
    } else {
      res.status(405).json({
        error: { code: '405', message: 'Method not allowed' }
      });
    }
  } catch (error) {
    handleError(res, error, 'Failed to process templates request');
  }
};

async function handleListTemplates(req, res) {
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
  
  res.status(200).json({
    success: true,
    data: data || []
  });
}

async function handleGetTemplate(req, res, id) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        error: { code: '404', message: 'Template not found' }
      });
    }
    throw error;
  }
  
  res.status(200).json({
    success: true,
    data
  });
}

async function handleCreateTemplate(req, res, { name, description, industry, config }) {
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
  
  res.status(201).json({
    success: true,
    data
  });
}

async function handleUpdateTemplate(req, res, id, { name, description, industry, config }) {
  const { data, error } = await supabase
    .from('templates')
    .update({
      name,
      description,
      industry,
      config,
      updatedAt: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  res.status(200).json({
    success: true,
    data
  });
}

async function handleDeleteTemplate(req, res, id) {
  // Soft delete by setting isActive to false
  const { data, error } = await supabase
    .from('templates')
    .update({ 
      isActive: false,
      updatedAt: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  res.status(200).json({
    success: true,
    message: 'Template deleted successfully'
  });
}