'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('deployments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      clientName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      templateId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'templates',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      config: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'in_progress',
          'completed',
          'failed',
          'rolled_back'
        ),
        defaultValue: 'pending'
      },
      apiKeyHash: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      createdEntities: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      errorDetails: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      deploymentProgress: {
        type: Sequelize.JSONB,
        defaultValue: {
          totalSteps: 0,
          completedSteps: 0,
          currentStep: null
        }
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      executionTime: {
        type: Sequelize.INTEGER,
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

    await queryInterface.addIndex('deployments', ['clientName']);
    await queryInterface.addIndex('deployments', ['status']);
    await queryInterface.addIndex('deployments', ['templateId']);
    await queryInterface.addIndex('deployments', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('deployments');
  }
};