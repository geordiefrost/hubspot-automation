-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    "isActive" BOOLEAN DEFAULT true,
    "lastLogin" TIMESTAMP,
    "loginCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Templates table
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    config JSONB NOT NULL DEFAULT '{"properties":{"contacts":[],"companies":[],"deals":[],"tickets":[]},"pipelines":{"deals":[],"tickets":[]},"lifecycleStages":{"stages":[]}}',
    "isActive" BOOLEAN DEFAULT true,
    "usageCount" INTEGER DEFAULT 0,
    "createdBy" VARCHAR(100),
    "lastUsed" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Deployments table
CREATE TYPE deployment_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'rolled_back');

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "clientName" VARCHAR(255) NOT NULL,
    "templateId" UUID REFERENCES templates(id) ON DELETE SET NULL,
    config JSONB NOT NULL,
    status deployment_status DEFAULT 'pending',
    "apiKeyHash" VARCHAR(255) NOT NULL,
    "createdEntities" JSONB DEFAULT '[]',
    "errorDetails" JSONB,
    "deploymentProgress" JSONB DEFAULT '{"totalSteps":0,"completedSteps":0,"currentStep":null}',
    "startedAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    "executionTime" INTEGER,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Deployment logs table
CREATE TYPE log_status AS ENUM ('started', 'completed', 'failed', 'skipped');

CREATE TABLE deployment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "deploymentId" UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    step VARCHAR(255) NOT NULL,
    status log_status NOT NULL,
    details JSONB,
    "errorMessage" TEXT,
    "executionTime" INTEGER,
    "hubspotResponse" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Mapping history table
CREATE TYPE object_type AS ENUM ('contact', 'company', 'deal', 'ticket');

CREATE TABLE mapping_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sourceField" VARCHAR(255) NOT NULL,
    "hubspotName" VARCHAR(255) NOT NULL,
    "hubspotType" VARCHAR(50) NOT NULL,
    "fieldType" VARCHAR(50) NOT NULL,
    "objectType" object_type NOT NULL,
    "groupName" VARCHAR(100),
    options JSONB,
    "usageCount" INTEGER DEFAULT 1,
    "lastUsed" TIMESTAMP DEFAULT NOW(),
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("sourceField", "hubspotName", "objectType")
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_isActive ON users("isActive");

CREATE INDEX idx_templates_name ON templates(name);
CREATE INDEX idx_templates_industry ON templates(industry);
CREATE INDEX idx_templates_isActive ON templates("isActive");
CREATE INDEX idx_templates_usageCount ON templates("usageCount");

CREATE INDEX idx_deployments_clientName ON deployments("clientName");
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_templateId ON deployments("templateId");
CREATE INDEX idx_deployments_createdAt ON deployments("createdAt");

CREATE INDEX idx_deployment_logs_deploymentId ON deployment_logs("deploymentId");
CREATE INDEX idx_deployment_logs_status ON deployment_logs(status);
CREATE INDEX idx_deployment_logs_step ON deployment_logs(step);
CREATE INDEX idx_deployment_logs_createdAt ON deployment_logs("createdAt");

CREATE INDEX idx_mapping_history_sourceField ON mapping_history("sourceField");
CREATE INDEX idx_mapping_history_hubspotName ON mapping_history("hubspotName");
CREATE INDEX idx_mapping_history_objectType ON mapping_history("objectType");
CREATE INDEX idx_mapping_history_usageCount ON mapping_history("usageCount");
CREATE INDEX idx_mapping_history_lastUsed ON mapping_history("lastUsed");

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON deployments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deployment_logs_updated_at BEFORE UPDATE ON deployment_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mapping_history_updated_at BEFORE UPDATE ON mapping_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();