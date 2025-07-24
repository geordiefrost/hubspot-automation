'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mapping_history', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      sourceField: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      hubspotName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      hubspotType: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      fieldType: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      objectType: {
        type: Sequelize.ENUM('contact', 'company', 'deal', 'ticket'),
        allowNull: false
      },
      groupName: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      options: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      usageCount: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      lastUsed: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      confidence: {
        type: Sequelize.FLOAT,
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

    await queryInterface.addIndex('mapping_history', ['sourceField']);
    await queryInterface.addIndex('mapping_history', ['hubspotName']);
    await queryInterface.addIndex('mapping_history', ['objectType']);
    await queryInterface.addIndex('mapping_history', ['usageCount']);
    await queryInterface.addIndex('mapping_history', ['lastUsed']);
    await queryInterface.addIndex('mapping_history', ['sourceField', 'hubspotName', 'objectType'], {
      unique: true,
      name: 'mapping_history_unique_constraint'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('mapping_history');
  }
};