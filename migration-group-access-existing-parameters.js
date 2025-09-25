// Migration Script: Add Group Access Control to Existing Parameters
// This script updates all existing parameters to be visible to all groups initially
// Admin can then restrict parameters as needed

require('dotenv').config();
const mongoose = require('mongoose');
const Parameter = require('./src/models/Parameter');

async function migrateExistingParameters() {
  try {
    console.log('🔄 Starting migration: Group Access Control for Existing Parameters');
    console.log('📅 Date:', new Date().toISOString());

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Get count of existing parameters without group access fields
    const existingParametersCount = await Parameter.countDocuments({
      $or: [
        { accessibleToGroups: { $exists: false } },
        { restrictedAccess: { $exists: false } }
      ]
    });

    console.log(`📊 Found ${existingParametersCount} parameters to migrate`);

    if (existingParametersCount === 0) {
      console.log('✅ No parameters need migration - all already have group access fields');
      await mongoose.disconnect();
      return;
    }

    // All available groups - existing parameters will be visible to all initially
    const allGroups = [
      'Academic Departments',
      'ORIC', 'QEC', 'CSA',
      'Directorate of Finance', 'DIL', 'UAFA',
      'DWS', 'ITD', 'Library', 'Medical Center',
      'NED Academy', 'Registrar Office'
    ];

    console.log('🔧 Updating existing parameters...');

    // Update all existing parameters
    const result = await Parameter.updateMany(
      {
        $or: [
          { accessibleToGroups: { $exists: false } },
          { restrictedAccess: { $exists: false } }
        ]
      },
      {
        $set: {
          accessibleToGroups: allGroups,    // Visible to all groups initially
          restrictedAccess: false           // Not restricted (backwards compatible)
        }
      }
    );

    console.log(`✅ Migration completed successfully!`);
    console.log(`📈 Updated ${result.modifiedCount} parameters`);
    console.log(`📋 All existing parameters are now visible to all user groups`);
    console.log(`🔧 Admins can now edit individual parameters to restrict access`);

    // Verify the migration
    const migratedCount = await Parameter.countDocuments({
      accessibleToGroups: { $exists: true },
      restrictedAccess: { $exists: true }
    });

    console.log(`✅ Verification: ${migratedCount} parameters now have group access fields`);

    // Show sample of migrated parameters
    const sampleParameters = await Parameter.find({
      accessibleToGroups: { $exists: true }
    }).limit(3);

    console.log('\n📋 Sample migrated parameters:');
    sampleParameters.forEach((param, index) => {
      console.log(`${index + 1}. ${param.parameterName}`);
      console.log(`   - Groups: ${param.accessibleToGroups.length} groups`);
      console.log(`   - Restricted: ${param.restrictedAccess}`);
    });

    await mongoose.disconnect();
    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration if script is called directly
if (require.main === module) {
  migrateExistingParameters();
}

module.exports = migrateExistingParameters;