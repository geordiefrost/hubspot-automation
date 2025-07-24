module.exports = (sequelize, DataTypes) => {
  const Template = sequelize.define('Template', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    industry: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        properties: {
          contacts: [],
          companies: [],
          deals: [],
          tickets: []
        },
        pipelines: {
          deals: [],
          tickets: []
        },
        lifecycleStages: {
          stages: []
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    usageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    lastUsed: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'templates',
    timestamps: true,
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['industry']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['usageCount']
      }
    ]
  });

  Template.associate = function(models) {
    Template.hasMany(models.Deployment, {
      foreignKey: 'templateId',
      as: 'deployments'
    });
  };

  return Template;
};