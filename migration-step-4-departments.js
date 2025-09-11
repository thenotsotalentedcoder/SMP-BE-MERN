const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables

// MongoDB connection - use Atlas connection from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smp-backend';

// Import models
const Department = require('./src/models/Department.js');
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
    // Load departments from mysql_data.json (not exported-mysql-data.json)
    const mysqlData = JSON.parse(fs.readFileSync(path.join(__dirname, '../mysql_data.json'), 'utf8'));
    return mysqlData.data || [];
  } catch (error) {
    console.error('❌ Failed to load MySQL departments data:', error);
    process.exit(1);
  }
}

async function loadFaculties() {
  try {
    // Load existing faculties from MongoDB to create mapping
    const faculties = await Faculty.find({ deletedAt: null }).select('_id name facultyCode');
    console.log('📚 Available faculties for mapping:');
    faculties.forEach(fac => {
      console.log(`   ${fac._id}: ${fac.name} (${fac.facultyCode})`);
    });
    return faculties;
  } catch (error) {
    console.error('❌ Failed to load faculties:', error);
    throw error;
  }
}

function mapDepartmentToFaculty(deptCode, deptName) {
  // Enhanced mapping based on department codes and names
  // This is necessary because MySQL departments have faculty: null
  
  const mappings = {
    // Faculty of Electrical and Computer Engineering (24)
    'EE': 24,       // Electrical Engineering
    'CS': 24,       // Computer Science
    'CT': 24,       // Computer Science & Information Technology  
    'SE': 24,       // Software Engineering
    'TCT': 24,      // Computer Science and Technology [TIEST]
    'TE': 24,       // Textile Engineering (ECE related)
    'BM': 24,       // Bio-Medical Engineering
    'TC': 24,       // Telecommunications Engineering
    'EL': 24,       // Electronic Engineering
    
    // Faculty of Chemical & Process Engineering (27)  
    'CH': 27,       // Chemical Engineering
    'PE': 27,       // Petroleum Engineering 
    'FD': 27,       // Food Engineering
    'PP': 27,       // Polymer and Petrochemical Engineering
    
    // Faculty of Mechanical and Manufacturing Engineering (26)
    'ME': 26,       // Mechanical Engineering
    'IM': 26,       // Industrial and Manufacturing Engineering
    'MM': 26,       // Materials Engineering
    'MY': 26,       // Metallurgical Engineering
    'AU': 26,       // Automotive and Marine Engineering
    
    // Faculty of Civil and Petroleum Engineering (25)
    'CE': 25,       // Civil Engineering (NOT computer!)
    'TCE': 25,      // Civil Engineering [TIEST]
    'EN': 25,       // Environmental Engineering
    'UE': 25,       // Urban and Infrastructure Engineering
    'EQ': 25,       // Earthquake Engineering
    
    // Faculty of Architecture & Sciences (28)
    'IC': 28,       // Chemistry
    'PH': 28,       // Physics
    'MT': 28,       // Mathematics
    'B.Arch': 28,   // Architecture and Planning
    
    // Administration (29)
    'DIL': 29,      // Directorate of Industrial Liaison
    'CCEE': 29,     // NED Academy
    'UAFA': 29,     // University Advancement & Financial Assistance
    'ITD': 29,      // Information Technology Department
    'QEC': 29,      // Quality Enhancement Cell
    'MED': 29,      // Medical Center
    'Library': 29,  // Library
    'Registrar': 29,// Registrar
    'DWS': 29,      // Directorate of Works and Services
    'CSA': 29,      // Controller Students Affairs
    'ORIC': 29,     // Office of Research, Innovation and Commercialization
    'DF': 29,       // Directorate of Finance
    'ES': 29,       // Essential Studies
    'EG': 29,       // English Linguistics
    'MG': 29,       // Economics and Management Sciences
  };
  
  // First try exact deptCode match
  if (mappings[deptCode]) {
    return mappings[deptCode];
  }
  
  // Then try partial matches in department name for any missed cases
  const nameLower = deptName.toLowerCase();
  
  if (nameLower.includes('electrical') || nameLower.includes('electronic') || 
      nameLower.includes('computer') || nameLower.includes('software') ||
      nameLower.includes('biomedical') || nameLower.includes('telecommunication')) return 24;
      
  if (nameLower.includes('chemical') || nameLower.includes('food') || 
      nameLower.includes('polymer')) return 27;
      
  if (nameLower.includes('mechanical') || nameLower.includes('industrial') || 
      nameLower.includes('materials') || nameLower.includes('metallurgical') ||
      nameLower.includes('automotive')) return 26;
      
  if (nameLower.includes('civil') || nameLower.includes('environmental') || 
      nameLower.includes('urban') || nameLower.includes('earthquake')) return 25;
      
  if (nameLower.includes('architecture') || nameLower.includes('physics') || 
      nameLower.includes('chemistry') || nameLower.includes('mathematics')) return 28;
  
  // Special case for petroleum
  if (nameLower.includes('petroleum')) return 27;
  
  // Default to Administration for truly unknown departments
  console.log(`   ⚠️  Unknown department mapping: ${deptCode} - ${deptName}, defaulting to Administration`);
  return 29;
}

async function clearDepartments() {
  try {
    console.log('🧹 Clearing existing departments...');
    const deleteResult = await Department.deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} existing departments`);
  } catch (error) {
    console.error('❌ Failed to clear departments:', error);
    throw error;
  }
}

async function migrateDepartments() {
  console.log('🚀 Starting Departments Migration (Step 4)...\n');
  
  // Connect to MongoDB
  await connectToMongoDB();
  
  // Load existing faculties for reference
  console.log('📚 Loading existing faculties...');
  const faculties = await loadFaculties();
  console.log();
  
  // Load MySQL data
  console.log('📁 Loading MySQL departments data...');
  const mysqlDepartments = await loadMySQLData();
  console.log(`   Found ${mysqlDepartments.length} departments in MySQL data\n`);
  
  // Clear existing departments
  await clearDepartments();
  
  // Transform and import departments
  console.log('🔄 Importing departments with faculty mapping...');
  const importedDepartments = [];
  let mappingWarnings = 0;
  
  for (const mysqlDept of mysqlDepartments) {
    try {
      // Map department to faculty
      const facultyId = mapDepartmentToFaculty(mysqlDept.deptCode, mysqlDept.deptName);
      
      // Transform MySQL department to MERN format
      const departmentData = {
        _id: mysqlDept.id,
        deptCode: mysqlDept.deptCode,
        deptName: mysqlDept.deptName,
        faculty: facultyId, // Mapped faculty ID
        deletedAt: null // Ensure active status
      };
      
      // Create department in MongoDB
      const department = new Department(departmentData);
      await department.save();
      
      // Find faculty name for display
      const faculty = faculties.find(f => f._id === facultyId);
      const facultyName = faculty ? faculty.facultyCode : 'Unknown';
      
      importedDepartments.push({
        id: departmentData._id,
        name: departmentData.deptName,
        code: departmentData.deptCode,
        facultyId: facultyId,
        facultyName: facultyName
      });
      
      if (facultyId === 29) mappingWarnings++;
      
      console.log(`   ✅ Imported: ${departmentData.deptName} (${departmentData.deptCode}) → ${facultyName} Faculty - ID: ${departmentData._id}`);
      
    } catch (error) {
      console.error(`   ❌ Failed to import department ${mysqlDept.deptName}:`, error.message);
    }
  }
  
  // Verification
  console.log('\n🔍 Verification...');
  const totalDepartments = await Department.countDocuments({ deletedAt: null });
  const activeDepartments = await Department.find({ deletedAt: null }).select('_id deptName deptCode faculty');
  
  console.log(`   Total departments in MongoDB: ${totalDepartments}`);
  console.log(`   Active departments: ${activeDepartments.length}`);
  console.log(`   Mapping warnings (defaulted to Admin): ${mappingWarnings}`);
  
  if (totalDepartments === mysqlDepartments.length) {
    console.log('   ✅ All departments imported successfully!');
  } else {
    console.log('   ⚠️  Some departments may have failed to import');
  }
  
  // Group by faculty for summary
  console.log('\n📊 Departments by Faculty:');
  const facultyGroups = {};
  for (const dept of importedDepartments) {
    if (!facultyGroups[dept.facultyName]) {
      facultyGroups[dept.facultyName] = [];
    }
    facultyGroups[dept.facultyName].push(`${dept.name} (${dept.code})`);
  }
  
  Object.entries(facultyGroups).forEach(([facultyName, depts]) => {
    console.log(`   ${facultyName} Faculty: ${depts.length} departments`);
    depts.forEach(dept => console.log(`      - ${dept}`));
  });
  
  console.log('\n🎉 Departments Migration (Step 4) Completed!');
  console.log('📋 Next Steps:');
  console.log('   1. Test React admin panel - check if departments show up');
  console.log('   2. Verify department-faculty relationships in dropdowns');
  console.log('   3. Run Step 5: Parameters migration');
  
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
  migrateDepartments().catch(console.error);
}

module.exports = { migrateDepartments };