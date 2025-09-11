const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables

// MongoDB connection - use Atlas connection from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smp-backend';

// Import Category model (now relative path works correctly)
const Category = require('./src/models/Category.js');

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
    return exportedData.categories.data || [];
  } catch (error) {
    console.error('❌ Failed to load MySQL data:', error);
    process.exit(1);
  }
}

async function clearCategories() {
  try {
    console.log('🧹 Clearing existing categories...');
    const deleteResult = await Category.deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} existing categories`);
  } catch (error) {
    console.error('❌ Failed to clear categories:', error);
    throw error;
  }
}

async function migrateCategories() {
  console.log('🚀 Starting Categories Migration (Step 1)...\n');
  
  // Connect to MongoDB
  await connectToMongoDB();
  
  // Load MySQL data
  console.log('📁 Loading MySQL categories data...');
  const mysqlCategories = await loadMySQLData();
  console.log(`   Found ${mysqlCategories.length} categories in MySQL data\n`);
  
  // Clear existing categories (hard delete since you manually cleaned)
  await clearCategories();
  
  // Transform and import categories
  console.log('🔄 Importing categories...');
  const importedCategories = [];
  
  for (const mysqlCategory of mysqlCategories) {
    try {
      // Transform MySQL category to MERN format
      const categoryData = {
        _id: mysqlCategory.id,
        name: mysqlCategory.name,
        description: mysqlCategory.desc || '',
        sortOrder: mysqlCategory.sortOrder || 0,
        deletedAt: null // Ensure active status
      };
      
      // Create category in MongoDB
      const category = new Category(categoryData);
      await category.save();
      
      importedCategories.push({
        id: categoryData._id,
        name: categoryData.name
      });
      
      console.log(`   ✅ Imported: ${categoryData.name} (ID: ${categoryData._id})`);
      
    } catch (error) {
      console.error(`   ❌ Failed to import category ${mysqlCategory.name}:`, error.message);
    }
  }
  
  // Verification
  console.log('\n🔍 Verification...');
  const totalCategories = await Category.countDocuments({ deletedAt: null });
  const activeCategories = await Category.find({ deletedAt: null }).select('_id name');
  
  console.log(`   Total categories in MongoDB: ${totalCategories}`);
  console.log(`   Active categories: ${activeCategories.length}`);
  
  if (totalCategories === mysqlCategories.length) {
    console.log('   ✅ All categories imported successfully!');
  } else {
    console.log('   ⚠️  Some categories may have failed to import');
  }
  
  // Display imported categories for verification
  console.log('\n📊 Imported Categories Summary:');
  activeCategories.forEach((cat, index) => {
    console.log(`   ${index + 1}. ${cat.name} (ID: ${cat._id})`);
  });
  
  console.log('\n🎉 Categories Migration (Step 1) Completed!');
  console.log('📋 Next Steps:');
  console.log('   1. Test React dashboard - check if categories show up');
  console.log('   2. Verify category cards display with correct counts');
  console.log('   3. Run Step 2: Faculties migration');
  
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
  migrateCategories().catch(console.error);
}

module.exports = { migrateCategories };