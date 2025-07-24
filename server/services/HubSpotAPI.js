const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const rateLimiter = require('./RateLimiter');

class HubSpotAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiKeyHash = this.hashApiKey(apiKey);
    this.baseURL = 'https://api.hubapi.com';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        const hubspotError = new Error(error.message);
        hubspotError.isHubSpotError = true;
        hubspotError.status = error.response?.status;
        hubspotError.response = error.response;
        
        if (error.response?.status === 429) {
          hubspotError.rateLimited = true;
          hubspotError.retryAfter = error.response.headers['retry-after'] || 1;
        }
        
        throw hubspotError;
      }
    );
  }

  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  async request(method, endpoint, data = null, options = {}) {
    const requestFunction = async () => {
      const config = {
        method,
        url: endpoint,
        ...options
      };

      if (data) {
        config.data = data;
      }

      logger.debug(`HubSpot API ${method} ${endpoint}`, { 
        apiKeyHash: this.apiKeyHash,
        dataSize: data ? JSON.stringify(data).length : 0 
      });

      const response = await this.client(config);
      
      logger.debug(`HubSpot API ${method} ${endpoint} - Success`, {
        status: response.status,
        responseSize: JSON.stringify(response.data).length
      });

      return response.data;
    };

    return rateLimiter.addRequest(requestFunction, this.apiKeyHash);
  }

  // Property Groups
  async createPropertyGroup(objectType, groupData) {
    return this.request('POST', `/crm/v3/properties/${objectType}/groups`, groupData);
  }

  async getPropertyGroups(objectType) {
    return this.request('GET', `/crm/v3/properties/${objectType}/groups`);
  }

  async updatePropertyGroup(objectType, groupName, groupData) {
    return this.request('PATCH', `/crm/v3/properties/${objectType}/groups/${groupName}`, groupData);
  }

  async deletePropertyGroup(objectType, groupName) {
    return this.request('DELETE', `/crm/v3/properties/${objectType}/groups/${groupName}`);
  }

  // Properties
  async createProperty(objectType, propertyData) {
    return this.request('POST', `/crm/v3/properties/${objectType}`, propertyData);
  }

  async createPropertiesBatch(objectType, properties) {
    const chunks = this.chunkArray(properties, 100); // HubSpot limit
    const results = [];

    for (const chunk of chunks) {
      const batchResult = await this.request('POST', `/crm/v3/properties/${objectType}/batch/create`, {
        inputs: chunk
      });
      results.push(...batchResult.results);
    }

    return { results };
  }

  async getProperties(objectType) {
    return this.request('GET', `/crm/v3/properties/${objectType}`);
  }

  async getProperty(objectType, propertyName) {
    return this.request('GET', `/crm/v3/properties/${objectType}/${propertyName}`);
  }

  async updateProperty(objectType, propertyName, propertyData) {
    return this.request('PATCH', `/crm/v3/properties/${objectType}/${propertyName}`, propertyData);
  }

  async deleteProperty(objectType, propertyName) {
    return this.request('DELETE', `/crm/v3/properties/${objectType}/${propertyName}`);
  }

  // Pipelines
  async createPipeline(objectType, pipelineData) {
    return this.request('POST', `/crm/v3/pipelines/${objectType}`, pipelineData);
  }

  async getPipelines(objectType) {
    return this.request('GET', `/crm/v3/pipelines/${objectType}`);
  }

  async getPipeline(objectType, pipelineId) {
    return this.request('GET', `/crm/v3/pipelines/${objectType}/${pipelineId}`);
  }

  async updatePipeline(objectType, pipelineId, pipelineData) {
    return this.request('PATCH', `/crm/v3/pipelines/${objectType}/${pipelineId}`, pipelineData);
  }

  async deletePipeline(objectType, pipelineId) {
    return this.request('DELETE', `/crm/v3/pipelines/${objectType}/${pipelineId}`);
  }

  // Pipeline Stages
  async createPipelineStage(objectType, pipelineId, stageData) {
    return this.request('POST', `/crm/v3/pipelines/${objectType}/${pipelineId}/stages`, stageData);
  }

  async updatePipelineStage(objectType, pipelineId, stageId, stageData) {
    return this.request('PATCH', `/crm/v3/pipelines/${objectType}/${pipelineId}/stages/${stageId}`, stageData);
  }

  async deletePipelineStage(objectType, pipelineId, stageId) {
    return this.request('DELETE', `/crm/v3/pipelines/${objectType}/${pipelineId}/stages/${stageId}`);
  }

  // Settings
  async getAccountInfo() {
    return this.request('GET', '/integrations/v1/me');
  }

  async testConnection() {
    try {
      const accountInfo = await this.getAccountInfo();
      return {
        success: true,
        accountInfo: {
          portalId: accountInfo.portalId,
          timeZone: accountInfo.timeZone,
          currency: accountInfo.currency,
          domain: accountInfo.domain
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.status
      };
    }
  }

  // Lifecycle Stages (Contact properties)
  async updateLifecycleStages(stages) {
    // Get the lifecycle stage property
    const lifecycleProperty = await this.getProperty('contact', 'lifecyclestage');
    
    // Update the options
    const updatedProperty = {
      ...lifecycleProperty,
      options: stages.map(stage => ({
        label: stage.label,
        value: stage.name,
        displayOrder: stage.displayOrder,
        hidden: false
      }))
    };

    return this.updateProperty('contact', 'lifecyclestage', updatedProperty);
  }

  // Utility methods
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Validation helpers
  async validatePropertyName(objectType, propertyName) {
    try {
      await this.getProperty(objectType, propertyName);
      return { exists: true };
    } catch (error) {
      if (error.status === 404) {
        return { exists: false };
      }
      throw error;
    }
  }

  async validatePipelineName(objectType, pipelineName) {
    const pipelines = await this.getPipelines(objectType);
    const exists = pipelines.results.some(p => p.label === pipelineName);
    return { exists };
  }

  // Bulk operations with progress tracking
  async bulkCreateProperties(objectType, properties, progressCallback) {
    const chunks = this.chunkArray(properties, 10); // Smaller chunks for better progress tracking
    const results = [];
    let completed = 0;

    for (const chunk of chunks) {
      const chunkResults = [];
      
      for (const property of chunk) {
        try {
          const result = await this.createProperty(objectType, property);
          chunkResults.push({ success: true, property: property.name, result });
          completed++;
        } catch (error) {
          chunkResults.push({ 
            success: false, 
            property: property.name, 
            error: error.message 
          });
          completed++;
        }

        if (progressCallback) {
          progressCallback({
            completed,
            total: properties.length,
            percentage: Math.round((completed / properties.length) * 100)
          });
        }
      }
      
      results.push(...chunkResults);
    }

    return {
      results,
      summary: {
        total: properties.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  }

  async bulkCreatePipelines(objectType, pipelines, progressCallback) {
    const results = [];
    let completed = 0;

    for (const pipeline of pipelines) {
      try {
        const result = await this.createPipeline(objectType, pipeline);
        results.push({ success: true, pipeline: pipeline.label, result });
      } catch (error) {
        results.push({ 
          success: false, 
          pipeline: pipeline.label, 
          error: error.message 
        });
      }

      completed++;
      if (progressCallback) {
        progressCallback({
          completed,
          total: pipelines.length,
          percentage: Math.round((completed / pipelines.length) * 100)
        });
      }
    }

    return {
      results,
      summary: {
        total: pipelines.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  }
}

module.exports = HubSpotAPI;