#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up HubSpot Automation Platform...\n');

// Generate secure keys
const jwtSecret = crypto.randomBytes(32).toString('hex');
const encryptionKey = crypto.randomBytes(16).toString('ascii').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
const internalApiKey = 'hub_' + crypto.randomBytes(24).toString('hex');

// Environment configuration
const envConfig = `# Environment Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hubspot_automation
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hubspot_automation
DB_USER=username
DB_PASS=password

# Security Configuration
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=${encryptionKey}
INTERNAL_API_KEY=${internalApiKey}

# HubSpot OAuth (Optional)
HUBSPOT_APP_ID=your-hubspot-app-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Logging Configuration
LOG_LEVEL=info

# Frontend Configuration
CLIENT_URL=http://localhost:3000

# Email Configuration (Optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
FROM_EMAIL=noreply@your-domain.com

# Admin Configuration
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=change-this-password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10mb
UPLOAD_PATH=./uploads
`;

// Write .env file
const envPath = path.join(__dirname, '..', '.env');
fs.writeFileSync(envPath, envConfig);

console.log('✅ Environment file created at .env');
console.log('🔐 Generated secure keys:');
console.log(`   JWT Secret: ${jwtSecret.substring(0, 16)}...`);
console.log(`   Encryption Key: ${encryptionKey.substring(0, 16)}...`);
console.log(`   Internal API Key: ${internalApiKey.substring(0, 16)}...`);

// Create additional configuration files
const gitignoreContent = `# See README.md for complete .gitignore content
.env
logs/
uploads/
node_modules/
coverage/
*.log
.DS_Store
`;

fs.writeFileSync(path.join(__dirname, '..', '.gitignore'), gitignoreContent);

// Create Docker configuration
const dockerfileContent = `FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production
RUN cd client && npm ci --only=production

# Copy application code
COPY . .

# Build frontend
RUN cd client && npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create directories and set permissions
RUN mkdir -p logs uploads
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

CMD ["npm", "start"]
`;

fs.writeFileSync(path.join(__dirname, '..', 'Dockerfile'), dockerfileContent);

// Create Docker Compose file
const dockerComposeContent = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/hubspot_automation
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=hubspot_automation
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
`;

fs.writeFileSync(path.join(__dirname, '..', 'docker-compose.yml'), dockerComposeContent);

// Create database setup script
const dbSetupContent = `#!/bin/bash

# Database setup script
echo "🗄️  Setting up database..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

# Create database
echo "Creating database..."
createdb hubspot_automation 2>/dev/null || echo "Database already exists"

# Run migrations
echo "Running migrations..."
npm run migrate

# Run seeders
echo "Running seeders..."
npm run seed

echo "✅ Database setup complete!"
`;

fs.writeFileSync(path.join(__dirname, 'setup-db.sh'), dbSetupContent);
fs.chmodSync(path.join(__dirname, 'setup-db.sh'), '755');

// Create deployment script
const deployContent = `#!/bin/bash

# Production deployment script
echo "🚀 Deploying HubSpot Automation Platform..."

# Build frontend
echo "Building frontend..."
cd client && npm run build && cd ..

# Run database migrations
echo "Running database migrations..."
npm run migrate

# Start with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js --env production

echo "✅ Deployment complete!"
echo "📊 Monitor with: pm2 monit"
echo "📋 View logs with: pm2 logs"
`;

fs.writeFileSync(path.join(__dirname, 'deploy.sh'), deployContent);
fs.chmodSync(path.join(__dirname, 'deploy.sh'), '755');

// Create PM2 ecosystem file
const pm2Config = `module.exports = {
  apps: [{
    name: 'hubspot-automation',
    script: 'server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'ecosystem.config.js'), pm2Config);

console.log('\n📁 Additional files created:');
console.log('   - Dockerfile (container configuration)');
console.log('   - docker-compose.yml (multi-service setup)');
console.log('   - ecosystem.config.js (PM2 configuration)');
console.log('   - scripts/setup-db.sh (database setup)');
console.log('   - scripts/deploy.sh (production deployment)');

console.log('\n🔧 Next steps:');
console.log('1. Install dependencies: npm install');
console.log('2. Setup database: ./scripts/setup-db.sh');
console.log('3. Update .env with your specific configuration');
console.log('4. Start development: npm run dev');

console.log('\n📚 For production deployment:');
console.log('1. Configure production environment variables in .env');
console.log('2. Run: ./scripts/deploy.sh');
console.log('3. Or use Docker: docker-compose up -d');

console.log('\n✨ Setup complete! Happy coding! 🎉');