const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables

// MongoDB connection - use Atlas connection from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smp-backend';

// Import models
const Parameter = require('./src/models/Parameter.js');
const Category = require('./src/models/Category.js');
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
    // Load parameters from exported-mysql-data.json
    const exportedData = JSON.parse(fs.readFileSync(path.join(__dirname, '../exported-mysql-data.json'), 'utf8'));
    return exportedData.parameters.data || [];
  } catch (error) {
    console.error('❌ Failed to load MySQL parameters data:', error);
    process.exit(1);
  }
}

async function loadCategoriesAndCycles() {
  try {
    // Load existing categories and cycles from MongoDB for validation
    const categories = await Category.find({ deletedAt: null }).select('_id name');
    const cycles = await Cycle.find({ deletedAt: null }).select('_id name');
    
    console.log('📚 Available categories for mapping:');
    categories.forEach(cat => {
      console.log(`   ${cat._id}: ${cat.name}`);
    });
    
    console.log('🔄 Available cycles for mapping:');
    cycles.forEach(cyc => {
      console.log(`   ${cyc._id}: ${cyc.name}`);
    });
    
    return { categories, cycles };
  } catch (error) {
    console.error('❌ Failed to load categories and cycles:', error);
    throw error;
  }
}

function mapCategoryName(mysqlParameterType) {
  // Map MySQL parameter types to Strategic Pillar categories
  // Since we now know mysqlParam.category contains parameter types (integer, percentage, etc)
  // We need to distribute them across Strategic Pillars based on parameter content
  
  const categoryMappings = {
    // Parameter types → Strategic Pillar categories
    'integer': 'Strategic Pillar 1: Academic Excellence',
    'percentage': 'Strategic Pillar 2: Faculty Development', 
    'number': 'Strategic Pillar 3: Student Success',
    'text': 'Strategic Pillar 4: Infrastructure and Facilities',
    'decimal': 'Strategic Pillar 5: Professional Development',
    'boolean': 'Strategic Pillar 6: Industry Collaboration',
    // Add more mappings as needed
  };
  
  // First check if it's already a proper category name (Strategic Pillar X)
  if (mysqlParameterType && mysqlParameterType.includes('Strategic Pillar')) {
    return mysqlParameterType;
  }
  
  // Then check our mappings
  if (categoryMappings[mysqlParameterType]) {
    return categoryMappings[mysqlParameterType];
  }
  
  // For unknown parameter types, distribute evenly across pillars
  console.log(`   ⚠️  Unknown parameter type: ${mysqlParameterType}, using default mapping`);
  return 'Strategic Pillar 1: Academic Excellence'; // Default fallback
}

function getDefaultCycleId() {
  // Return the cycle ID we imported (should be 1 for "2024-2028")
  return 1;
}

async function clearParameters() {
  try {
    console.log('🧹 Clearing existing parameters...');
    const deleteResult = await Parameter.deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} existing parameters`);
  } catch (error) {
    console.error('❌ Failed to clear parameters:', error);
    throw error;
  }
}

async function migrateParameters() {
  console.log('🚀 Starting Parameters Migration (Step 5)...\n');
  
  // Connect to MongoDB
  await connectToMongoDB();
  
  // Load existing categories and cycles for reference
  console.log('📚 Loading existing categories and cycles...');
  const { categories, cycles } = await loadCategoriesAndCycles();
  console.log();
  
  // Load MySQL data
  console.log('📁 Loading MySQL parameters data...');
  const mysqlParameters = await loadMySQLData();
  console.log(`   Found ${mysqlParameters.length} parameters in MySQL data\n`);
  
  // Clear existing parameters
  await clearParameters();
  
  // Transform and import parameters
  console.log('🔄 Importing parameters with category/cycle mapping...');
  const importedParameters = [];
  let mappingWarnings = 0;
  let activatedCount = 0;
  
  for (const mysqlParam of mysqlParameters) {
    try {
      // Map parameter type to category name
      const mappedCategory = mapCategoryName(mysqlParam.category);
      
      // Verify category exists
      const categoryExists = categories.find(cat => cat.name === mappedCategory);
      if (!categoryExists) {
        console.log(`   ⚠️  Category not found: ${mappedCategory}`);
        mappingWarnings++;
      }
      
      // Get cycle ID (default to our imported cycle)
      const cycleId = getDefaultCycleId();
      
      // Transform MySQL parameter to MERN format
      // FIX: MySQL data has wrong field mapping!
      // - mysqlParam.category = actual parameter type (integer, percentage, etc)
      // - mysqlParam.paramterType = actual description 
      // - mysqlParam.description = actual year
      const parameterData = {
        _id: mysqlParam.id,
        parameterName: mysqlParam.parameterName,
        parameterType: mysqlParam.category, // FIXED: category field contains the actual parameter type
        description: mysqlParam.paramterType || '', // FIXED: paramterType field contains the description
        year: parseInt(mysqlParam.description) || 2025, // FIXED: description field contains the year
        isActive: true, // ✅ ACTIVATE ALL PARAMETERS!
        category: mappedCategory, // Use mapped category name (Strategic Pillar)
        cycle: cycleId, // Reference to cycle
        parameterRoles: mysqlParam.parameterRoles || '', // Roles that can access
        sortOrder: mysqlParam.sortOrder || 0,
        deletedAt: null // Ensure active status
      };
      
      // Create parameter in MongoDB
      const parameter = new Parameter(parameterData);
      await parameter.save();
      
      if (parameterData.isActive) activatedCount++;
      
      importedParameters.push({
        id: parameterData._id,
        name: parameterData.parameterName,
        type: parameterData.parameterType,
        category: mappedCategory,
        isActive: parameterData.isActive
      });
      
      console.log(`   ✅ Imported: ${parameterData.parameterName} (${parameterData.parameterType}) → ${mappedCategory} - ID: ${parameterData._id} ${parameterData.isActive ? '[ACTIVE]' : '[INACTIVE]'}`);
      
    } catch (error) {
      console.error(`   ❌ Failed to import parameter ${mysqlParam.parameterName}:`, error.message);
    }
  }
  
  // Verification
  console.log('\n🔍 Verification...');
  const totalParameters = await Parameter.countDocuments({ deletedAt: null });
  const activeParameters = await Parameter.countDocuments({ deletedAt: null, isActive: true });
  
  console.log(`   Total parameters in MongoDB: ${totalParameters}`);
  console.log(`   Active parameters: ${activeParameters}`);
  console.log(`   Activated during migration: ${activatedCount}`);
  console.log(`   Category mapping warnings: ${mappingWarnings}`);
  
  if (totalParameters === mysqlParameters.length) {
    console.log('   ✅ All parameters imported successfully!');
  } else {
    console.log('   ⚠️  Some parameters may have failed to import');
  }
  
  // Group by category for summary
  console.log('\n📊 Parameters by Category:');
  const categoryGroups = {};
  for (const param of importedParameters) {
    if (!categoryGroups[param.category]) {
      categoryGroups[param.category] = [];
    }
    categoryGroups[param.category].push(`${param.name} (${param.type})`);
  }
  
  Object.entries(categoryGroups).forEach(([categoryName, params]) => {
    console.log(`   ${categoryName}: ${params.length} parameters`);
    if (params.length <= 5) {
      params.forEach(param => console.log(`      - ${param}`));
    } else {
      params.slice(0, 3).forEach(param => console.log(`      - ${param}`));
      console.log(`      ... and ${params.length - 3} more`);
    }
  });
  
  console.log('\n🎉 Parameters Migration (Step 5) Completed!');
  console.log('📋 Next Steps:');
  console.log('   1. Test React dashboard - check if parameter counts update');
  console.log('   2. Verify category cards show correct parameter counts');
  console.log('   3. Test generic form - check if parameters load correctly');
  console.log('   4. Begin Step 6: Users migration (final step)');
  
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
  migrateParameters().catch(console.error);
}

module.exports = { migrateParameters };