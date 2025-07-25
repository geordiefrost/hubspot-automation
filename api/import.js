const csv = require('csv-parser');
const { Readable } = require('stream');
const { corsHeaders, handleError } = require('../lib/cors.js');

module.exports = async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  if (req.method === 'GET' && req.query.action === 'download-template') {
    return await handleDownloadTemplate(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: '405', message: 'Method not allowed' }
    });
  }

  try {
    const { action, ...params } = req.body;

    switch (action) {
      case 'parse-csv':
        return await handleParseCSV(req, res, params);
      case 'validate-config':
        return await handleValidateConfig(req, res, params);
      case 'preview-deployment':
        return await handlePreviewDeployment(req, res, params);
      default:
        return res.status(400).json({
          error: { code: '400', message: 'Invalid action. Must be one of: parse-csv, validate-config, preview-deployment' }
        });
    }
  } catch (error) {
    handleError(res, error, 'Configuration import operation failed');
  }
};

async function handleDownloadTemplate(req, res) {
  const { configType } = req.query;
  
  const templates = {
    'custom-properties': generateCustomPropertiesTemplate(),
    'property-groups': generatePropertyGroupsTemplate(),
    'deal-pipelines': generateDealPipelinesTemplate(),
    'ticket-pipelines': generateTicketPipelinesTemplate(),
    'products': generateProductsTemplate()
  };

  if (!templates[configType]) {
    return res.status(400).json({
      error: { code: '400', message: 'Invalid config type. Must be one of: custom-properties, property-groups, deal-pipelines, ticket-pipelines, products' }
    });
  }

  const csvContent = templates[configType];
  const filename = `hubspot-${configType}-template.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
}

async function handleParseCSV(req, res, { csvData, configType }) {
  if (!csvData) {
    return res.status(400).json({ error: 'CSV data is required' });
  }

  if (!configType) {
    return res.status(400).json({ error: 'Configuration type is required' });
  }

  const validConfigTypes = ['custom-properties', 'property-groups', 'deal-pipelines', 'ticket-pipelines', 'products'];
  if (!validConfigTypes.includes(configType)) {
    return res.status(400).json({ error: `Invalid config type. Must be one of: ${validConfigTypes.join(', ')}` });
  }

  try {
    const parsedData = await parseCSVData(csvData);
    const validationResult = validateConfigurationData(parsedData, configType);
    
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Configuration validation failed',
        details: validationResult.errors
      });
    }

    const processedConfig = processConfigurationData(parsedData, configType);

    res.status(200).json({
      success: true,
      data: {
        configType,
        totalItems: processedConfig.length,
        items: processedConfig,
        summary: generateConfigSummary(processedConfig, configType)
      }
    });

  } catch (error) {
    return res.status(400).json({
      error: 'Failed to parse CSV data',
      details: error.message
    });
  }
}

async function handleValidateConfig(req, res, { configuration, configType }) {
  if (!configuration || !Array.isArray(configuration)) {
    return res.status(400).json({ error: 'Configuration array is required' });
  }

  if (!configType) {
    return res.status(400).json({ error: 'Configuration type is required' });
  }

  const validationResult = validateConfigurationData(configuration, configType);
  const deploymentChecks = await validateDeploymentRequirements(configuration, configType);

  res.status(200).json({
    success: true,
    data: {
      isValid: validationResult.isValid && deploymentChecks.isValid,
      errors: [...validationResult.errors, ...deploymentChecks.errors],
      warnings: [...(validationResult.warnings || []), ...(deploymentChecks.warnings || [])],
      summary: {
        totalItems: configuration.length,
        validItems: validationResult.validCount,
        errorCount: validationResult.errors.length + deploymentChecks.errors.length,
        warningCount: (validationResult.warnings?.length || 0) + (deploymentChecks.warnings?.length || 0)
      }
    }
  });
}

async function handlePreviewDeployment(req, res, { configuration, configType, apiKey }) {
  if (!configuration || !Array.isArray(configuration)) {
    return res.status(400).json({ error: 'Configuration array is required' });
  }

  if (!configType) {
    return res.status(400).json({ error: 'Configuration type is required' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required for deployment preview' });
  }

  try {
    // Check existing HubSpot configuration to avoid conflicts
    const existingConfig = await checkExistingConfiguration(apiKey, configType);
    const conflicts = identifyConflicts(configuration, existingConfig, configType);
    
    const deploymentPlan = generateDeploymentPlan(configuration, configType, conflicts);

    res.status(200).json({
      success: true,
      data: {
        configType,
        totalItems: configuration.length,
        deploymentPlan,
        conflicts,
        estimatedDuration: calculateEstimatedDuration(configuration, configType),
        summary: generateDeploymentPreviewSummary(deploymentPlan, conflicts)
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate deployment preview',
      details: error.message
    });
  }
}

// CSV Template Generators
function generateCustomPropertiesTemplate() {
  return `object_type,name,label,type,field_type,group_name,description,options,required,unique
contact,custom_lead_source,Lead Source,enumeration,select,lead_information,Source where this lead came from,"Website,Referral,Cold Call,Social Media",false,false
company,custom_industry_vertical,Industry Vertical,string,text,company_information,Specific industry vertical,",false,false
deal,custom_deal_priority,Deal Priority,enumeration,select,deal_information,Priority level of this deal,"Low,Medium,High,Critical",false,false
product,custom_product_category,Product Category,enumeration,select,product_information,Category classification,"Software,Hardware,Service",false,false
ticket,custom_severity_level,Severity Level,enumeration,select,ticket_information,Technical severity level,"P1,P2,P3,P4",false,false`;
}

function generatePropertyGroupsTemplate() {
  return `object_type,name,display_name,display_order,description
contact,lead_information,Lead Information,1,Properties related to lead generation and source tracking
contact,qualification_data,Qualification Data,2,Lead scoring and qualification information
company,company_details,Company Details,1,Extended company information and classification
deal,deal_tracking,Deal Tracking,1,Custom deal tracking and pipeline information
product,product_specs,Product Specifications,1,Technical specifications and categorization
ticket,support_tracking,Support Tracking,1,Customer support and resolution tracking`;
}

function generateDealPipelinesTemplate() {
  return `pipeline_name,pipeline_label,stage_name,stage_label,stage_order,probability,required_properties,stage_type
sales_pipeline,Sales Pipeline,prospecting,Prospecting,1,10,deal_source,open
sales_pipeline,Sales Pipeline,qualification,Qualification,2,25,"budget_confirmed,decision_maker_identified",open
sales_pipeline,Sales Pipeline,proposal,Proposal Sent,3,50,proposal_date,open
sales_pipeline,Sales Pipeline,negotiation,Negotiation,4,75,contract_sent,open
sales_pipeline,Sales Pipeline,closed_won,Closed Won,5,100,close_date,closed_won
sales_pipeline,Sales Pipeline,closed_lost,Closed Lost,6,0,lost_reason,closed_lost`;
}

function generateTicketPipelinesTemplate() {
  return `pipeline_name,pipeline_label,stage_name,stage_label,stage_order,sla_hours,required_properties,auto_assign
support_pipeline,Customer Support,new,New Ticket,1,2,priority,true
support_pipeline,Customer Support,in_progress,In Progress,2,24,assigned_agent,false
support_pipeline,Customer Support,waiting_customer,Waiting on Customer,3,,customer_contacted,false
support_pipeline,Customer Support,resolved,Resolved,4,1,resolution_notes,false
support_pipeline,Customer Support,closed,Closed,5,,satisfaction_survey,false`;
}

function generateProductsTemplate() {
  return `name,description,price,unit_cost,category,sku,active,tax_exempt,folder_id
Premium CRM License,Full-featured CRM access with advanced reporting,299.00,150.00,Software,CRM-PREM-001,true,false,
Basic Support Package,Standard technical support package,99.00,25.00,Service,SUPP-BASIC-001,true,false,
Enterprise Integration,Custom integration development service,2500.00,1200.00,Service,INT-ENT-001,true,false,
Mobile App License,Mobile application access license,49.00,15.00,Software,MOB-LIC-001,true,false,`;
}

// CSV Parsing Functions
async function parseCSVData(csvData) {
  const results = [];
  const stream = Readable.from(csvData).pipe(csv());

  for await (const data of stream) {
    results.push(data);
  }

  return results;
}

// Configuration Validation Functions
function validateConfigurationData(data, configType) {
  const validators = {
    'custom-properties': validateCustomProperties,
    'property-groups': validatePropertyGroups,
    'deal-pipelines': validateDealPipelines,
    'ticket-pipelines': validateTicketPipelines,
    'products': validateProducts
  };

  const validator = validators[configType];
  if (!validator) {
    return { isValid: false, errors: [`Unknown configuration type: ${configType}`], validCount: 0 };
  }

  return validator(data);
}

function validateCustomProperties(properties) {
  const errors = [];
  const warnings = [];
  let validCount = 0;

  const validObjectTypes = ['contact', 'company', 'deal', 'product', 'ticket'];
  const validTypes = ['string', 'number', 'bool', 'enumeration', 'date', 'datetime'];
  const validFieldTypes = ['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'date'];

  properties.forEach((prop, index) => {
    const rowNum = index + 2; // Account for header row

    if (!prop.object_type) {
      errors.push(`Row ${rowNum}: object_type is required`);
    } else if (!validObjectTypes.includes(prop.object_type)) {
      errors.push(`Row ${rowNum}: Invalid object_type. Must be one of: ${validObjectTypes.join(', ')}`);
    }

    if (!prop.name) {
      errors.push(`Row ${rowNum}: name is required`);
    } else if (!/^[a-z][a-z0-9_]*$/.test(prop.name)) {
      errors.push(`Row ${rowNum}: name must start with lowercase letter and contain only lowercase letters, numbers, and underscores`);
    }

    if (!prop.label) {
      errors.push(`Row ${rowNum}: label is required`);
    }

    if (!prop.type) {
      errors.push(`Row ${rowNum}: type is required`);
    } else if (!validTypes.includes(prop.type)) {
      errors.push(`Row ${rowNum}: Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    if (prop.type === 'enumeration' && !prop.options) {
      errors.push(`Row ${rowNum}: enumeration type requires options`);
    }

    if (prop.required === 'true' && prop.type === 'bool') {
      warnings.push(`Row ${rowNum}: Boolean properties should typically not be required`);
    }

    if (errors.length === 0) {
      validCount++;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validCount
  };
}

function validatePropertyGroups(groups) {
  const errors = [];
  let validCount = 0;

  const validObjectTypes = ['contact', 'company', 'deal', 'product', 'ticket'];

  groups.forEach((group, index) => {
    const rowNum = index + 2;

    if (!group.object_type) {
      errors.push(`Row ${rowNum}: object_type is required`);
    } else if (!validObjectTypes.includes(group.object_type)) {
      errors.push(`Row ${rowNum}: Invalid object_type. Must be one of: ${validObjectTypes.join(', ')}`);
    }

    if (!group.name) {
      errors.push(`Row ${rowNum}: name is required`);
    } else if (!/^[a-z][a-z0-9_]*$/.test(group.name)) {
      errors.push(`Row ${rowNum}: name must start with lowercase letter and contain only lowercase letters, numbers, and underscores`);
    }

    if (!group.display_name) {
      errors.push(`Row ${rowNum}: display_name is required`);
    }

    if (group.display_order && isNaN(parseInt(group.display_order))) {
      errors.push(`Row ${rowNum}: display_order must be a number`);
    }

    if (errors.length === 0) {
      validCount++;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validCount
  };
}

function validateDealPipelines(pipelines) {
  const errors = [];
  let validCount = 0;

  const validStageTypes = ['open', 'closed_won', 'closed_lost'];

  pipelines.forEach((pipeline, index) => {
    const rowNum = index + 2;

    if (!pipeline.pipeline_name) {
      errors.push(`Row ${rowNum}: pipeline_name is required`);
    }

    if (!pipeline.stage_name) {
      errors.push(`Row ${rowNum}: stage_name is required`);
    }

    if (!pipeline.stage_label) {
      errors.push(`Row ${rowNum}: stage_label is required`);
    }

    if (!pipeline.stage_order) {
      errors.push(`Row ${rowNum}: stage_order is required`);
    } else if (isNaN(parseInt(pipeline.stage_order))) {
      errors.push(`Row ${rowNum}: stage_order must be a number`);
    }

    if (!pipeline.probability) {
      errors.push(`Row ${rowNum}: probability is required`);
    } else {
      const prob = parseFloat(pipeline.probability);
      if (isNaN(prob) || prob < 0 || prob > 100) {
        errors.push(`Row ${rowNum}: probability must be a number between 0 and 100`);
      }
    }

    if (pipeline.stage_type && !validStageTypes.includes(pipeline.stage_type)) {
      errors.push(`Row ${rowNum}: Invalid stage_type. Must be one of: ${validStageTypes.join(', ')}`);
    }

    if (errors.length === 0) {
      validCount++;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validCount
  };
}

function validateTicketPipelines(pipelines) {
  const errors = [];
  let validCount = 0;

  pipelines.forEach((pipeline, index) => {
    const rowNum = index + 2;

    if (!pipeline.pipeline_name) {
      errors.push(`Row ${rowNum}: pipeline_name is required`);
    }

    if (!pipeline.stage_name) {
      errors.push(`Row ${rowNum}: stage_name is required`);
    }

    if (!pipeline.stage_label) {
      errors.push(`Row ${rowNum}: stage_label is required`);
    }

    if (!pipeline.stage_order) {
      errors.push(`Row ${rowNum}: stage_order is required`);
    } else if (isNaN(parseInt(pipeline.stage_order))) {
      errors.push(`Row ${rowNum}: stage_order must be a number`);
    }

    if (pipeline.sla_hours && isNaN(parseFloat(pipeline.sla_hours))) {
      errors.push(`Row ${rowNum}: sla_hours must be a number`);
    }

    if (errors.length === 0) {
      validCount++;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validCount
  };
}

function validateProducts(products) {
  const errors = [];
  let validCount = 0;

  products.forEach((product, index) => {
    const rowNum = index + 2;

    if (!product.name) {
      errors.push(`Row ${rowNum}: name is required`);
    }

    if (product.price && isNaN(parseFloat(product.price))) {
      errors.push(`Row ${rowNum}: price must be a number`);
    }

    if (product.unit_cost && isNaN(parseFloat(product.unit_cost))) {
      errors.push(`Row ${rowNum}: unit_cost must be a number`);
    }

    if (product.active && !['true', 'false'].includes(product.active.toLowerCase())) {
      errors.push(`Row ${rowNum}: active must be true or false`);
    }

    if (errors.length === 0) {
      validCount++;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validCount
  };
}

// Configuration Processing Functions
function processConfigurationData(data, configType) {
  const processors = {
    'custom-properties': processCustomProperties,
    'property-groups': processPropertyGroups,
    'deal-pipelines': processDealPipelines,
    'ticket-pipelines': processTicketPipelines,
    'products': processProducts
  };

  return processors[configType](data);
}

function processCustomProperties(properties) {
  return properties.map(prop => ({
    name: prop.name,
    label: prop.label,
    type: prop.type,
    fieldType: prop.field_type || getDefaultFieldType(prop.type),
    groupName: prop.group_name || 'contactinformation',
    description: prop.description || '',
    objectType: prop.object_type,
    options: prop.options ? prop.options.split(',').map(opt => ({
      label: opt.trim(),
      value: opt.toLowerCase().replace(/\s+/g, '_')
    })) : undefined,
    hasUniqueValue: prop.unique === 'true',
    formField: prop.required === 'true'
  }));
}

function processPropertyGroups(groups) {
  return groups.map(group => ({
    name: group.name,
    displayName: group.display_name,
    displayOrder: parseInt(group.display_order) || -1,
    objectType: group.object_type,
    description: group.description || ''
  }));
}

function processDealPipelines(pipelines) {
  const pipelineMap = {};
  
  pipelines.forEach(stage => {
    if (!pipelineMap[stage.pipeline_name]) {
      pipelineMap[stage.pipeline_name] = {
        name: stage.pipeline_name,
        label: stage.pipeline_label || stage.pipeline_name,
        stages: []
      };
    }
    
    pipelineMap[stage.pipeline_name].stages.push({
      name: stage.stage_name,
      label: stage.stage_label,
      displayOrder: parseInt(stage.stage_order),
      probability: parseFloat(stage.probability) / 100,
      stageType: stage.stage_type || 'open',
      requiredProperties: stage.required_properties ? stage.required_properties.split(',') : []
    });
  });

  return Object.values(pipelineMap);
}

function processTicketPipelines(pipelines) {
  const pipelineMap = {};
  
  pipelines.forEach(stage => {
    if (!pipelineMap[stage.pipeline_name]) {
      pipelineMap[stage.pipeline_name] = {
        name: stage.pipeline_name,
        label: stage.pipeline_label || stage.pipeline_name,
        stages: []
      };
    }
    
    pipelineMap[stage.pipeline_name].stages.push({
      name: stage.stage_name,
      label: stage.stage_label,
      displayOrder: parseInt(stage.stage_order),
      slaHours: stage.sla_hours ? parseFloat(stage.sla_hours) : null,
      requiredProperties: stage.required_properties ? stage.required_properties.split(',') : [],
      autoAssign: stage.auto_assign === 'true'
    });
  });

  return Object.values(pipelineMap);
}

function processProducts(products) {
  return products.map(product => ({
    name: product.name,
    description: product.description || '',
    price: product.price ? parseFloat(product.price) : null,
    unitCost: product.unit_cost ? parseFloat(product.unit_cost) : null,
    category: product.category || '',
    sku: product.sku || '',
    isActive: product.active !== 'false',
    taxExempt: product.tax_exempt === 'true',
    folderId: product.folder_id || null
  }));
}

// Utility Functions
function getDefaultFieldType(type) {
  const typeMap = {
    string: 'text',
    number: 'number',
    bool: 'booleancheckbox',
    enumeration: 'select',
    date: 'date',
    datetime: 'date'
  };
  return typeMap[type] || 'text';
}

function generateConfigSummary(config, configType) {
  const summaries = {
    'custom-properties': (config) => {
      const byObjectType = config.reduce((acc, prop) => {
        acc[prop.objectType] = (acc[prop.objectType] || 0) + 1;
        return acc;
      }, {});
      return { totalProperties: config.length, byObjectType };
    },
    'property-groups': (config) => {
      const byObjectType = config.reduce((acc, group) => {
        acc[group.objectType] = (acc[group.objectType] || 0) + 1;
        return acc;
      }, {});
      return { totalGroups: config.length, byObjectType };
    },
    'deal-pipelines': (config) => ({
      totalPipelines: config.length,
      totalStages: config.reduce((sum, pipeline) => sum + pipeline.stages.length, 0)
    }),
    'ticket-pipelines': (config) => ({
      totalPipelines: config.length,
      totalStages: config.reduce((sum, pipeline) => sum + pipeline.stages.length, 0)
    }),
    'products': (config) => ({
      totalProducts: config.length,
      activeProducts: config.filter(p => p.isActive).length
    })
  };

  return summaries[configType](config);
}

async function validateDeploymentRequirements(configuration, configType) {
  // This would validate against HubSpot limits and requirements
  const errors = [];
  const warnings = [];

  // Add specific validation logic here based on HubSpot limits
  if (configType === 'custom-properties' && configuration.length > 1000) {
    warnings.push('Large number of properties may take longer to deploy');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

async function checkExistingConfiguration(apiKey, configType) {
  // This would check existing HubSpot configuration
  // Placeholder for now
  return [];
}

function identifyConflicts(newConfig, existingConfig, configType) {
  // This would identify naming conflicts and duplicates
  // Placeholder for now
  return [];
}

function generateDeploymentPlan(configuration, configType, conflicts) {
  return {
    totalSteps: configuration.length,
    estimatedDuration: calculateEstimatedDuration(configuration, configType),
    conflicts: conflicts.length,
    actions: configuration.map((item, index) => ({
      step: index + 1,
      action: `Create ${configType.replace('-', ' ')}`,
      item: item.name || item.label,
      estimated_time: '2-3 seconds'
    }))
  };
}

function calculateEstimatedDuration(configuration, configType) {
  const baseTime = configuration.length * 2; // 2 seconds per item
  const overhead = 10; // 10 seconds overhead
  return `${Math.ceil((baseTime + overhead) / 60)} minutes`;
}

function generateDeploymentPreviewSummary(deploymentPlan, conflicts) {
  return {
    totalActions: deploymentPlan.totalSteps,
    estimatedTime: deploymentPlan.estimatedDuration,
    conflicts: conflicts.length,
    status: conflicts.length > 0 ? 'requires_review' : 'ready_to_deploy'
  };
}