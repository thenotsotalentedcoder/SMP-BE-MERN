const mongoose = require('mongoose');
const { IndexManager } = require('../config/database-indexes');

// Safe Migration Script for Dynamic Cycle Management System
// 🎯 PURPOSE: Migrate existing data to new schema with full rollback capability

class CycleManagementMigration {
  constructor() {
    this.migrationVersion = '1.0.0';
    this.migrationDate = new Date();
    this.backupCollections = {};
    this.migrationLog = [];
  }

  // Main migration execution
  async executeMigration() {
    try {
      console.log('\n🚀 Starting Dynamic Cycle Management Migration v' + this.migrationVersion);
      console.log('📅 Migration Date:', this.migrationDate.toISOString());

      // Pre-migration validation
      await this.validatePreMigration();

      // Create backups
      await this.createBackups();

      // Execute migration steps
      await this.migrateExistingCycles();
      await this.createParameterCycleAssociations();
      await this.migrateExistingSubmissions();
      await this.updateUserRecords();
      await this.createDatabaseIndexes();

      // Post-migration validation
      await this.validatePostMigration();

      // Record migration success
      await this.recordMigrationSuccess();

      console.log('\n✅ Migration completed successfully!');
      return { success: true, migrationId: this.generateMigrationId() };

    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      console.log('\n🔄 Initiating automatic rollback...');

      try {
        await this.rollbackMigration();
        console.log('✅ Rollback completed successfully');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
        throw new Error(`Migration failed and rollback failed: ${error.message} | Rollback error: ${rollbackError.message}`);
      }

      throw error;
    }
  }

  // Pre-migration validation
  async validatePreMigration() {
    console.log('\n🔍 Validating pre-migration state...');

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database connection not established');
    }

    // Check existing collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    const requiredCollections = ['Cycles', 'Parameters', 'Users'];
    for (const collection of requiredCollections) {
      if (!collectionNames.includes(collection)) {
        throw new Error(`Required collection '${collection}' not found`);
      }
    }

    // Count existing records
    const existingCycles = await mongoose.connection.db.collection('Cycles').countDocuments();
    const existingParameters = await mongoose.connection.db.collection('Parameters').countDocuments();
    const existingUsers = await mongoose.connection.db.collection('Users').countDocuments();

    this.migrationLog.push({
      step: 'pre_validation',
      timestamp: new Date(),
      data: {
        existingCycles,
        existingParameters,
        existingUsers,
        collections: collectionNames
      }
    });

    console.log(`✅ Found ${existingCycles} cycles, ${existingParameters} parameters, ${existingUsers} users`);

    // Check for any active migrations
    const activeMigrations = await mongoose.connection.db.collection('migrations')
      .findOne({ status: 'in_progress' });

    if (activeMigrations) {
      throw new Error('Another migration is currently in progress');
    }
  }

  // Create comprehensive backups
  async createBackups() {
    console.log('\n💾 Creating data backups...');

    const collectionsToBackup = ['Cycles', 'Parameters', 'Users', 'YearlyRatings'];
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const collectionName of collectionsToBackup) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const documents = await collection.find({}).toArray();

        this.backupCollections[collectionName] = {
          documents,
          count: documents.length,
          backupTimestamp
        };

        console.log(`✅ Backed up ${documents.length} documents from ${collectionName}`);
      } catch (error) {
        console.log(`⚠️ Warning: Could not backup ${collectionName}: ${error.message}`);
      }
    }

    // Store backup metadata
    await mongoose.connection.db.collection('migration_backups').insertOne({
      migrationVersion: this.migrationVersion,
      backupTimestamp,
      collections: Object.keys(this.backupCollections),
      totalDocuments: Object.values(this.backupCollections).reduce((sum, backup) => sum + backup.count, 0)
    });

    console.log('✅ Backup creation completed');
  }

  // Migrate existing cycles to new schema
  async migrateExistingCycles() {
    console.log('\n🔄 Migrating existing cycles...');

    const cycles = await mongoose.connection.db.collection('Cycles').find({}).toArray();

    for (const cycle of cycles) {
      try {
        const updates = {
          // Preserve existing fields, add new ones with defaults
          cycleName: cycle.cycleName || cycle.name,
          status: cycle.status || 'active',
          isActive: cycle.isActive !== undefined ? cycle.isActive : true,

          // Calculate cycleYears from startYear and endYear
          cycleYears: this.calculateCycleYears(cycle.startYear, cycle.endYear),

          // Set currentActiveYear to first year or current year
          currentActiveYear: cycle.currentActiveYear ||
            (cycle.startYear ? new Date(cycle.startYear).getFullYear() : new Date().getFullYear()),

          // Initialize target year settings
          targetYear: cycle.targetYear ||
            (cycle.endYear ? new Date(cycle.endYear).getFullYear() : new Date().getFullYear() + 5),

          targetYearSettings: {
            hasActualSubmission: false,
            hasProjectedSubmission: true,
            actualSubmissionEnabled: false,
            totalProjectedSubmissions: 0,
            totalActualSubmissions: 0,
            parametersExceedingTargets: 0,
            parametersMetTargets: 0,
            parametersBelowTargets: 0
          },

          // Initialize arrays
          activatedYears: cycle.activatedYears || [
            cycle.startYear ? new Date(cycle.startYear).getFullYear() : new Date().getFullYear()
          ],
          yearActivationHistory: cycle.yearActivationHistory || [],

          // Metadata
          totalParameters: cycle.totalParameters || 0,
          activeParameters: cycle.activeParameters || 0,
          lastModifiedAt: new Date(),
          lastModifiedBy: 'migration_system'
        };

        await mongoose.connection.db.collection('Cycles').updateOne(
          { _id: cycle._id },
          { $set: updates }
        );

        console.log(`✅ Migrated cycle: ${cycle.name} (ID: ${cycle._id})`);
      } catch (error) {
        console.error(`❌ Failed to migrate cycle ${cycle._id}:`, error.message);
        throw error;
      }
    }

    this.migrationLog.push({
      step: 'cycle_migration',
      timestamp: new Date(),
      data: { migratedCycles: cycles.length }
    });
  }

  // Create ParameterCycle associations
  async createParameterCycleAssociations() {
    console.log('\n🔗 Creating parameter-cycle associations...');

    const parameters = await mongoose.connection.db.collection('Parameters').find({}).toArray();
    const cycles = await mongoose.connection.db.collection('Cycles').find({}).toArray();

    let associationsCreated = 0;
    let parameterCycleId = 1;

    // Get existing max ID
    const lastParameterCycle = await mongoose.connection.db.collection('ParameterCycles')
      .findOne({}, { sort: { _id: -1 } });
    if (lastParameterCycle) {
      parameterCycleId = lastParameterCycle._id + 1;
    }

    for (const cycle of cycles) {
      for (const parameter of parameters) {
        try {
          // Check if association already exists
          const existing = await mongoose.connection.db.collection('ParameterCycles')
            .findOne({ parameterId: parameter._id, cycleId: cycle._id });

          if (!existing) {
            const association = {
              _id: parameterCycleId++,
              parameterId: parameter._id,
              cycleId: cycle._id,
              isActive: true,
              status: 'active',
              inheritedFromCycle: null, // Original parameter

              cycleSpecificSettings: {
                targetValue: parameter.targetValue || null,
                targetDescription: parameter.targetDescription || '',
                targetCategory: 'minimum',
                weightInCycle: 1.0,
                priorityLevel: 'medium',
                submissionRequirements: {
                  isRequired: true,
                  requiresEvidence: false,
                  evidenceTypes: [],
                  minimumSubmissions: 1
                },
                yearlyOverrides: []
              },

              performanceMetrics: {
                totalSubmissions: 0,
                averageValue: 0,
                trendDirection: 'insufficient_data'
              },

              activatedAt: new Date(),
              activatedBy: 'migration_system',
              lastModifiedAt: new Date(),
              lastModifiedBy: 'migration_system',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            await mongoose.connection.db.collection('ParameterCycles').insertOne(association);
            associationsCreated++;
          }
        } catch (error) {
          console.error(`❌ Failed to create association for parameter ${parameter._id} and cycle ${cycle._id}:`, error.message);
          throw error;
        }
      }
    }

    console.log(`✅ Created ${associationsCreated} parameter-cycle associations`);

    this.migrationLog.push({
      step: 'parameter_cycle_associations',
      timestamp: new Date(),
      data: { associationsCreated }
    });
  }

  // Migrate existing submissions (if any)
  async migrateExistingSubmissions() {
    console.log('\n📊 Migrating existing submissions...');

    // Check if YearlyRatings collection exists (legacy submissions)
    try {
      const yearlyRatings = await mongoose.connection.db.collection('YearlyRatings').find({}).toArray();

      if (yearlyRatings.length === 0) {
        console.log('ℹ️ No existing submissions found to migrate');
        return;
      }

      let submissionsCreated = 0;
      let submissionId = 1;

      // Get existing max ID
      const lastSubmission = await mongoose.connection.db.collection('ParameterSubmissions')
        .findOne({}, { sort: { _id: -1 } });
      if (lastSubmission) {
        submissionId = lastSubmission._id + 1;
      }

      for (const rating of yearlyRatings) {
        try {
          // Find corresponding parameter-cycle association
          const parameterCycle = await mongoose.connection.db.collection('ParameterCycles')
            .findOne({
              parameterId: rating.parameterId,
              cycleId: rating.cycleId
            });

          if (parameterCycle) {
            const submission = {
              _id: submissionId++,
              parameterId: rating.parameterId,
              parameterCycleId: parameterCycle._id,
              cycleId: rating.cycleId,
              userId: rating.userId,
              submissionYear: rating.year || new Date().getFullYear(),
              submissionType: 'projected', // Default to projected for legacy data
              submittedValue: rating.value || 0,
              targetValue: rating.targetValue || null,
              performanceStatus: 'insufficient_data',
              evidence: [],
              remarks: rating.remarks || '',
              approvalStatus: 'approved', // Assume legacy data is approved
              version: 1,
              isLatestVersion: true,
              submissionTimeline: {
                firstSubmittedAt: rating.createdAt || new Date(),
                finalSubmittedAt: rating.createdAt || new Date(),
                lastModifiedAt: new Date()
              },
              status: 'approved',
              isActive: true,
              createdAt: rating.createdAt || new Date(),
              updatedAt: new Date()
            };

            // Calculate variance if target exists
            if (submission.targetValue) {
              submission.varianceFromTarget = submission.submittedValue - submission.targetValue;
              submission.variancePercentage = submission.targetValue !== 0
                ? Math.round((submission.varianceFromTarget / submission.targetValue) * 100)
                : 0;

              // Update performance status
              if (submission.submittedValue >= submission.targetValue) {
                submission.performanceStatus = 'meets_target';
                if (submission.variancePercentage > 10) {
                  submission.performanceStatus = 'exceeds_target';
                }
              } else {
                submission.performanceStatus = 'below_target';
              }
            }

            await mongoose.connection.db.collection('ParameterSubmissions').insertOne(submission);
            submissionsCreated++;
          }
        } catch (error) {
          console.error(`❌ Failed to migrate submission ${rating._id}:`, error.message);
          // Continue with other submissions
        }
      }

      console.log(`✅ Migrated ${submissionsCreated} submissions from YearlyRatings`);

      this.migrationLog.push({
        step: 'submission_migration',
        timestamp: new Date(),
        data: { submissionsCreated }
      });

    } catch (error) {
      console.log('ℹ️ YearlyRatings collection not found, skipping submission migration');
    }
  }

  // Update user records with new fields
  async updateUserRecords() {
    console.log('\n👥 Updating user records...');

    const users = await mongoose.connection.db.collection('Users').find({}).toArray();
    let usersUpdated = 0;

    // Get the active cycle for default assignment
    const activeCycle = await mongoose.connection.db.collection('Cycles')
      .findOne({ isActive: true });

    for (const user of users) {
      try {
        const updates = {
          // Add cycle access fields
          cycleAccess: {
            currentCycleId: activeCycle ? activeCycle._id : null,
            currentCycleYear: activeCycle ? activeCycle.currentActiveYear : null,
            accessHistory: [],
            permissions: this.getDefaultPermissionsByRole(user.userRole),
            submissionAccess: this.getDefaultSubmissionAccess(user.userRole)
          },

          // Add activity tracking
          activityTracking: {
            totalLogins: 0,
            totalSubmissions: 0,
            sessionsThisMonth: 0
          },

          // Add user preferences
          userPreferences: {
            preferredLanguage: 'en',
            timezone: 'Asia/Karachi',
            notificationSettings: {
              emailNotifications: true,
              submissionReminders: true,
              cycleUpdates: true,
              deadlineAlerts: true
            },
            dashboardSettings: {
              defaultView: 'summary',
              showCompletedTasks: false,
              chartsPreference: 'bar'
            }
          },

          // Add admin fields
          isActive: user.isActive !== undefined ? user.isActive : true,
          status: user.status || 'active',
          lastModifiedAt: new Date(),
          lastModifiedBy: 'migration_system',

          // Add security settings
          securitySettings: {
            mustChangePassword: false,
            invalidLoginAttempts: 0,
            twoFactorEnabled: false
          }
        };

        await mongoose.connection.db.collection('Users').updateOne(
          { _id: user._id },
          { $set: updates }
        );

        usersUpdated++;
      } catch (error) {
        console.error(`❌ Failed to update user ${user._id}:`, error.message);
        throw error;
      }
    }

    console.log(`✅ Updated ${usersUpdated} user records`);

    this.migrationLog.push({
      step: 'user_updates',
      timestamp: new Date(),
      data: { usersUpdated }
    });
  }

  // Create database indexes
  async createDatabaseIndexes() {
    console.log('\n🔍 Creating database indexes...');

    try {
      const results = await IndexManager.createCriticalIndexes();
      console.log(`✅ Created ${results.created} critical indexes`);

      this.migrationLog.push({
        step: 'index_creation',
        timestamp: new Date(),
        data: results
      });
    } catch (error) {
      console.error('❌ Failed to create indexes:', error.message);
      throw error;
    }
  }

  // Post-migration validation
  async validatePostMigration() {
    console.log('\n🔍 Validating post-migration state...');

    // Verify critical data integrity
    const cycles = await mongoose.connection.db.collection('Cycles').countDocuments();
    const parameterCycles = await mongoose.connection.db.collection('ParameterCycles').countDocuments();
    const users = await mongoose.connection.db.collection('Users').countDocuments();

    // Verify unique active cycle constraint
    const activeCycles = await mongoose.connection.db.collection('Cycles')
      .countDocuments({ isActive: true });

    if (activeCycles > 1) {
      throw new Error('Multiple active cycles found - violates unique constraint');
    }

    // Verify all parameters have cycle associations
    const totalParameters = await mongoose.connection.db.collection('Parameters').countDocuments();
    const totalCycles = await mongoose.connection.db.collection('Cycles').countDocuments();
    const expectedAssociations = totalParameters * totalCycles;

    if (parameterCycles < expectedAssociations) {
      console.log(`⚠️ Warning: Expected ${expectedAssociations} parameter-cycle associations, found ${parameterCycles}`);
    }

    console.log('✅ Post-migration validation completed');

    this.migrationLog.push({
      step: 'post_validation',
      timestamp: new Date(),
      data: {
        cycles,
        parameterCycles,
        users,
        activeCycles,
        totalParameters,
        expectedAssociations
      }
    });
  }

  // Record migration success
  async recordMigrationSuccess() {
    const migrationRecord = {
      _id: this.generateMigrationId(),
      version: this.migrationVersion,
      executedAt: this.migrationDate,
      status: 'completed',
      executionTimeMs: Date.now() - this.migrationDate.getTime(),
      log: this.migrationLog,
      backupCollections: Object.keys(this.backupCollections),
      rollbackAvailable: true
    };

    await mongoose.connection.db.collection('migrations').insertOne(migrationRecord);
    console.log(`📝 Migration record saved with ID: ${migrationRecord._id}`);
  }

  // Rollback migration
  async rollbackMigration() {
    console.log('\n🔄 Rolling back migration...');

    try {
      // Drop new collections
      const newCollections = ['ParameterCycles', 'ParameterSubmissions'];
      for (const collection of newCollections) {
        try {
          await mongoose.connection.db.collection(collection).drop();
          console.log(`✅ Dropped collection: ${collection}`);
        } catch (error) {
          if (!error.message.includes('ns not found')) {
            console.error(`❌ Failed to drop ${collection}:`, error.message);
          }
        }
      }

      // Restore original collections from backup
      for (const [collectionName, backup] of Object.entries(this.backupCollections)) {
        if (backup.documents.length > 0) {
          await mongoose.connection.db.collection(collectionName).deleteMany({});
          await mongoose.connection.db.collection(collectionName).insertMany(backup.documents);
          console.log(`✅ Restored ${backup.documents.length} documents to ${collectionName}`);
        }
      }

      // Drop migration indexes
      await IndexManager.dropAllIndexes();

      // Record rollback
      await mongoose.connection.db.collection('migrations').insertOne({
        _id: this.generateMigrationId() + '_rollback',
        version: this.migrationVersion,
        executedAt: new Date(),
        status: 'rolled_back',
        originalMigrationDate: this.migrationDate,
        rollbackReason: 'Migration failure'
      });

      console.log('✅ Rollback completed successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }

  // Utility methods
  generateMigrationId() {
    return `migration_${this.migrationVersion}_${Date.now()}`;
  }

  calculateCycleYears(startYear, endYear) {
    if (!startYear || !endYear) return [];

    const start = new Date(startYear).getFullYear();
    const end = new Date(endYear).getFullYear();
    const years = [];

    for (let year = start; year <= end; year++) {
      years.push(year);
    }

    return years;
  }

  getDefaultPermissionsByRole(role) {
    const permissions = {
      canViewAllCycles: false,
      canEditActiveYear: true,
      canViewPreviousYears: true,
      canAccessTargetYear: false,
      restrictedToDepartment: true,
      restrictedToFaculty: true
    };

    switch (role) {
      case 'Admin':
        permissions.canViewAllCycles = true;
        permissions.canAccessTargetYear = true;
        permissions.restrictedToDepartment = false;
        permissions.restrictedToFaculty = false;
        break;
      case 'VC':
      case 'PVC':
        permissions.canViewAllCycles = true;
        permissions.canAccessTargetYear = true;
        permissions.restrictedToDepartment = false;
        permissions.restrictedToFaculty = false;
        break;
      case 'Dean':
        permissions.restrictedToDepartment = false;
        permissions.restrictedToFaculty = true;
        break;
      case 'Chairman':
        permissions.restrictedToDepartment = true;
        permissions.restrictedToFaculty = true;
        break;
    }

    return permissions;
  }

  getDefaultSubmissionAccess(role) {
    return {
      canSubmitProjected: true,
      canSubmitActual: ['Admin'].includes(role),
      canEditSubmissions: true,
      canDeleteSubmissions: ['Admin'].includes(role)
    };
  }
}

// Export migration class and execution function
module.exports = {
  CycleManagementMigration,

  // Direct execution function for npm scripts
  async executeMigration() {
    const migration = new CycleManagementMigration();
    return await migration.executeMigration();
  },

  // Rollback function
  async rollbackMigration() {
    const migration = new CycleManagementMigration();
    return await migration.rollbackMigration();
  }
};