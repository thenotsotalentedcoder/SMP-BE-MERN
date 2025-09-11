const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables

// MongoDB connection - use Atlas connection from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smp-backend';

// Import Faculty model
const Faculty = require('./src/models/Faculty.js');

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
    return exportedData.faculties.data || [];
  } catch (error) {
    console.error('❌ Failed to load MySQL data:', error);
    process.exit(1);
  }
}

async function clearFaculties() {
  try {
    console.log('🧹 Clearing existing faculties...');
    const deleteResult = await Faculty.deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} existing faculties`);
  } catch (error) {
    console.error('❌ Failed to clear faculties:', error);
    throw error;
  }
}

async function migrateFaculties() {
  console.log('🚀 Starting Faculties Migration (Step 2)...\n');
  
  // Connect to MongoDB
  await connectToMongoDB();
  
  // Load MySQL data
  console.log('📁 Loading MySQL faculties data...');
  const mysqlFaculties = await loadMySQLData();
  console.log(`   Found ${mysqlFaculties.length} faculties in MySQL data\n`);
  
  // Clear existing faculties (hard delete since manually cleaned)
  await clearFaculties();
  
  // Transform and import faculties
  console.log('🔄 Importing faculties...');
  const importedFaculties = [];
  
  for (const mysqlFaculty of mysqlFaculties) {
    try {
      // Transform MySQL faculty to MERN format
      const facultyData = {
        _id: mysqlFaculty.id,
        name: mysqlFaculty.name.trim(), // Clean up any extra spaces
        facultyCode: mysqlFaculty.facultyCode.trim(),
        deletedAt: null // Ensure active status
      };
      
      // Create faculty in MongoDB
      const faculty = new Faculty(facultyData);
      await faculty.save();
      
      importedFaculties.push({
        id: facultyData._id,
        name: facultyData.name,
        code: facultyData.facultyCode
      });
      
      console.log(`   ✅ Imported: ${facultyData.name} (${facultyData.facultyCode}) - ID: ${facultyData._id}`);
      
    } catch (error) {
      console.error(`   ❌ Failed to import faculty ${mysqlFaculty.name}:`, error.message);
    }
  }
  
  // Verification
  console.log('\n🔍 Verification...');
  const totalFaculties = await Faculty.countDocuments({ deletedAt: null });
  const activeFaculties = await Faculty.find({ deletedAt: null }).select('_id name facultyCode');
  
  console.log(`   Total faculties in MongoDB: ${totalFaculties}`);
  console.log(`   Active faculties: ${activeFaculties.length}`);
  
  if (totalFaculties === mysqlFaculties.length) {
    console.log('   ✅ All faculties imported successfully!');
  } else {
    console.log('   ⚠️  Some faculties may have failed to import');
  }
  
  // Display imported faculties for verification
  console.log('\n📊 Imported Faculties Summary:');
  activeFaculties.forEach((fac, index) => {
    console.log(`   ${index + 1}. ${fac.name} (${fac.facultyCode}) - ID: ${fac._id}`);
  });
  
  console.log('\n🎉 Faculties Migration (Step 2) Completed!');
  console.log('📋 Next Steps:');
  console.log('   1. Test React admin panel - check if faculties show up');
  console.log('   2. Verify faculty dropdowns work in user/department forms');
  console.log('   3. Run Step 3: Cycles migration');
  
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
  migrateFaculties().catch(console.error);
}

module.exports = { migrateFaculties };