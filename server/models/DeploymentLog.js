module.exports = (sequelize, DataTypes) => {
  const DeploymentLog = sequelize.define('DeploymentLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    deploymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'deployments',
        key: 'id'
      }
    },
    step: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('started', 'completed', 'failed', 'skipped'),
      allowNull: false
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    executionTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Step execution time in milliseconds'
    },
    hubspotResponse: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Response from HubSpot API'
    }
  }, {
    tableName: 'deployment_logs',
    timestamps: true,
    indexes: [
      {
        fields: ['deploymentId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['step']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  DeploymentLog.associate = function(models) {
    DeploymentLog.belongsTo(models.Deployment, {
      foreignKey: 'deploymentId',
      as: 'deployment'
    });
  };

  return DeploymentLog;
};