const { Template } = require('../models');
const logger = require('../utils/logger');
const { ValidationError } = require('sequelize');

class TemplateController {
  async create(req, res, next) {
    try {
      const templateData = req.body;
      
      // Validate required fields
      if (!templateData.name || !templateData.config) {
        return res.status(400).json({
          error: 'Template name and config are required'
        });
      }

      // Validate config structure
      const configValidation = this.validateTemplateConfig(templateData.config);
      if (!configValidation.isValid) {
        return res.status(400).json({
          error: 'Invalid template configuration',
          details: configValidation.errors
        });
      }

      const template = await Template.create({
        ...templateData,
        createdBy: req.user?.email || 'system'
      });

      logger.info('Template created successfully', {
        templateId: template.id,
        name: template.name,
        createdBy: template.createdBy
      });

      res.status(201).json(template);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => e.message)
        });
      }
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        industry,
        isActive = true,
        sortBy = 'usageCount',
        sortOrder = 'DESC'
      } = req.query;

      const where = {};
      if (industry) where.industry = industry;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { rows: templates, count } = await Template.findAndCountAll({
        where,
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset,
        attributes: [
          'id', 'name', 'description', 'industry', 
          'isActive', 'usageCount', 'createdBy', 
          'lastUsed', 'createdAt', 'updatedAt'
        ]
      });

      res.json({
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      
      const template = await Template.findByPk(id, {
        include: [
          {
            association: 'deployments',
            attributes: ['id', 'clientName', 'status', 'createdAt'],
            limit: 10,
            order: [['createdAt', 'DESC']]
          }
        ]
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Add usage statistics
      const stats = await this.getTemplateStats(id);
      
      res.json({
        ...template.toJSON(),
        stats
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const template = await Template.findByPk(id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Validate config if provided
      if (updateData.config) {
        const configValidation = this.validateTemplateConfig(updateData.config);
        if (!configValidation.isValid) {
          return res.status(400).json({
            error: 'Invalid template configuration',
            details: configValidation.errors
          });
        }
      }

      await template.update(updateData);

      logger.info('Template updated successfully', {
        templateId: template.id,
        name: template.name,
        updatedBy: req.user?.email || 'system'
      });

      res.json(template);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => e.message)
        });
      }
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const template = await Template.findByPk(id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Check if template has been used in deployments
      const deploymentsCount = await template.countDeployments();
      if (deploymentsCount > 0) {
        // Soft delete - mark as inactive instead of hard delete
        await template.update({ isActive: false });
        
        logger.info('Template soft deleted (has deployments)', {
          templateId: template.id,
          name: template.name,
          deploymentsCount
        });

        return res.json({ 
          message: 'Template deactivated (has deployment history)',
          deactivated: true
        });
      }

      await template.destroy();

      logger.info('Template deleted successfully', {
        templateId: template.id,
        name: template.name,
        deletedBy: req.user?.email || 'system'
      });

      res.json({ message: 'Template deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async duplicate(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'New template name is required' });
      }

      const originalTemplate = await Template.findByPk(id);
      if (!originalTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const duplicatedTemplate = await Template.create({
        name,
        description: `Copy of ${originalTemplate.name}`,
        industry: originalTemplate.industry,
        config: originalTemplate.config,
        createdBy: req.user?.email || 'system'
      });

      logger.info('Template duplicated successfully', {
        originalId: originalTemplate.id,
        duplicatedId: duplicatedTemplate.id,
        name: duplicatedTemplate.name
      });

      res.status(201).json(duplicatedTemplate);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => e.message)
        });
      }
      next(error);
    }
  }

  async getIndustries(req, res, next) {
    try {
      const industries = await Template.findAll({
        attributes: ['industry'],
        where: {
          industry: { [require('sequelize').Op.ne]: null },
          isActive: true
        },
        group: ['industry'],
        raw: true
      });

      const industryList = industries
        .map(t => t.industry)
        .filter(Boolean)
        .sort();

      res.json(industryList);
    } catch (error) {
      next(error);
    }
  }

  async exportTemplate(req, res, next) {
    try {
      const { id } = req.params;
      
      const template = await Template.findByPk(id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const exportData = {
        name: template.name,
        description: template.description,
        industry: template.industry,
        config: template.config,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_template.json"`);
      
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  }

  async importTemplate(req, res, next) {
    try {
      const importData = req.body;

      // Validate import data structure
      if (!importData.name || !importData.config) {
        return res.status(400).json({
          error: 'Invalid import data - name and config are required'
        });
      }

      // Validate config structure
      const configValidation = this.validateTemplateConfig(importData.config);
      if (!configValidation.isValid) {
        return res.status(400).json({
          error: 'Invalid template configuration',
          details: configValidation.errors
        });
      }

      // Check if template with same name exists
      const existingTemplate = await Template.findOne({
        where: { name: importData.name }
      });

      if (existingTemplate) {
        return res.status(409).json({
          error: 'Template with this name already exists',
          suggestion: `Consider renaming to "${importData.name} (Imported)"`
        });
      }

      const template = await Template.create({
        name: importData.name,
        description: importData.description || 'Imported template',
        industry: importData.industry,
        config: importData.config,
        createdBy: req.user?.email || 'system'
      });

      logger.info('Template imported successfully', {
        templateId: template.id,
        name: template.name,
        importedBy: req.user?.email || 'system'
      });

      res.status(201).json(template);
    } catch (error) {
      next(error);
    }
  }

  validateTemplateConfig(config) {
    const errors = [];

    // Check main structure
    if (!config.properties) {
      errors.push('Config must include properties section');
    } else {
      // Validate properties structure
      const requiredObjectTypes = ['contacts', 'companies', 'deals'];
      for (const objectType of requiredObjectTypes) {
        if (!Array.isArray(config.properties[objectType])) {
          errors.push(`Properties.${objectType} must be an array`);
        }
      }

      // Validate individual properties
      for (const [objectType, properties] of Object.entries(config.properties)) {
        if (!Array.isArray(properties)) continue;

        properties.forEach((prop, index) => {
          if (!prop.name) {
            errors.push(`Property at ${objectType}[${index}] missing name`);
          }
          if (!prop.label) {
            errors.push(`Property at ${objectType}[${index}] missing label`);
          }
          if (!prop.type) {
            errors.push(`Property at ${objectType}[${index}] missing type`);
          }
        });
      }
    }

    // Check pipelines structure
    if (config.pipelines) {
      for (const [objectType, pipelines] of Object.entries(config.pipelines)) {
        if (!Array.isArray(pipelines)) {
          errors.push(`Pipelines.${objectType} must be an array`);
          continue;
        }

        pipelines.forEach((pipeline, index) => {
          if (!pipeline.label) {
            errors.push(`Pipeline at ${objectType}[${index}] missing label`);
          }
          if (!Array.isArray(pipeline.stages)) {
            errors.push(`Pipeline at ${objectType}[${index}] missing stages array`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async getTemplateStats(templateId) {
    try {
      const { Deployment } = require('../models');
      
      const stats = await Deployment.findAll({
        where: { templateId },
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', '*'), 'count']
        ],
        group: ['status'],
        raw: true
      });

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat.status] = parseInt(stat.count);
        return acc;
      }, {});

      const totalDeployments = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
      const successRate = totalDeployments > 0 ? 
        ((statusCounts.completed || 0) / totalDeployments) * 100 : 0;

      return {
        totalDeployments,
        statusCounts,
        successRate: Math.round(successRate * 100) / 100
      };
    } catch (error) {
      logger.warn('Failed to get template stats:', error);
      return {
        totalDeployments: 0,
        statusCounts: {},
        successRate: 0
      };
    }
  }
}

module.exports = new TemplateController();