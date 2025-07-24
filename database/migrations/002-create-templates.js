'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      industry: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      config: {
        type: Sequelize.JSONB,
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
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      usageCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdBy: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      lastUsed: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('templates', ['name']);
    await queryInterface.addIndex('templates', ['industry']);
    await queryInterface.addIndex('templates', ['isActive']);
    await queryInterface.addIndex('templates', ['usageCount']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('templates');
  }
};