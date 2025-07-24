'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('deployment_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      deploymentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'deployments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      step: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('started', 'completed', 'failed', 'skipped'),
        allowNull: false
      },
      details: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      executionTime: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      hubspotResponse: {
        type: Sequelize.JSONB,
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

    await queryInterface.addIndex('deployment_logs', ['deploymentId']);
    await queryInterface.addIndex('deployment_logs', ['status']);
    await queryInterface.addIndex('deployment_logs', ['step']);
    await queryInterface.addIndex('deployment_logs', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('deployment_logs');
  }
};