const HubSpotAPI = require('./HubSpotAPI');
const { Deployment, DeploymentLog, Template } = require('../models');
const logger = require('../utils/logger');
const crypto = require('crypto');

class DeploymentEngine {
  constructor() {
    this.activeDeployments = new Map();
  }

  async deployConfiguration(deploymentData, progressCallback) {
    const { clientName, templateId, config, apiKey } = deploymentData;
    
    // Hash API key for storage
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // Create deployment record
    const deployment = await Deployment.create({
      clientName,
      templateId,
      config,
      apiKeyHash,
      status: 'pending',
      deploymentProgress: {
        totalSteps: 0,
        completedSteps: 0,
        currentStep: null
      }
    });

    logger.info('Starting deployment', {
      deploymentId: deployment.id,
      clientName,
      templateId
    });

    try {
      // Initialize HubSpot API
      const hubspot = new HubSpotAPI(apiKey);
      
      // Test connection first
      const connectionTest = await hubspot.testConnection();
      if (!connectionTest.success) {
        throw new Error(`HubSpot API connection failed: ${connectionTest.error}`);
      }

      // Calculate total steps
      const totalSteps = this.calculateTotalSteps(config);
      await deployment.update({
        deploymentProgress: { totalSteps, completedSteps: 0, currentStep: null },
        status: 'in_progress',
        startedAt: new Date()
      });

      // Track this deployment
      this.activeDeployments.set(deployment.id, {
        deployment,
        hubspot,
        progressCallback
      });

      // Execute deployment steps
      const result = await this.executeDeploymentSteps(deployment, hubspot, config, progressCallback);
      
      // Update template usage if successful
      if (templateId && result.success) {
        await Template.increment('usageCount', { where: { id: templateId } });
        await Template.update({ lastUsed: new Date() }, { where: { id: templateId } });
      }

      return result;

    } catch (error) {
      logger.error('Deployment failed', {
        deploymentId: deployment.id,
        error: error.message
      });

      await deployment.update({
        status: 'failed',
        errorDetails: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date()
        },
        completedAt: new Date()
      });

      // Attempt rollback
      if (deployment.createdEntities.length > 0) {
        await this.rollbackDeployment(deployment.id, apiKey);
      }

      throw error;
    } finally {
      this.activeDeployments.delete(deployment.id);
    }
  }

  calculateTotalSteps(config) {
    let steps = 0;
    
    // Property groups
    if (config.propertyGroups) {
      steps += config.propertyGroups.length;
    }
    
    // Properties (by object type)
    if (config.properties) {
      Object.values(config.properties).forEach(properties => {
        if (Array.isArray(properties)) {
          steps += Math.ceil(properties.length / 10); // Batch by 10
        }
      });
    }
    
    // Pipelines
    if (config.pipelines) {
      Object.values(config.pipelines).forEach(pipelines => {
        if (Array.isArray(pipelines)) {
          steps += pipelines.length;
        }
      });
    }
    
    // Lifecycle stages
    if (config.lifecycleStages) {
      steps += 1;
    }
    
    return steps;
  }

  async executeDeploymentSteps(deployment, hubspot, config, progressCallback) {
    const createdEntities = [];
    let completedSteps = 0;

    try {
      // Step 1: Create property groups
      if (config.propertyGroups && config.propertyGroups.length > 0) {
        await this.logStep(deployment.id, 'create_property_groups', 'started');
        
        for (const group of config.propertyGroups) {
          const objectType = group.objectType || 'contact';
          
          try {
            const result = await hubspot.createPropertyGroup(objectType, {
              name: group.name,
              label: group.label,
              displayOrder: group.displayOrder || 0
            });

            createdEntities.push({
              type: 'propertyGroup',
              objectType,
              id: result.name,
              name: result.name
            });

            logger.debug('Property group created', {
              deploymentId: deployment.id,
              objectType,
              groupName: result.name
            });

          } catch (error) {
            if (error.status === 409) {
              // Group already exists, continue
              logger.warn('Property group already exists', {
                deploymentId: deployment.id,
                objectType,
                groupName: group.name
              });
            } else {
              throw error;
            }
          }
        }

        completedSteps++;
        await this.updateProgress(deployment, completedSteps, 'Property groups created');
        await this.logStep(deployment.id, 'create_property_groups', 'completed');
        
        if (progressCallback) {
          progressCallback({ step: 'Property groups created', completedSteps });
        }
      }

      // Step 2: Create properties by object type
      if (config.properties) {
        for (const [objectType, properties] of Object.entries(config.properties)) {
          if (!Array.isArray(properties) || properties.length === 0) continue;

          await this.logStep(deployment.id, `create_properties_${objectType}`, 'started');

          // Process in batches of 10
          const batches = this.chunkArray(properties, 10);
          
          for (const batch of batches) {
            try {
              const results = await hubspot.bulkCreateProperties(objectType, batch, (progress) => {
                if (progressCallback) {
                  progressCallback({
                    step: `Creating ${objectType} properties`,
                    progress: progress.percentage,
                    details: `${progress.completed}/${progress.total} properties`
                  });
                }
              });

              // Track successful creations
              results.results.forEach(result => {
                if (result.success) {
                  createdEntities.push({
                    type: 'property',
                    objectType,
                    id: result.property,
                    name: result.property
                  });
                }
              });

              completedSteps++;
              await this.updateProgress(deployment, completedSteps, `${objectType} properties batch completed`);

            } catch (error) {
              await this.logStep(deployment.id, `create_properties_${objectType}`, 'failed', {
                error: error.message,
                batch: batch.map(p => p.name)
              });
              throw error;
            }
          }

          await this.logStep(deployment.id, `create_properties_${objectType}`, 'completed', {
            count: properties.length
          });
        }
      }

      // Step 3: Create pipelines
      if (config.pipelines) {
        for (const [objectType, pipelines] of Object.entries(config.pipelines)) {
          if (!Array.isArray(pipelines) || pipelines.length === 0) continue;

          await this.logStep(deployment.id, `create_pipelines_${objectType}`, 'started');

          for (const pipeline of pipelines) {
            try {
              const result = await hubspot.createPipeline(objectType, pipeline);

              createdEntities.push({
                type: 'pipeline',
                objectType,
                id: result.id,
                name: result.label
              });

              logger.debug('Pipeline created', {
                deploymentId: deployment.id,
                objectType,
                pipelineId: result.id,
                pipelineName: result.label
              });

            } catch (error) {
              if (error.status === 409) {
                // Pipeline already exists
                logger.warn('Pipeline already exists', {
                  deploymentId: deployment.id,
                  objectType,
                  pipelineName: pipeline.label
                });
              } else {
                throw error;
              }
            }
          }

          completedSteps++;
          await this.updateProgress(deployment, completedSteps, `${objectType} pipelines created`);
          await this.logStep(deployment.id, `create_pipelines_${objectType}`, 'completed');
        }
      }

      // Step 4: Update lifecycle stages
      if (config.lifecycleStages && config.lifecycleStages.stages) {
        await this.logStep(deployment.id, 'update_lifecycle_stages', 'started');

        try {
          await hubspot.updateLifecycleStages(config.lifecycleStages.stages);
          
          completedSteps++;
          await this.updateProgress(deployment, completedSteps, 'Lifecycle stages updated');
          await this.logStep(deployment.id, 'update_lifecycle_stages', 'completed');

        } catch (error) {
          await this.logStep(deployment.id, 'update_lifecycle_stages', 'failed', {
            error: error.message
          });
          // Don't fail entire deployment for lifecycle stage errors
          logger.warn('Lifecycle stages update failed', {
            deploymentId: deployment.id,
            error: error.message
          });
        }
      }

      // Update deployment with created entities
      await deployment.update({
        createdEntities,
        status: 'completed',
        completedAt: new Date(),
        executionTime: Date.now() - deployment.startedAt.getTime()
      });

      logger.info('Deployment completed successfully', {
        deploymentId: deployment.id,
        entitiesCreated: createdEntities.length,
        executionTime: Date.now() - deployment.startedAt.getTime()
      });

      return {
        success: true,
        deploymentId: deployment.id,
        createdEntities,
        summary: this.generateDeploymentSummary(createdEntities)
      };

    } catch (error) {
      // Save created entities for rollback
      await deployment.update({ createdEntities });
      throw error;
    }
  }

  async rollbackDeployment(deploymentId, apiKey) {
    logger.info('Starting deployment rollback', { deploymentId });

    try {
      const deployment = await Deployment.findByPk(deploymentId);
      if (!deployment) {
        throw new Error('Deployment not found');
      }

      const hubspot = new HubSpotAPI(apiKey);
      const { createdEntities } = deployment;

      await this.logStep(deploymentId, 'rollback', 'started');

      // Rollback in reverse order
      const sortedEntities = [...createdEntities].reverse();
      let rolledBackCount = 0;

      for (const entity of sortedEntities) {
        try {
          switch (entity.type) {
            case 'property':
              await hubspot.deleteProperty(entity.objectType, entity.id);
              break;
            case 'pipeline':
              await hubspot.deletePipeline(entity.objectType, entity.id);
              break;
            case 'propertyGroup':
              await hubspot.deletePropertyGroup(entity.objectType, entity.id);
              break;
          }
          rolledBackCount++;
          
        } catch (error) {
          if (error.status === 404) {
            // Entity already deleted or doesn't exist
            rolledBackCount++;
            continue;
          }
          
          logger.warn('Failed to rollback entity', {
            deploymentId,
            entity,
            error: error.message
          });
        }
      }

      await deployment.update({
        status: 'rolled_back',
        createdEntities: [], // Clear the list after rollback
        errorDetails: {
          ...deployment.errorDetails,
          rollback: {
            attempted: createdEntities.length,
            successful: rolledBackCount,
            timestamp: new Date()
          }
        }
      });

      await this.logStep(deploymentId, 'rollback', 'completed', {
        rolledBackCount,
        totalEntities: createdEntities.length
      });

      logger.info('Deployment rollback completed', {
        deploymentId,
        rolledBackCount,
        totalEntities: createdEntities.length
      });

      return {
        success: true,
        rolledBackCount,
        totalEntities: createdEntities.length
      };

    } catch (error) {
      await this.logStep(deploymentId, 'rollback', 'failed', {
        error: error.message
      });

      logger.error('Deployment rollback failed', {
        deploymentId,
        error: error.message
      });

      throw error;
    }
  }

  async updateProgress(deployment, completedSteps, currentStep) {
    const progress = {
      totalSteps: deployment.deploymentProgress.totalSteps,
      completedSteps,
      currentStep
    };

    await deployment.update({ deploymentProgress: progress });
  }

  async logStep(deploymentId, step, status, details = null) {
    try {
      await DeploymentLog.create({
        deploymentId,
        step,
        status,
        details,
        executionTime: status === 'completed' ? 1000 : null // Placeholder
      });
    } catch (error) {
      logger.error('Failed to log deployment step', {
        deploymentId,
        step,
        status,
        error: error.message
      });
    }
  }

  generateDeploymentSummary(createdEntities) {
    const summary = {
      total: createdEntities.length,
      byType: {},
      byObjectType: {}
    };

    createdEntities.forEach(entity => {
      // Count by type
      summary.byType[entity.type] = (summary.byType[entity.type] || 0) + 1;
      
      // Count by object type
      if (entity.objectType) {
        summary.byObjectType[entity.objectType] = (summary.byObjectType[entity.objectType] || 0) + 1;
      }
    });

    return summary;
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async getDeploymentStatus(deploymentId) {
    const deployment = await Deployment.findByPk(deploymentId, {
      include: [
        {
          model: DeploymentLog,
          as: 'logs',
          order: [['createdAt', 'ASC']]
        },
        {
          model: Template,
          as: 'template',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!deployment) {
      return null;
    }

    return {
      ...deployment.toJSON(),
      isActive: this.activeDeployments.has(deploymentId)
    };
  }

  async listDeployments(filters = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      clientName,
      templateId,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = filters;

    const where = {};
    if (status) where.status = status;
    if (clientName) where.clientName = { [require('sequelize').Op.iLike]: `%${clientName}%` };
    if (templateId) where.templateId = templateId;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    return await Deployment.findAndCountAll({
      where,
      include: [
        {
          model: Template,
          as: 'template',
          attributes: ['id', 'name']
        }
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset
    });
  }
}

module.exports = new DeploymentEngine();