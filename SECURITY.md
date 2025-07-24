# Security Guide

## Overview

The HubSpot Automation Platform implements comprehensive security measures to protect sensitive data and prevent unauthorized access.

## Security Features

### 1. Authentication & Authorization

#### JWT-Based Authentication
- Secure token-based authentication using JSON Web Tokens
- Access tokens expire in 24 hours (configurable)
- Refresh tokens for seamless user experience
- Token blacklisting support for logout

#### Role-Based Access Control (RBAC)
- **Admin**: Full system access, user management
- **User**: Standard access to templates and deployments

#### Password Security
- Minimum 8 characters with complexity requirements
- bcrypt hashing with salt rounds
- Password change tracking and rate limiting

### 2. API Security

#### Rate Limiting
- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 attempts per 15 minutes per IP
- **Deployments**: 10 deployments per hour per IP
- **Strict endpoints**: 5 requests per 15 minutes per IP

#### Input Validation
- Joi schema validation for all inputs
- SQL injection prevention via Sequelize ORM
- XSS protection with input sanitization
- File upload validation (type, size limits)

#### Request Security
- Request size limits (10MB default)
- CORS configuration for trusted origins
- Security headers via Helmet.js
- Content Security Policy (CSP)

### 3. Data Protection

#### Encryption
- **API Keys**: AES-256-GCM encryption at rest
- **Passwords**: bcrypt with salt
- **Sensitive Data**: Encrypted before database storage

#### Database Security
- Prepared statements prevent SQL injection
- Connection pooling with limits
- Encrypted connections in production

### 4. Infrastructure Security

#### Security Headers
```javascript
{
  "Content-Security-Policy": "default-src 'self'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
}
```

#### HTTPS Enforcement
- HSTS headers in production
- Automatic HTTP to HTTPS redirects
- Secure cookie configuration

#### Environment Security
- Environment variables for sensitive configuration
- No secrets in codebase
- Separate production/development configurations

### 5. Logging & Monitoring

#### Audit Logging
- All authentication events
- Failed access attempts
- Administrative actions
- API key usage
- Data modifications

#### Security Monitoring
- Failed login tracking
- Rate limit violations
- Suspicious IP activity
- Error patterns

## Security Configuration

### Environment Variables

```bash
# Security Settings
JWT_SECRET=your-256-bit-secret
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=your-32-character-key
INTERNAL_API_KEY=your-internal-api-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Security Features
ENABLE_RATE_LIMITING=true
ENABLE_AUDIT_LOGGING=true
ENABLE_SECURITY_HEADERS=true
```

### Database Security

```sql
-- Create restricted user for application
CREATE USER hubspot_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE hubspot_automation TO hubspot_app;
GRANT USAGE ON SCHEMA public TO hubspot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hubspot_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO hubspot_app;
```

### Redis Security

```bash
# Redis configuration for production
requirepass your-secure-redis-password
bind 127.0.0.1
port 6379
timeout 300
```

## Deployment Security

### Production Checklist

- [ ] Generate secure environment variables
- [ ] Configure HTTPS certificates
- [ ] Set up firewall rules
- [ ] Enable audit logging
- [ ] Configure monitoring alerts
- [ ] Set up log rotation
- [ ] Implement backup strategy
- [ ] Test security measures

### Docker Security

```dockerfile
# Use non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Remove unnecessary packages
RUN apk del .gyp

# Set secure file permissions
RUN chmod -R 750 /app
```

### Network Security

```yaml
# docker-compose.yml security
services:
  app:
    networks:
      - internal
    # Don't expose database ports to host
  
  db:
    networks:
      - internal
    # Internal network only
```

## Incident Response

### Security Incident Procedures

1. **Detection**: Monitor logs and alerts
2. **Assessment**: Determine severity and scope
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threat and vulnerabilities
5. **Recovery**: Restore services securely
6. **Lessons Learned**: Document and improve

### Log Analysis

```bash
# Check for suspicious activity
grep "401\|403\|429" logs/combined.log

# Monitor failed logins
grep "Login attempt" logs/combined.log | grep "failed"

# Check rate limit violations
grep "Rate limit exceeded" logs/combined.log
```

## API Key Security

### HubSpot API Keys

- Store encrypted in database
- Never log complete API keys
- Validate format before processing
- Implement key rotation procedures
- Monitor usage patterns

### Key Management

```javascript
// Secure API key handling
const encryptedKey = encryption.encrypt(apiKey);
await db.ApiKey.create({
  userId: user.id,
  keyHash: encryption.hash(apiKey),
  encryptedKey: encryptedKey,
  lastUsed: new Date()
});
```

## Compliance

### Data Protection
- GDPR compliance for EU users
- Data minimization principles
- User consent mechanisms
- Right to deletion implementation

### Audit Requirements
- Comprehensive audit trails
- Data access logging
- Change tracking
- Retention policies

## Security Best Practices

### Development
- Regular security reviews
- Dependency vulnerability scanning
- Secure coding standards
- Input validation everywhere

### Operations
- Regular security updates
- Monitor security advisories
- Automated vulnerability scanning
- Penetration testing

### Monitoring
- Real-time security alerts
- Log aggregation and analysis
- Anomaly detection
- Incident response automation

## Contact

For security issues or questions:
- Email: security@bangdigital.com
- Create confidential GitHub issue
- Security hotline: Available 24/7

## Security Updates

This document is regularly updated. Last revision: 2024-01-XX

For the latest security information, check:
- GitHub Security Advisories
- Project documentation
- Security announcements