const DeploymentEngine = require('../services/DeploymentEngine');
const logger = require('../utils/logger');

class DeploymentController {
  async deploy(req, res, next) {
    try {
      const { clientName, templateId, config, apiKey } = req.body;

      // Validate required fields
      if (!clientName || !apiKey) {
        return res.status(400).json({
          error: 'Client name and API key are required'
        });
      }

      if (!templateId && !config) {
        return res.status(400).json({
          error: 'Either template ID or configuration is required'
        });
      }

      logger.info('Starting deployment', {
        clientName,
        templateId,
        hasConfig: !!config,
        userId: req.user?.id
      });

      // Set up Server-Sent Events for real-time progress
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const sendProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const deploymentData = {
          clientName,
          templateId: templateId || null,
          config,
          apiKey
        };

        const result = await DeploymentEngine.deployConfiguration(
          deploymentData,
          sendProgress
        );

        // Send final success message
        sendProgress({
          type: 'completed',
          success: true,
          deploymentId: result.deploymentId,
          summary: result.summary,
          message: 'Deployment completed successfully'
        });

        res.end();

      } catch (error) {
        logger.error('Deployment failed', {
          clientName,
          error: error.message
        });

        sendProgress({
          type: 'error',
          success: false,
          error: error.message,
          message: 'Deployment failed'
        });

        res.end();
      }

    } catch (error) {
      next(error);
    }
  }

  async getStatus(req, res, next) {
    try {
      const { id } = req.params;

      const deployment = await DeploymentEngine.getDeploymentStatus(id);

      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      res.json(deployment);

    } catch (error) {
      next(error);
    }
  }

  async rollback(req, res, next) {
    try {
      const { id } = req.params;
      const { apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required for rollback' });
      }

      logger.info('Starting deployment rollback', {
        deploymentId: id,
        userId: req.user?.id
      });

      const result = await DeploymentEngine.rollbackDeployment(id, apiKey);

      logger.info('Deployment rollback completed', {
        deploymentId: id,
        rolledBackCount: result.rolledBackCount
      });

      res.json({
        success: true,
        message: 'Deployment rolled back successfully',
        ...result
      });

    } catch (error) {
      logger.error('Deployment rollback failed', {
        deploymentId: req.params.id,
        error: error.message
      });
      
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const filters = {
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        status: req.query.status,
        clientName: req.query.clientName,
        templateId: req.query.templateId,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'DESC'
      };

      const { rows: deployments, count } = await DeploymentEngine.listDeployments(filters);

      res.json({
        deployments,
        pagination: {
          page: parseInt(filters.page),
          limit: parseInt(filters.limit),
          total: count,
          pages: Math.ceil(count / parseInt(filters.limit))
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { Deployment } = require('../models');
      const sequelize = require('sequelize');

      // Get deployment statistics
      const stats = await Deployment.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', '*'), 'count'],
          [sequelize.fn('AVG', sequelize.col('executionTime')), 'avgExecutionTime']
        ],
        group: ['status'],
        raw: true
      });

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat.status] = {
          count: parseInt(stat.count),
          avgExecutionTime: stat.avgExecutionTime ? Math.round(stat.avgExecutionTime) : null
        };
        return acc;
      }, {});

      // Get recent deployments
      const recentDeployments = await Deployment.findAll({
        include: [
          {
            association: 'template',
            attributes: ['id', 'name']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: [
          'id', 'clientName', 'status', 'createdAt', 
          'executionTime', 'templateId'
        ]
      });

      // Calculate success rate
      const totalDeployments = Object.values(statusCounts).reduce((sum, stat) => sum + stat.count, 0);
      const successfulDeployments = statusCounts.completed?.count || 0;
      const successRate = totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;

      res.json({
        statusCounts,
        totalDeployments,
        successRate: Math.round(successRate * 100) / 100,
        recentDeployments: recentDeployments.map(d => d.toJSON())
      });

    } catch (error) {
      next(error);
    }
  }

  async retry(req, res, next) {
    try {
      const { id } = req.params;
      const { apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required for retry' });
      }

      // Get original deployment
      const originalDeployment = await DeploymentEngine.getDeploymentStatus(id);
      if (!originalDeployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      if (originalDeployment.status !== 'failed') {
        return res.status(400).json({ 
          error: 'Only failed deployments can be retried' 
        });
      }

      logger.info('Retrying deployment', {
        originalDeploymentId: id,
        clientName: originalDeployment.clientName
      });

      // Create new deployment with same configuration
      const deploymentData = {
        clientName: `${originalDeployment.clientName} (Retry)`,
        templateId: originalDeployment.templateId,
        config: originalDeployment.config,
        apiKey
      };

      // Set up Server-Sent Events for real-time progress
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const sendProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await DeploymentEngine.deployConfiguration(
          deploymentData,
          sendProgress
        );

        sendProgress({
          type: 'completed',
          success: true,
          deploymentId: result.deploymentId,
          originalDeploymentId: id,
          summary: result.summary,
          message: 'Retry deployment completed successfully'
        });

        res.end();

      } catch (error) {
        sendProgress({
          type: 'error',
          success: false,
          error: error.message,
          originalDeploymentId: id,
          message: 'Retry deployment failed'
        });

        res.end();
      }

    } catch (error) {
      next(error);
    }
  }

  async validate(req, res, next) {
    try {
      const { config, apiKey } = req.body;

      if (!config || !apiKey) {
        return res.status(400).json({
          error: 'Configuration and API key are required'
        });
      }

      // Use validation controller to validate the configuration
      const validationController = require('./validationController');
      
      // Create a mock request object for validation
      const mockReq = {
        body: { apiKey, configuration: config }
      };

      const mockRes = {
        json: (data) => res.json(data)
      };

      await validationController.validateConfiguration(mockReq, mockRes, next);

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DeploymentController();