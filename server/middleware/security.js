const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('redis');
const logger = require('../utils/logger');

// Initialize Redis client for distributed rate limiting
let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = Redis.createClient({ url: process.env.REDIS_URL });
  redisClient.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });
}

// General API rate limiter
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(15 * 60 * 1000 / 1000) // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(15 * 60 * 1000 / 1000)
    });
  }
});

// Strict rate limiter for sensitive endpoints
const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for sensitive operations
  message: {
    error: 'Too many attempts, please try again later.',
    retryAfter: Math.ceil(15 * 60 * 1000 / 1000)
  },
  skipSuccessfulRequests: true // Don't count successful requests
});

// Authentication rate limiter
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: Math.ceil(15 * 60 * 1000 / 1000)
  },
  skipSuccessfulRequests: true
});

// Deployment rate limiter (prevent abuse of expensive operations)
const deploymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 deployments per hour
  message: {
    error: 'Too many deployments from this IP, please try again later.',
    retryAfter: Math.ceil(60 * 60 * 1000 / 1000)
  }
});

// Slow down middleware for progressive delays
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes at full speed
  delayMs: 100, // begin adding 100ms of delay per request above 50
  maxDelayMs: 5000, // maximum delay of 5 seconds
  skipFailedRequests: true
});

// Redis-based rate limiter for distributed systems
class DistributedRateLimiter {
  constructor() {
    this.rateLimiters = new Map();
  }

  getRateLimiter(key, options) {
    if (!this.rateLimiters.has(key)) {
      const limiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: `rl_${key}`,
        points: options.points || 100,
        duration: options.duration || 900, // 15 minutes
        blockDuration: options.blockDuration || 900,
        ...options
      });
      this.rateLimiters.set(key, limiter);
    }
    return this.rateLimiters.get(key);
  }

  middleware(key, options = {}) {
    return async (req, res, next) => {
      if (!redisClient) {
        return next(); // Skip if Redis is not available
      }

      try {
        const rateLimiter = this.getRateLimiter(key, options);
        const identifier = req.ip + (req.user?.id ? `_${req.user.id}` : '');
        
        await rateLimiter.consume(identifier);
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        logger.warn('Distributed rate limit exceeded', {
          key,
          ip: req.ip,
          userId: req.user?.id,
          endpoint: req.originalUrl,
          retryAfter: secs
        });

        res.set('Retry-After', String(secs));
        res.status(429).json({
          error: 'Too many requests, please try again later.',
          retryAfter: secs
        });
      }
    };
  }
}

const distributedRateLimit = new DistributedRateLimiter();

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.hubapi.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // Remove potential XSS vectors
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    } else {
      return sanitizeValue(obj);
    }
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.body?.apiKey || req.query?.apiKey;
  
  if (apiKey) {
    // Basic format validation for HubSpot API keys
    if (!/^(pat-|sk-)[a-zA-Z0-9-]+$/.test(apiKey)) {
      logger.warn('Invalid API key format attempted', {
        ip: req.ip,
        endpoint: req.originalUrl,
        keyPrefix: apiKey.substring(0, 4)
      });
      
      return res.status(400).json({
        error: 'Invalid API key format'
      });
    }
  }
  
  next();
};

// Request size limiter
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('content-length'), 10);
    const maxBytes = parseInt(maxSize.replace(/mb$/i, '')) * 1024 * 1024;
    
    if (contentLength && contentLength > maxBytes) {
      logger.warn('Request size limit exceeded', {
        ip: req.ip,
        contentLength,
        maxBytes,
        endpoint: req.originalUrl
      });
      
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize
      });
    }
    
    next();
  };
};

// IP whitelist middleware (for admin endpoints)
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.warn('IP access denied', {
        ip: clientIP,
        endpoint: req.originalUrl,
        allowedIPs
      });
      
      return res.status(403).json({
        error: 'Access denied from this IP address'
      });
    }
    
    next();
  };
};

// Security audit logging
const auditLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log the request
  logger.info('Request received', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('Response sent', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.user?.id,
      success: res.statusCode < 400
    });

    // Log security-relevant events
    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.warn('Security event', {
        type: res.statusCode === 401 ? 'unauthorized' : 'forbidden',
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id
      });
    }

    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  apiRateLimit,
  strictRateLimit,
  authRateLimit,
  deploymentRateLimit,
  speedLimiter,
  distributedRateLimit,
  securityHeaders,
  sanitizeInput,
  validateApiKey,
  requestSizeLimit,
  ipWhitelist,
  auditLogger
};