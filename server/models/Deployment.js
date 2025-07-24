module.exports = (sequelize, DataTypes) => {
  const Deployment = sequelize.define('Deployment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    clientName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'templates',
        key: 'id'
      }
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'in_progress',
        'completed',
        'failed',
        'rolled_back'
      ),
      defaultValue: 'pending'
    },
    apiKeyHash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    createdEntities: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Track created entities for rollback'
    },
    errorDetails: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    deploymentProgress: {
      type: DataTypes.JSONB,
      defaultValue: {
        totalSteps: 0,
        completedSteps: 0,
        currentStep: null
      }
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    executionTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Execution time in milliseconds'
    }
  }, {
    tableName: 'deployments',
    timestamps: true,
    indexes: [
      {
        fields: ['clientName']
      },
      {
        fields: ['status']
      },
      {
        fields: ['templateId']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  Deployment.associate = function(models) {
    Deployment.belongsTo(models.Template, {
      foreignKey: 'templateId',
      as: 'template'
    });
    
    Deployment.hasMany(models.DeploymentLog, {
      foreignKey: 'deploymentId',
      as: 'logs'
    });
  };

  return Deployment;
};