module.exports = (sequelize, DataTypes) => {
  const MappingHistory = sequelize.define('MappingHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sourceField: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    hubspotName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    hubspotType: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    fieldType: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    objectType: {
      type: DataTypes.ENUM('contact', 'company', 'deal', 'ticket'),
      allowNull: false
    },
    groupName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    options: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Enumeration options or other field-specific config'
    },
    usageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    lastUsed: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    }
  }, {
    tableName: 'mapping_history',
    timestamps: true,
    indexes: [
      {
        fields: ['sourceField']
      },
      {
        fields: ['hubspotName']
      },
      {
        fields: ['objectType']
      },
      {
        fields: ['usageCount']
      },
      {
        fields: ['lastUsed']
      },
      {
        unique: true,
        fields: ['sourceField', 'hubspotName', 'objectType']
      }
    ]
  });

  // Class methods for intelligent suggestions
  MappingHistory.getSuggestions = async function(sourceField, objectType, limit = 5) {
    return this.findAll({
      where: {
        sourceField: {
          [sequelize.Sequelize.Op.iLike]: `%${sourceField}%`
        },
        objectType
      },
      order: [
        ['usageCount', 'DESC'],
        ['confidence', 'DESC'],
        ['lastUsed', 'DESC']
      ],
      limit
    });
  };

  MappingHistory.recordUsage = async function(sourceField, hubspotName, objectType, mappingData) {
    const [mapping, created] = await this.findOrCreate({
      where: { sourceField, hubspotName, objectType },
      defaults: {
        ...mappingData,
        usageCount: 1,
        lastUsed: new Date()
      }
    });

    if (!created) {
      await mapping.increment('usageCount');
      await mapping.update({ lastUsed: new Date() });
    }

    return mapping;
  };

  return MappingHistory;
};