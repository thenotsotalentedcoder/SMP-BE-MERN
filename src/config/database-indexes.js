const mongoose = require('mongoose');

// Database Performance Indexes Configuration
// 🎯 PURPOSE: Centralized index management for optimal query performance

const DatabaseIndexes = {
  // Critical indexes that must be created for system performance
  CRITICAL_INDEXES: [
    // Cycle Management Indexes
    {
      collection: 'Cycles',
      index: { isActive: 1 },
      options: {
        unique: true,
        partialFilterExpression: { isActive: true },
        name: 'unique_active_cycle'
      },
      purpose: 'Ensure only one active cycle exists'
    },
    {
      collection: 'Cycles',
      index: { deletedAt: 1 },
      options: { name: 'cycle_soft_delete' },
      purpose: 'Optimize soft delete queries'
    },
    {
      collection: 'Cycles',
      index: { status: 1 },
      options: { name: 'cycle_status' },
      purpose: 'Quick cycle status filtering'
    },
    {
      collection: 'Cycles',
      index: { currentActiveYear: 1 },
      options: { name: 'cycle_active_year' },
      purpose: 'Year-based cycle queries'
    },

    // ParameterCycle Association Indexes
    {
      collection: 'ParameterCycles',
      index: { parameterId: 1, cycleId: 1 },
      options: {
        unique: true,
        name: 'unique_parameter_cycle'
      },
      purpose: 'Ensure unique parameter-cycle associations'
    },
    {
      collection: 'ParameterCycles',
      index: { cycleId: 1, isActive: 1 },
      options: { name: 'cycle_active_parameters' },
      purpose: 'Quick retrieval of active parameters by cycle'
    },
    {
      collection: 'ParameterCycles',
      index: { parameterId: 1 },
      options: { name: 'parameter_cycles' },
      purpose: 'Find all cycles for a parameter'
    },
    {
      collection: 'ParameterCycles',
      index: { inheritedFromCycle: 1 },
      options: { name: 'parameter_inheritance' },
      purpose: 'Track parameter inheritance chains'
    },

    // ParameterSubmission Performance Indexes
    {
      collection: 'ParameterSubmissions',
      index: {
        parameterId: 1,
        cycleId: 1,
        submissionYear: 1,
        submissionType: 1
      },
      options: {
        unique: true,
        name: 'unique_submission'
      },
      purpose: 'Prevent duplicate submissions'
    },
    {
      collection: 'ParameterSubmissions',
      index: { cycleId: 1, submissionYear: 1 },
      options: { name: 'cycle_year_submissions' },
      purpose: 'Year-based submission retrieval'
    },
    {
      collection: 'ParameterSubmissions',
      index: { userId: 1, submissionYear: 1 },
      options: { name: 'user_year_submissions' },
      purpose: 'User submission history'
    },
    {
      collection: 'ParameterSubmissions',
      index: { parameterCycleId: 1 },
      options: { name: 'parameter_cycle_submissions' },
      purpose: 'Parameter-cycle submission queries'
    },
    {
      collection: 'ParameterSubmissions',
      index: { approvalStatus: 1 },
      options: { name: 'submission_approval_status' },
      purpose: 'Approval workflow queries'
    },
    {
      collection: 'ParameterSubmissions',
      index: { performanceStatus: 1 },
      options: { name: 'submission_performance' },
      purpose: 'Performance analysis queries'
    },
    {
      collection: 'ParameterSubmissions',
      index: { isLatestVersion: 1 },
      options: { name: 'latest_submissions' },
      purpose: 'Latest version filtering'
    },

    // User Cycle Access Indexes
    {
      collection: 'Users',
      index: { 'cycleAccess.currentCycleId': 1 },
      options: { name: 'user_current_cycle' },
      purpose: 'Users by current cycle access'
    },
    {
      collection: 'Users',
      index: { 'cycleAccess.currentCycleYear': 1 },
      options: { name: 'user_current_year' },
      purpose: 'Users by current year access'
    },
    {
      collection: 'Users',
      index: { userRole: 1, isActive: 1 },
      options: { name: 'active_users_by_role' },
      purpose: 'Role-based user queries'
    },
    {
      collection: 'Users',
      index: { deptId: 1, isActive: 1 },
      options: { name: 'department_users' },
      purpose: 'Department-based user queries'
    },
    {
      collection: 'Users',
      index: { facultyId: 1, isActive: 1 },
      options: { name: 'faculty_users' },
      purpose: 'Faculty-based user queries'
    },
    {
      collection: 'Users',
      index: { 'activityTracking.lastActiveAt': 1 },
      options: { name: 'user_activity' },
      purpose: 'User activity tracking'
    }
  ],

  // Performance optimization indexes
  OPTIMIZATION_INDEXES: [
    // Compound indexes for complex queries
    {
      collection: 'ParameterSubmissions',
      index: {
        cycleId: 1,
        submissionYear: 1,
        approvalStatus: 1,
        performanceStatus: 1
      },
      options: { name: 'complex_submission_query' },
      purpose: 'Complex submission analytics'
    },
    {
      collection: 'ParameterSubmissions',
      index: {
        userId: 1,
        cycleId: 1,
        deletedAt: 1,
        isLatestVersion: 1
      },
      options: { name: 'user_cycle_submissions' },
      purpose: 'User dashboard queries'
    },
    {
      collection: 'Users',
      index: {
        isActive: 1,
        userRole: 1,
        'cycleAccess.currentCycleId': 1
      },
      options: { name: 'active_role_cycle_users' },
      purpose: 'Admin user management queries'
    },

    // Text search indexes
    {
      collection: 'Cycles',
      index: {
        name: 'text',
        cycleName: 'text',
        description: 'text'
      },
      options: { name: 'cycle_text_search' },
      purpose: 'Cycle search functionality'
    },
    {
      collection: 'Parameters',
      index: {
        name: 'text',
        description: 'text'
      },
      options: { name: 'parameter_text_search' },
      purpose: 'Parameter search functionality'
    }
  ],

  // Reporting and analytics indexes
  ANALYTICS_INDEXES: [
    {
      collection: 'ParameterSubmissions',
      index: {
        submissionYear: 1,
        performanceStatus: 1,
        submittedValue: 1
      },
      options: { name: 'yearly_performance_analytics' },
      purpose: 'Year-over-year performance analysis'
    },
    {
      collection: 'ParameterSubmissions',
      index: {
        'submissionTimeline.firstSubmittedAt': 1,
        approvalStatus: 1
      },
      options: { name: 'submission_timeline_analytics' },
      purpose: 'Submission timeline analysis'
    },
    {
      collection: 'ParameterCycles',
      index: {
        cycleId: 1,
        'performanceMetrics.averageValue': 1,
        'performanceMetrics.trendDirection': 1
      },
      options: { name: 'parameter_performance_trends' },
      purpose: 'Parameter performance trend analysis'
    }
  ]
};

// Index creation utility functions
const IndexManager = {
  async createAllIndexes() {
    console.log('🔧 Creating database indexes...');

    const allIndexes = [
      ...DatabaseIndexes.CRITICAL_INDEXES,
      ...DatabaseIndexes.OPTIMIZATION_INDEXES,
      ...DatabaseIndexes.ANALYTICS_INDEXES
    ];

    const results = {
      created: 0,
      failed: 0,
      errors: []
    };

    for (const indexConfig of allIndexes) {
      try {
        await this.createIndex(indexConfig);
        results.created++;
        console.log(`✅ Created index: ${indexConfig.options.name} on ${indexConfig.collection}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: indexConfig.options.name,
          collection: indexConfig.collection,
          error: error.message
        });
        console.error(`❌ Failed to create index: ${indexConfig.options.name}`, error.message);
      }
    }

    console.log(`\n📊 Index Creation Summary:`);
    console.log(`✅ Created: ${results.created}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(err => {
        console.log(`  - ${err.collection}.${err.index}: ${err.error}`);
      });
    }

    return results;
  },

  async createIndex(indexConfig) {
    const { collection, index, options } = indexConfig;
    const db = mongoose.connection.db;

    return await db.collection(collection).createIndex(index, options);
  },

  async createCriticalIndexes() {
    console.log('🚨 Creating critical indexes only...');

    const results = {
      created: 0,
      failed: 0,
      errors: []
    };

    for (const indexConfig of DatabaseIndexes.CRITICAL_INDEXES) {
      try {
        await this.createIndex(indexConfig);
        results.created++;
        console.log(`✅ Created critical index: ${indexConfig.options.name}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: indexConfig.options.name,
          collection: indexConfig.collection,
          error: error.message
        });
        console.error(`❌ Failed to create critical index: ${indexConfig.options.name}`, error.message);
      }
    }

    return results;
  },

  async dropAllIndexes() {
    console.log('🗑️ Dropping all custom indexes...');

    const allIndexes = [
      ...DatabaseIndexes.CRITICAL_INDEXES,
      ...DatabaseIndexes.OPTIMIZATION_INDEXES,
      ...DatabaseIndexes.ANALYTICS_INDEXES
    ];

    const results = {
      dropped: 0,
      failed: 0,
      errors: []
    };

    for (const indexConfig of allIndexes) {
      try {
        await this.dropIndex(indexConfig);
        results.dropped++;
        console.log(`✅ Dropped index: ${indexConfig.options.name}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: indexConfig.options.name,
          collection: indexConfig.collection,
          error: error.message
        });
        // Don't log error if index doesn't exist
        if (!error.message.includes('not found')) {
          console.error(`❌ Failed to drop index: ${indexConfig.options.name}`, error.message);
        }
      }
    }

    return results;
  },

  async dropIndex(indexConfig) {
    const { collection, options } = indexConfig;
    const db = mongoose.connection.db;

    return await db.collection(collection).dropIndex(options.name);
  },

  async listIndexes(collectionName) {
    const db = mongoose.connection.db;
    const indexes = await db.collection(collectionName).listIndexes().toArray();

    console.log(`\n📋 Indexes for ${collectionName}:`);
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    return indexes;
  },

  async getIndexStats() {
    const collections = ['Cycles', 'ParameterCycles', 'ParameterSubmissions', 'Users'];
    const stats = {};

    for (const collection of collections) {
      try {
        const indexes = await this.listIndexes(collection);
        stats[collection] = {
          count: indexes.length,
          indexes: indexes.map(idx => ({ name: idx.name, key: idx.key }))
        };
      } catch (error) {
        stats[collection] = { error: error.message };
      }
    }

    return stats;
  },

  // Maintenance utilities
  async analyzeIndexUsage() {
    console.log('📈 Analyzing index usage...');
    // This would require MongoDB profiling to be enabled
    // Implementation would depend on specific monitoring requirements
    console.log('ℹ️ Index usage analysis requires MongoDB profiling to be enabled');
  },

  async optimizeIndexes() {
    console.log('⚡ Optimizing indexes...');

    // Drop and recreate indexes to optimize performance
    await this.dropAllIndexes();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await this.createAllIndexes();

    console.log('✅ Index optimization complete');
  }
};

module.exports = {
  DatabaseIndexes,
  IndexManager
};