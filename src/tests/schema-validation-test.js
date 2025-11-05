const mongoose = require('mongoose');
require('dotenv').config();

// Import enhanced models
const Cycle = require('../models/Cycle');
const User = require('../models/User');
const ParameterCycle = require('../models/ParameterCycle');
const ParameterSubmission = require('../models/ParameterSubmission');

// Schema Validation Test Suite
// 🎯 PURPOSE: Validate enhanced schemas work with existing data patterns

class SchemaValidationTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      details: []
    };
  }

  async runAllTests() {
    console.log('🧪 Starting Schema Validation Tests...\n');

    try {
      // Connect to database if not already connected
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smp_test');
        console.log('✅ Connected to test database\n');
      }

      // Run test suites
      await this.testCycleSchema();
      await this.testUserSchema();
      await this.testParameterCycleSchema();
      await this.testParameterSubmissionSchema();
      await this.testBackwardCompatibility();
      await this.testDataIntegrity();
      await this.testIndexConstraints();

      // Generate test report
      this.generateTestReport();

      return this.testResults;

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      this.testResults.errors.push({
        test: 'test_suite_execution',
        error: error.message
      });
      throw error;
    }
  }

  // Test enhanced Cycle schema
  async testCycleSchema() {
    console.log('📊 Testing Enhanced Cycle Schema...');

    try {
      // Test 1: Create cycle with new fields
      const testCycle = new Cycle({
        _id: 9999,
        name: 'Test Strategic Plan 2024-2028',
        startYear: new Date('2024-01-01'),
        endYear: new Date('2028-12-31'),
        cycleName: 'Test Cycle',
        isActive: false // Avoid conflict with existing active cycle
      });

      await testCycle.save();
      this.recordTest('create_enhanced_cycle', true, 'Successfully created cycle with new fields');

      // Test 2: Verify auto-populated fields
      const savedCycle = await Cycle.findById(9999);
      const hasAutoFields = savedCycle.cycleYears.length > 0 &&
                           savedCycle.currentActiveYear &&
                           savedCycle.targetYear;

      this.recordTest('cycle_auto_population', hasAutoFields,
        hasAutoFields ? 'Auto-population working' : 'Auto-population failed');

      // Test 3: Test cycle methods
      const yearActivated = await savedCycle.activateYear(2025, 'test_admin', 'Testing year activation');
      this.recordTest('cycle_method_activation', !!yearActivated,
        'Year activation method working');

      // Test 4: Test virtual fields
      const yearRange = savedCycle.yearRange;
      const hasVirtuals = yearRange && yearRange.includes('-');
      this.recordTest('cycle_virtual_fields', hasVirtuals,
        hasVirtuals ? 'Virtual fields working' : 'Virtual fields not working');

      // Cleanup
      await Cycle.findByIdAndDelete(9999);

    } catch (error) {
      this.recordTest('cycle_schema_test', false, error.message);
    }
  }

  // Test enhanced User schema
  async testUserSchema() {
    console.log('👤 Testing Enhanced User Schema...');

    try {
      // Test 1: Create user with enhanced fields
      const testUser = new User({
        _id: 9999,
        userName: 'test.user.schema',
        email: 'test.schema@ned.edu.pk',
        firstName: 'Test',
        lastName: 'User',
        userRole: 'Chairman',
        deptId: 1,
        facultyId: 1
      });

      await testUser.save();
      this.recordTest('create_enhanced_user', true, 'Successfully created user with new fields');

      // Test 2: Verify role-based permissions
      const savedUser = await User.findById(9999);
      const hasRolePermissions = savedUser.cycleAccess &&
                                savedUser.cycleAccess.permissions &&
                                savedUser.cycleAccess.permissions.restrictedToDepartment === true;

      this.recordTest('user_role_permissions', hasRolePermissions,
        hasRolePermissions ? 'Role-based permissions set correctly' : 'Role permissions not set');

      // Test 3: Test user methods
      await savedUser.grantCycleAccess(1, 2024, 'test_admin', 'write');
      const hasAccess = savedUser.hasAccessToCycle(1);
      this.recordTest('user_cycle_access_methods', hasAccess,
        'Cycle access methods working');

      // Test 4: Test activity tracking
      await savedUser.recordLogin();
      const activityTracked = savedUser.activityTracking.totalLogins === 1;
      this.recordTest('user_activity_tracking', activityTracked,
        activityTracked ? 'Activity tracking working' : 'Activity tracking failed');

      // Cleanup
      await User.findByIdAndDelete(9999);

    } catch (error) {
      this.recordTest('user_schema_test', false, error.message);
    }
  }

  // Test ParameterCycle schema
  async testParameterCycleSchema() {
    console.log('🔗 Testing ParameterCycle Schema...');

    try {
      // Test 1: Create parameter-cycle association
      const testAssociation = new ParameterCycle({
        _id: 9999,
        parameterId: 1,
        cycleId: 1,
        isActive: true,
        status: 'active',
        cycleSpecificSettings: {
          targetValue: 100,
          weightInCycle: 2.0,
          priorityLevel: 'high'
        }
      });

      await testAssociation.save();
      this.recordTest('create_parameter_cycle', true, 'Successfully created parameter-cycle association');

      // Test 2: Test inheritance methods
      await testAssociation.recordInheritance(2, 'test_admin', { preservedTarget: 100 });
      const hasInheritance = testAssociation.inheritanceHistory.length > 0;
      this.recordTest('parameter_inheritance', hasInheritance,
        hasInheritance ? 'Inheritance tracking working' : 'Inheritance tracking failed');

      // Test 3: Test cycle-specific settings
      await testAssociation.updateCycleSettings({ targetValue: 150 }, 'test_admin');
      const settingsUpdated = testAssociation.cycleSpecificSettings.targetValue === 150;
      this.recordTest('cycle_specific_settings', settingsUpdated,
        settingsUpdated ? 'Cycle settings update working' : 'Settings update failed');

      // Test 4: Test virtual fields
      const isInherited = testAssociation.isInherited;
      this.recordTest('parameter_cycle_virtuals', typeof isInherited === 'boolean',
        'Virtual fields working');

      // Cleanup
      await ParameterCycle.findByIdAndDelete(9999);

    } catch (error) {
      this.recordTest('parameter_cycle_schema_test', false, error.message);
    }
  }

  // Test ParameterSubmission schema
  async testParameterSubmissionSchema() {
    console.log('📊 Testing ParameterSubmission Schema...');

    try {
      // Test 1: Create comprehensive submission
      const testSubmission = new ParameterSubmission({
        _id: 9999,
        parameterId: 1,
        parameterCycleId: 1,
        cycleId: 1,
        userId: 1,
        submissionYear: 2024,
        submissionType: 'projected',
        submittedValue: 95,
        targetValue: 100,
        evidence: [{
          type: 'document',
          title: 'Test Evidence',
          description: 'Test document for validation'
        }]
      });

      await testSubmission.save();
      this.recordTest('create_parameter_submission', true, 'Successfully created parameter submission');

      // Test 2: Test variance calculation
      testSubmission.calculateVariance();
      const varianceCalculated = testSubmission.varianceFromTarget === -5 &&
                                testSubmission.variancePercentage === -5;
      this.recordTest('submission_variance_calculation', varianceCalculated,
        varianceCalculated ? 'Variance calculation working' : 'Variance calculation failed');

      // Test 3: Test submission workflow
      await testSubmission.submit(1);
      const workflowWorking = testSubmission.status === 'submitted' &&
                             testSubmission.approvalStatus === 'pending';
      this.recordTest('submission_workflow', workflowWorking,
        workflowWorking ? 'Submission workflow working' : 'Workflow failed');

      // Test 4: Test approval process
      await testSubmission.approve('test_admin', 'Test approval');
      const approved = testSubmission.approvalStatus === 'approved';
      this.recordTest('submission_approval', approved,
        approved ? 'Approval process working' : 'Approval failed');

      // Test 5: Test virtual fields
      const hasEvidence = testSubmission.hasEvidence;
      const achievementPercentage = testSubmission.achievementPercentage;
      this.recordTest('submission_virtuals', hasEvidence && achievementPercentage === 95,
        'Virtual fields working correctly');

      // Cleanup
      await ParameterSubmission.findByIdAndDelete(9999);

    } catch (error) {
      this.recordTest('parameter_submission_schema_test', false, error.message);
    }
  }

  // Test backward compatibility
  async testBackwardCompatibility() {
    console.log('🔄 Testing Backward Compatibility...');

    try {
      // Test 1: Create cycle with minimal fields (old format)
      const minimalCycle = new Cycle({
        _id: 9998,
        name: 'Minimal Test Cycle',
        startYear: new Date('2024-01-01'),
        endYear: new Date('2028-12-31')
      });

      await minimalCycle.save();

      // Verify defaults are applied
      const savedMinimal = await Cycle.findById(9998);
      const hasDefaults = savedMinimal.cycleName &&
                         savedMinimal.cycleYears.length > 0 &&
                         savedMinimal.status === 'draft';

      this.recordTest('backward_compatibility_cycle', hasDefaults,
        hasDefaults ? 'Backward compatibility maintained' : 'Defaults not applied');

      // Test 2: Create user with minimal fields
      const minimalUser = new User({
        _id: 9998,
        userName: 'minimal.test',
        email: 'minimal@test.com',
        userRole: 'Chairman'
      });

      await minimalUser.save();

      const savedMinimalUser = await User.findById(9998);
      const userDefaults = savedMinimalUser.isActive === true &&
                          savedMinimalUser.status === 'active' &&
                          savedMinimalUser.cycleAccess;

      this.recordTest('backward_compatibility_user', userDefaults,
        userDefaults ? 'User backward compatibility maintained' : 'User defaults failed');

      // Cleanup
      await Cycle.findByIdAndDelete(9998);
      await User.findByIdAndDelete(9998);

    } catch (error) {
      this.recordTest('backward_compatibility_test', false, error.message);
    }
  }

  // Test data integrity constraints
  async testDataIntegrity() {
    console.log('🔒 Testing Data Integrity Constraints...');

    try {
      // Test 1: Unique active cycle constraint
      const activeCycle1 = new Cycle({
        _id: 9997,
        name: 'Active Cycle 1',
        startYear: new Date('2024-01-01'),
        endYear: new Date('2028-12-31'),
        isActive: true
      });

      const activeCycle2 = new Cycle({
        _id: 9996,
        name: 'Active Cycle 2',
        startYear: new Date('2029-01-01'),
        endYear: new Date('2033-12-31'),
        isActive: true
      });

      await activeCycle1.save();

      let uniqueConstraintWorks = false;
      try {
        await activeCycle2.save();
        // If this succeeds, the constraint is not working
      } catch (error) {
        if (error.code === 11000) { // Duplicate key error
          uniqueConstraintWorks = true;
        }
      }

      this.recordTest('unique_active_cycle_constraint', uniqueConstraintWorks,
        uniqueConstraintWorks ? 'Unique active cycle constraint working' : 'Constraint not enforced');

      // Test 2: Unique parameter-cycle association
      const association1 = new ParameterCycle({
        _id: 9997,
        parameterId: 1,
        cycleId: 1
      });

      const association2 = new ParameterCycle({
        _id: 9996,
        parameterId: 1,
        cycleId: 1
      });

      await association1.save();

      let associationConstraintWorks = false;
      try {
        await association2.save();
      } catch (error) {
        if (error.code === 11000) {
          associationConstraintWorks = true;
        }
      }

      this.recordTest('unique_parameter_cycle_constraint', associationConstraintWorks,
        associationConstraintWorks ? 'Parameter-cycle uniqueness working' : 'Association constraint failed');

      // Cleanup
      await Cycle.findByIdAndDelete(9997);
      await ParameterCycle.findByIdAndDelete(9997);

    } catch (error) {
      this.recordTest('data_integrity_test', false, error.message);
    }
  }

  // Test index constraints
  async testIndexConstraints() {
    console.log('🔍 Testing Index Constraints...');

    try {
      // Get list of indexes for each collection
      const cycleIndexes = await mongoose.connection.db.collection('Cycles').listIndexes().toArray();
      const userIndexes = await mongoose.connection.db.collection('Users').listIndexes().toArray();

      // Test for critical indexes
      const hasUniqueActiveIndex = cycleIndexes.some(idx =>
        idx.name === 'unique_active_cycle' ||
        JSON.stringify(idx.key).includes('isActive')
      );

      const hasUserCycleIndex = userIndexes.some(idx =>
        JSON.stringify(idx.key).includes('cycleAccess.currentCycleId')
      );

      this.recordTest('critical_indexes_exist', hasUniqueActiveIndex && hasUserCycleIndex,
        'Critical indexes are present');

      // Test index functionality by attempting operations
      const indexesWorking = await this.testIndexPerformance();
      this.recordTest('index_performance', indexesWorking,
        indexesWorking ? 'Indexes improving query performance' : 'Index performance unclear');

    } catch (error) {
      this.recordTest('index_constraints_test', false, error.message);
    }
  }

  // Helper method to test index performance
  async testIndexPerformance() {
    try {
      const startTime = Date.now();

      // Perform indexed query
      await Cycle.findOne({ isActive: true });
      await User.findOne({ 'cycleAccess.currentCycleId': 1 });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // If queries complete quickly (under 100ms), indexes are likely working
      return queryTime < 100;
    } catch (error) {
      return false;
    }
  }

  // Helper method to record test results
  recordTest(testName, passed, message) {
    if (passed) {
      this.testResults.passed++;
      console.log(`  ✅ ${testName}: ${message}`);
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${testName}: ${message}`);
      this.testResults.errors.push({
        test: testName,
        error: message
      });
    }

    this.testResults.details.push({
      test: testName,
      passed,
      message,
      timestamp: new Date()
    });
  }

  // Generate comprehensive test report
  generateTestReport() {
    console.log('\n📋 Schema Validation Test Report');
    console.log('=====================================');
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total Tests: ${this.testResults.passed + this.testResults.failed}`);

    const successRate = Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100);
    console.log(`🎯 Success Rate: ${successRate}%`);

    if (this.testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error}`);
      });
    }

    if (successRate === 100) {
      console.log('\n🎉 All tests passed! Schema validation successful.');
    } else if (successRate >= 80) {
      console.log('\n⚠️ Most tests passed, but some issues need attention.');
    } else {
      console.log('\n🚨 Significant issues found. Review failed tests before proceeding.');
    }

    console.log('\n✅ Schema validation testing completed.\n');
  }
}

// Export for use in other modules
module.exports = {
  SchemaValidationTest,

  // Direct execution function
  async runSchemaValidation() {
    const validator = new SchemaValidationTest();
    return await validator.runAllTests();
  }
};

// Allow direct execution
if (require.main === module) {
  const validator = new SchemaValidationTest();
  validator.runAllTests()
    .then(results => {
      console.log('Test execution completed');
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}