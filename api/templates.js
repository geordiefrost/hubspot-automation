const supabase = require('../lib/supabase.js');
const { corsHeaders, handleError } = require('../lib/cors.js');
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  try {
    const { method, query, body } = req;
    const { action, id, industry } = query;

    if (method === 'GET') {
      if (action === 'industry-templates') {
        return await handleGetIndustryTemplates(req, res);
      } else if (action === 'industry-template' && industry) {
        return await handleGetIndustryTemplate(req, res, industry);
      } else if (id) {
        return await handleGetTemplate(req, res, id);
      } else {
        return await handleListTemplates(req, res);
      }
    } else if (method === 'POST') {
      if (action === 'create') {
        return await handleCreateTemplate(req, res, body);
      } else if (action === 'deploy-industry-template') {
        return await handleDeployIndustryTemplate(req, res, body);
      } else {
        return res.status(400).json({
          error: { code: '400', message: 'Invalid action. Must be "create" or "deploy-industry-template"' }
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
  try {
    const { limit = 10, offset = 0, industry } = req.query;
    
    // Try to fetch from Supabase, but provide fallback
    let templates = [];
    
    try {
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
      
      if (!error && data) {
        templates = data;
      }
    } catch (dbError) {
      console.log('Database not available for templates, using empty list:', dbError.message);
    }
    
    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Templates list error:', error);
    res.status(500).json({
      error: 'Failed to load templates',
      details: error.message
    });
  }
}

async function handleGetTemplate(req, res, id) {
  try {
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
  } catch (dbError) {
    console.log('Database not available, template not found:', dbError.message);
    res.status(404).json({
      error: { code: '404', message: 'Template not found' }
    });
  }
}

async function handleCreateTemplate(req, res, { name, description, industry, config }) {
  if (!name || !config) {
    return res.status(400).json({
      error: { code: '400', message: 'Name and config are required' }
    });
  }
  
  try {
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
  } catch (dbError) {
    console.log('Database not available for template creation:', dbError.message);
    res.status(503).json({
      error: 'Database not available. Please try again later.'
    });
  }
}

async function handleUpdateTemplate(req, res, id, { name, description, industry, config }) {
  try {
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
  } catch (dbError) {
    console.log('Database not available for template update:', dbError.message);
    res.status(503).json({
      error: 'Database not available. Please try again later.'
    });
  }
}

async function handleDeleteTemplate(req, res, id) {
  try {
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
  } catch (dbError) {
    console.log('Database not available for template deletion:', dbError.message);
    res.status(503).json({
      error: 'Database not available. Please try again later.'
    });
  }
}

async function handleGetIndustryTemplates(req, res) {
  try {
    const templatesDir = path.join(process.cwd(), 'templates', 'industry');
    const files = fs.readdirSync(templatesDir);
    
    const templates = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(templatesDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          id: file.replace('.json', ''),
          name: content.name,
          description: content.description,
          industry: content.industry,
          categories: content.categories,
          configCount: {
            customProperties: content.configurations['custom-properties']?.length || 0,
            propertyGroups: content.configurations['property-groups']?.length || 0,
            dealPipelines: content.configurations['deal-pipelines'] ? 
              Object.keys(content.configurations['deal-pipelines'].reduce((acc, stage) => {
                acc[stage.pipeline_name] = true;
                return acc;
              }, {})).length : 0,
            ticketPipelines: content.configurations['ticket-pipelines'] ? 
              Object.keys(content.configurations['ticket-pipelines'].reduce((acc, stage) => {
                acc[stage.pipeline_name] = true;
                return acc;
              }, {})).length : 0,
            products: content.configurations['products']?.length || 0
          }
        };
      });

    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error reading industry templates:', error);
    res.status(500).json({
      error: 'Failed to load industry templates'
    });
  }
}

async function handleGetIndustryTemplate(req, res, industry) {
  try {
    const templatePath = path.join(process.cwd(), 'templates', 'industry', `${industry}.json`);
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        error: { code: '404', message: 'Industry template not found' }
      });
    }

    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error reading industry template:', error);
    res.status(500).json({
      error: 'Failed to load industry template'
    });
  }
}

async function handleDeployIndustryTemplate(req, res, { industry, clientName, apiKey, selectedCategories }) {
  if (!industry || !clientName || !apiKey) {
    return res.status(400).json({
      error: 'Industry, client name, and API key are required'
    });
  }

  try {
    const templatePath = path.join(process.cwd(), 'templates', 'industry', `${industry}.json`);
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        error: { code: '404', message: 'Industry template not found' }
      });
    }

    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    
    // Filter configurations based on selected categories
    const filteredConfig = {};
    const categoriesToDeploy = selectedCategories || template.categories;
    
    categoriesToDeploy.forEach(category => {
      if (template.configurations[category]) {
        filteredConfig[category] = template.configurations[category];
      }
    });

    // Convert to deployment format
    const deploymentConfig = {
      properties: {},
      propertyGroups: filteredConfig['property-groups'] || [],
      dealPipelines: filteredConfig['deal-pipelines'] || [],
      ticketPipelines: filteredConfig['ticket-pipelines'] || [],
      products: filteredConfig['products'] || []
    };

    // Group properties by object type
    if (filteredConfig['custom-properties']) {
      filteredConfig['custom-properties'].forEach(prop => {
        if (!deploymentConfig.properties[prop.object_type]) {
          deploymentConfig.properties[prop.object_type] = [];
        }
        deploymentConfig.properties[prop.object_type].push({
          name: prop.name,
          label: prop.label,
          type: prop.type,
          fieldType: prop.field_type,
          groupName: prop.group_name,
          description: prop.description,
          options: prop.options ? prop.options.split(',').map(opt => ({
            label: opt.trim(),
            value: opt.toLowerCase().replace(/\s+/g, '_')
          })) : undefined,
          hasUniqueValue: prop.unique === 'true',
          formField: prop.required === 'true'
        });
      });
    }

    // Create deployment via deployments API
    const deploymentResponse = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/deployments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'create',
        clientName: `${clientName} - ${template.name}`,
        config: deploymentConfig,
        apiKey
      })
    });

    if (!deploymentResponse.ok) {
      const error = await deploymentResponse.json();
      throw new Error(error.error || 'Failed to create deployment');
    }

    const deployment = await deploymentResponse.json();

    res.status(200).json({
      success: true,
      data: {
        deploymentId: deployment.data.deploymentId,
        templateName: template.name,
        industry: template.industry,
        categoriesDeployed: categoriesToDeploy,
        message: 'Industry template deployment started successfully'
      }
    });

  } catch (error) {
    console.error('Error deploying industry template:', error);
    res.status(500).json({
      error: 'Failed to deploy industry template',
      details: error.message
    });
  }
}