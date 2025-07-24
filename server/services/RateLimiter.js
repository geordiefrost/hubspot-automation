const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('redis');
const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    this.redisClient = null;
    this.rateLimiter = null;
    this.queue = [];
    this.processing = false;
    this.init();
  }

  async init() {
    try {
      // Initialize Redis client if available
      if (process.env.REDIS_URL) {
        this.redisClient = Redis.createClient({
          url: process.env.REDIS_URL
        });
        
        await this.redisClient.connect();
        
        this.rateLimiter = new RateLimiterRedis({
          storeClient: this.redisClient,
          keyPrefix: 'hubspot_rate_limit',
          points: 10, // 10 requests
          duration: 1, // per 1 second
          blockDuration: 1, // block for 1 second if limit exceeded
        });
        
        logger.info('Rate limiter initialized with Redis');
      } else {
        logger.warn('Redis not available, using in-memory rate limiting');
      }
    } catch (error) {
      logger.error('Failed to initialize rate limiter:', error);
      // Fallback to in-memory rate limiting
      this.redisClient = null;
      this.rateLimiter = null;
    }
  }

  async addRequest(requestFunction, apiKey) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: requestFunction,
        apiKey,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Process up to 10 requests per second
      const batchSize = Math.min(10, this.queue.length);
      const batch = this.queue.splice(0, batchSize);

      // Group by API key for separate rate limiting
      const requestsByKey = batch.reduce((acc, request) => {
        if (!acc[request.apiKey]) {
          acc[request.apiKey] = [];
        }
        acc[request.apiKey].push(request);
        return acc;
      }, {});

      // Process each API key's requests
      const promises = Object.entries(requestsByKey).map(([apiKey, requests]) =>
        this.processApiKeyRequests(apiKey, requests)
      );

      await Promise.all(promises);

    } catch (error) {
      logger.error('Error processing rate limit queue:', error);
    } finally {
      this.processing = false;
      
      // Continue processing if there are more items in the queue
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  async processApiKeyRequests(apiKey, requests) {
    for (const request of requests) {
      try {
        if (this.rateLimiter) {
          // Use Redis-based rate limiting
          await this.rateLimiter.consume(apiKey);
        } else {
          // Simple in-memory rate limiting fallback
          await this.simpleRateLimit();
        }

        const result = await request.fn();
        request.resolve(result);
        
      } catch (rateLimitError) {
        if (rateLimitError.remainingPoints !== undefined) {
          // Rate limit exceeded, retry after delay
          const delay = rateLimitError.msBeforeNext || 1000;
          logger.warn(`Rate limit exceeded for API key, retrying in ${delay}ms`);
          
          setTimeout(async () => {
            try {
              const result = await request.fn();
              request.resolve(result);
            } catch (retryError) {
              request.reject(retryError);
            }
          }, delay);
        } else {
          // Other error during request execution
          request.reject(rateLimitError);
        }
      }
    }
  }

  async simpleRateLimit() {
    // Simple delay-based rate limiting (10 requests per second)
    return new Promise(resolve => {
      setTimeout(resolve, 100);
    });
  }

  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  getQueueLength() {
    return this.queue.length;
  }

  getQueueStats() {
    const now = Date.now();
    const oldRequests = this.queue.filter(req => now - req.timestamp > 30000).length;
    
    return {
      totalInQueue: this.queue.length,
      oldRequests,
      processing: this.processing
    };
  }
}

module.exports = new RateLimiter();