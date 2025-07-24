# HubSpot Setup Automation Platform

A comprehensive web application that automates HubSpot account setup via API, allowing Bang Digital to configure client accounts in minutes instead of hours.

## 🚀 Features

### Core Functionality
- **Template System**: Pre-configured setups for different industries (B2B SaaS, E-commerce, Professional Services)
- **Property Management**: Bulk creation of custom properties with intelligent field detection
- **Pipeline Configuration**: Visual pipeline builder with drag-drop stages
- **Deployment Engine**: Sequential deployment with real-time progress tracking and rollback capability
- **Property Mapping Tool**: Intelligent field analysis with CSV/Excel import support

### Advanced Features
- **Rate Limiting**: Smart API request queuing to respect HubSpot's limits (10 requests/second)
- **Error Handling**: Comprehensive validation and rollback on failures
- **Progress Tracking**: Real-time deployment monitoring with Server-Sent Events
- **Audit Logging**: Complete deployment history and entity tracking
- **Template Management**: Import/export, duplication, and versioning

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Models**: Sequelize ORM with PostgreSQL
- **Services**: HubSpot API wrapper, Rate Limiter, Property Mapper, Deployment Engine
- **Controllers**: RESTful API endpoints for templates, deployments, imports, validation
- **Middleware**: Error handling, logging, authentication

### Frontend (React)
- **State Management**: React Context with reducer pattern
- **Data Fetching**: React Query for caching and synchronization
- **UI Components**: Tailwind CSS with Headless UI
- **Real-time Updates**: Server-Sent Events for deployment progress
- **Drag & Drop**: React DND for pipeline stage management

### Database Schema
- **Templates**: Store reusable configuration templates
- **Deployments**: Track deployment status and progress
- **Deployment Logs**: Detailed step-by-step execution logs
- **Mapping History**: Learn from previous field mappings
- **Users**: Authentication and access control

## 📋 Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+
- Redis (optional, for distributed rate limiting)
- HubSpot Developer Account with Private App access

## 🛠️ Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd hubspot-automation
```

### 2. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

### 3. Environment Configuration
Create `.env` file in the root directory:
```bash
cp .env.example .env
```

Configure the following variables:
```env
# Environment
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/hubspot_automation

# Security
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Frontend URL
CLIENT_URL=http://localhost:3000
```

### 4. Database Setup
```bash
# Create database
createdb hubspot_automation

# Run migrations
npm run migrate

# Seed with default templates (optional)
npm run seed
```

### 5. Start Development Servers
```bash
# Start both backend and frontend
npm run dev

# Or start separately:
npm run server:dev  # Backend on :5000
npm run client:dev  # Frontend on :3000
```

## 🔑 HubSpot API Configuration

### 1. Create Private App
1. Go to your HubSpot account settings
2. Navigate to **Integrations → Private Apps**
3. Create a new private app
4. Configure required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.schemas.contacts.read`
   - `crm.schemas.contacts.write`
   - `crm.schemas.companies.read`
   - `crm.schemas.companies.write`
   - `crm.schemas.deals.read`
   - `crm.schemas.deals.write`
   - `settings.users.read`

### 2. Configure API Key
1. Copy the access token from your private app
2. In the web interface, click the API key status in the sidebar
3. Paste your token and validate

## 📚 Usage Guide

### Creating Templates

1. **Navigate to Templates**: Go to `/templates` and click "New Template"
2. **Basic Information**: Set name, description, and industry
3. **Configure Properties**: 
   - Add custom properties for contacts, companies, deals
   - Set field types, validation rules, and groupings
   - Use the bulk property editor for efficiency
4. **Setup Pipelines**:
   - Create custom sales/service pipelines
   - Define stages with probabilities
   - Configure stage-specific properties
5. **Lifecycle Stages**: Customize contact lifecycle stages
6. **Save & Test**: Save template and run validation

### Importing Data for Analysis

1. **Prepare Data**: CSV file or Excel data with headers
2. **Navigate to Import**: Go to `/import`
3. **Upload/Paste Data**: Use CSV upload or paste Excel data
4. **Field Analysis**: Review intelligent field mapping suggestions
5. **Mapping Review**: Adjust property types and names as needed
6. **Preview Configuration**: See exactly what will be created
7. **Save as Template**: Optionally save the configuration for reuse

### Deploying to HubSpot

1. **Select Configuration**: Choose template or use imported configuration
2. **Enter Details**: Client name and HubSpot API key
3. **Validation**: System validates API key and configuration
4. **Deploy**: Monitor real-time progress via dashboard
5. **Review Results**: Check deployment logs and created entities
6. **Rollback if Needed**: Use rollback feature if issues occur

### Property Mapping Intelligence

The system automatically analyzes field names and sample data to suggest:
- **Field Types**: Date, email, phone, number, boolean, enumeration, text
- **Property Names**: HubSpot-compatible naming (lowercase, underscores)
- **Groupings**: Logical organization of related properties
- **Validation**: Email format, phone format, required fields
- **Options**: For dropdown/select fields, extracted from sample data

## 🔧 API Endpoints

### Templates
- `GET /api/templates` - List templates with filtering
- `POST /api/templates` - Create new template
- `GET /api/templates/:id` - Get template by ID
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/duplicate` - Duplicate template
- `GET /api/templates/:id/export` - Export template as JSON

### Deployments
- `GET /api/deployments` - List deployments with filtering
- `POST /api/deployments` - Start deployment (returns SSE stream)
- `GET /api/deployments/:id` - Get deployment status
- `POST /api/deployments/:id/rollback` - Rollback deployment
- `POST /api/deployments/:id/retry` - Retry failed deployment

### Import & Analysis
- `POST /api/import/csv` - Parse CSV data
- `POST /api/import/analyse` - Analyze fields and suggest mappings
- `POST /api/import/validate-mappings` - Validate property mappings
- `POST /api/import/preview` - Preview HubSpot configuration

### Validation
- `POST /api/validate/api-key` - Test HubSpot API key
- `POST /api/validate/property-name` - Check property name availability
- `POST /api/validate/configuration` - Validate complete configuration

## 🚀 Deployment

### Production Build
```bash
# Build frontend
npm run build

# Start production server
npm start
```

### Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...
ENCRYPTION_KEY=...
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN cd client && npm ci && npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## 📊 Monitoring & Observability

### Logging
- Structured JSON logging with Winston
- Request/response logging
- Error tracking with stack traces
- Deployment audit logs

### Metrics
- Deployment success rates
- API response times
- Error rates by endpoint
- Template usage statistics

### Health Checks
- `GET /health` - Application health status
- Database connectivity checks
- HubSpot API connectivity verification

## 🔒 Security

### API Key Management
- API keys encrypted at rest using AES-256
- Keys stored as hashed values in database
- Automatic key validation before deployment

### Input Validation
- Joi schema validation for all inputs
- SQL injection prevention via Sequelize ORM
- XSS protection with sanitized inputs
- Rate limiting on all endpoints

### Access Control
- JWT-based authentication (when enabled)
- Role-based permissions (admin/user)
- Audit logging for all actions

## 🧪 Testing

### Backend Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Frontend Tests
```bash
cd client
npm test                   # Run React tests
npm run test:coverage      # Coverage report
```

### Integration Tests
```bash
npm run test:integration   # Full API tests
```

## 📈 Performance Optimization

### Rate Limiting
- 10 requests/second to HubSpot API
- Intelligent request queuing
- Retry logic for rate limit errors
- Redis-based distributed limiting

### Database
- Indexed queries for performance
- Connection pooling
- Query optimization with Sequelize

### Frontend
- Code splitting with React.lazy
- Memoization for expensive computations
- Virtualized lists for large datasets
- Optimistic updates with React Query

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Email: support@bangdigital.com
- Documentation: [Wiki](wiki-url)

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core template system
- ✅ Property mapping engine
- ✅ Deployment automation
- ✅ Basic UI interface

### Phase 2
- [ ] Advanced pipeline builder
- [ ] Workflow automation
- [ ] Custom object support
- [ ] Team collaboration features

### Phase 3
- [ ] Multi-portal management
- [ ] Advanced analytics
- [ ] Webhook integrations
- [ ] API marketplace

---

**Built with ❤️ by Bang Digital**