const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables

// MongoDB connection - use Atlas connection from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smp-backend';

// Import Cycle model
const Cycle = require('./src/models/Cycle.js');

async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function loadMySQLData() {
  try {
    // Load from parent directory where the exported data files are
    const exportedData = JSON.parse(fs.readFileSync(path.join(__dirname, '../exported-mysql-data.json'), 'utf8'));
    return exportedData.cycles.data || [];
  } catch (error) {
    console.error('❌ Failed to load MySQL data:', error);
    process.exit(1);
  }
}

async function clearCycles() {
  try {
    console.log('🧹 Clearing existing cycles...');
    const deleteResult = await Cycle.deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} existing cycles`);
  } catch (error) {
    console.error('❌ Failed to clear cycles:', error);
    throw error;
  }
}

async function migrateCycles() {
  console.log('🚀 Starting Cycles Migration (Step 3)...\n');
  
  // Connect to MongoDB
  await connectToMongoDB();
  
  // Load MySQL data
  console.log('📁 Loading MySQL cycles data...');
  const mysqlCycles = await loadMySQLData();
  console.log(`   Found ${mysqlCycles.length} cycles in MySQL data\n`);
  
  // Clear existing cycles (hard delete since manually cleaned)
  await clearCycles();
  
  // Transform and import cycles
  console.log('🔄 Importing cycles...');
  const importedCycles = [];
  
  for (const mysqlCycle of mysqlCycles) {
    try {
      // Transform MySQL cycle to MERN format
      const cycleData = {
        _id: mysqlCycle.id,
        name: mysqlCycle.name.trim(),
        startYear: new Date(mysqlCycle.startYear), // Convert to Date object
        endYear: new Date(mysqlCycle.endYear),     // Convert to Date object
        deletedAt: null // Ensure active status
      };
      
      // Create cycle in MongoDB
      const cycle = new Cycle(cycleData);
      await cycle.save();
      
      importedCycles.push({
        id: cycleData._id,
        name: cycleData.name,
        startYear: cycleData.startYear.getFullYear(),
        endYear: cycleData.endYear.getFullYear()
      });
      
      console.log(`   ✅ Imported: ${cycleData.name} (${cycleData.startYear.getFullYear()}-${cycleData.endYear.getFullYear()}) - ID: ${cycleData._id}`);
      
    } catch (error) {
      console.error(`   ❌ Failed to import cycle ${mysqlCycle.name}:`, error.message);
    }
  }
  
  // Verification
  console.log('\n🔍 Verification...');
  const totalCycles = await Cycle.countDocuments({ deletedAt: null });
  const activeCycles = await Cycle.find({ deletedAt: null }).select('_id name startYear endYear');
  
  console.log(`   Total cycles in MongoDB: ${totalCycles}`);
  console.log(`   Active cycles: ${activeCycles.length}`);
  
  if (totalCycles === mysqlCycles.length) {
    console.log('   ✅ All cycles imported successfully!');
  } else {
    console.log('   ⚠️  Some cycles may have failed to import');
  }
  
  // Display imported cycles for verification
  console.log('\n📊 Imported Cycles Summary:');
  activeCycles.forEach((cycle, index) => {
    const startYear = cycle.startYear.getFullYear();
    const endYear = cycle.endYear.getFullYear();
    console.log(`   ${index + 1}. ${cycle.name} (${startYear}-${endYear}) - ID: ${cycle._id}`);
  });
  
  // Check for current cycle
  console.log('\n🕒 Current Cycle Check:');
  const currentCycles = await Cycle.find({ deletedAt: null });
  const now = new Date();
  
  for (const cycle of currentCycles) {
    const isCurrent = now >= cycle.startYear && now <= cycle.endYear;
    console.log(`   ${cycle.name}: ${isCurrent ? '✅ CURRENT' : '⏸️  Not Current'}`);
  }
  
  console.log('\n🎉 Cycles Migration (Step 3) Completed!');
  console.log('📋 Next Steps:');
  console.log('   1. Test React admin panel - check if cycles show up');
  console.log('   2. Verify cycle data is available for parameter forms');
  console.log('   3. Run Step 4: Departments migration (will require faculty mapping)');
  
  // Close connection
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

// Run migration
if (require.main === module) {
  migrateCycles().catch(console.error);
}

module.exports = { migrateCycles };