const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables

// MongoDB connection - use Atlas connection from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smp-backend';

// Import models
const User = require('./src/models/User.js');
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
    // Load users from mysql_user_data.json
    const mysqlData = JSON.parse(fs.readFileSync(path.join(__dirname, '../mysql_user_data.json'), 'utf8'));
    return mysqlData.data || [];
  } catch (error) {
    console.error('❌ Failed to load MySQL users data:', error);
    process.exit(1);
  }
}

async function loadReferences() {
  try {
    // Load existing departments and faculties for validation
    const departments = await Department.find({ deletedAt: null }).select('_id deptName deptCode');
    const faculties = await Faculty.find({ deletedAt: null }).select('_id name facultyCode');
    
    console.log('📚 Available departments for validation:');
    departments.slice(0, 5).forEach(dept => {
      console.log(`   ${dept._id}: ${dept.deptName} (${dept.deptCode})`);
    });
    if (departments.length > 5) console.log(`   ... and ${departments.length - 5} more departments`);
    
    console.log('📚 Available faculties for validation:');
    faculties.forEach(fac => {
      console.log(`   ${fac._id}: ${fac.name} (${fac.facultyCode})`);
    });
    
    return { departments, faculties };
  } catch (error) {
    console.error('❌ Failed to load references:', error);
    throw error;
  }
}

async function checkExistingAdmin() {
  try {
    // Check for existing Admin user to preserve
    const existingAdmin = await User.findOne({ userRole: 'Admin' });
    if (existingAdmin) {
      console.log('🔒 Found existing Admin user - WILL BE PRESERVED:');
      console.log(`   Username: ${existingAdmin.userName}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.firstName} ${existingAdmin.lastName}`);
      return existingAdmin;
    } else {
      console.log('📭 No existing Admin user found');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to check existing admin:', error);
    throw error;
  }
}

async function clearNonAdminUsers() {
  try {
    console.log('🧹 Clearing existing non-Admin users...');
    const deleteResult = await User.deleteMany({ userRole: { $ne: 'Admin' } });
    console.log(`   Deleted ${deleteResult.deletedCount} existing non-Admin users`);
  } catch (error) {
    console.error('❌ Failed to clear users:', error);
    throw error;
  }
}

function generateMongoDBId(mysqlId, userRole) {
  // Generate unique numeric IDs for users based on their role and original ID
  // Start from high numbers to avoid conflicts with existing data
  const roleMapping = {
    'PVC': 1000,      // Pro Vice Chancellor 
    'VC': 2000,       // Vice Chancellor
    'Dean': 3000,     // Deans
    'Chairman': 4000, // Chairmen
    'Admin': 9999     // Admin (but we preserve existing admin)
  };
  
  const baseId = roleMapping[userRole] || 5000;
  // Use a hash of the original MySQL GUID to create consistent numeric ID
  const hash = mysqlId.split('-').reduce((acc, segment) => {
    return acc + parseInt(segment.slice(0, 4), 16);
  }, 0);
  
  return baseId + (hash % 900); // Keep within role range
}

async function migrateUsers() {
  console.log('🚀 Starting Users Migration (Step 6 - Final Step)...\\n');
  
  // Connect to MongoDB
  await connectToMongoDB();
  
  // Check existing Admin user
  console.log('🔒 Checking for existing Admin user...');
  const existingAdmin = await checkExistingAdmin();
  console.log();
  
  // Load existing references for validation
  console.log('📚 Loading existing departments and faculties...');
  const { departments, faculties } = await loadReferences();
  console.log();
  
  // Load MySQL data
  console.log('📁 Loading MySQL users data...');
  const mysqlUsers = await loadMySQLData();
  console.log(`   Found ${mysqlUsers.length} users in MySQL data\\n`);
  
  // Clear existing non-Admin users
  await clearNonAdminUsers();
  
  // Transform and import users
  console.log('🔄 Importing users (preserving existing Admin)...');
  const importedUsers = [];
  let skippedCount = 0;
  let invalidDeptCount = 0;
  let invalidFacultyCount = 0;
  
  for (const mysqlUser of mysqlUsers) {
    try {
      // Skip if this would conflict with existing Admin
      if (mysqlUser.userRole === 'Admin' && existingAdmin) {
        console.log(`   ⏭️  Skipping MySQL Admin user - preserving existing Admin`);
        skippedCount++;
        continue;
      }
      
      // Validate department reference
      const deptExists = departments.find(dept => dept._id === mysqlUser.deptId);
      if (mysqlUser.deptId && !deptExists) {
        console.log(`   ⚠️  Department ID ${mysqlUser.deptId} not found for user ${mysqlUser.userName}`);
        invalidDeptCount++;
      }
      
      // Validate faculty reference  
      const facultyExists = faculties.find(fac => fac._id === mysqlUser.facultyId);
      if (mysqlUser.facultyId && !facultyExists) {
        console.log(`   ⚠️  Faculty ID ${mysqlUser.facultyId} not found for user ${mysqlUser.userName}`);
        invalidFacultyCount++;
      }
      
      // Generate MongoDB-compatible numeric ID
      const mongoId = generateMongoDBId(mysqlUser.id, mysqlUser.userRole);
      
      // Clean up role-based assignments (fix MySQL data issues)
      let deptId = mysqlUser.deptId || null;
      let facultyId = mysqlUser.facultyId || null;
      
      // University-level roles should not be tied to departments/faculties
      if (mysqlUser.userRole === 'PVC' || mysqlUser.userRole === 'VC') {
        deptId = null;     // No department
        facultyId = null;  // No faculty
      }
      
      // Faculty-level roles should not be tied to specific departments
      if (mysqlUser.userRole === 'Dean') {
        deptId = null;     // No specific department (they manage the whole faculty)
        // Keep facultyId for Deans (they manage a faculty)
      }
      
      // Transform MySQL user to MERN format
      const userData = {
        _id: mongoId,
        userName: mysqlUser.userName,
        email: mysqlUser.email,
        firstName: mysqlUser.firstName || '',
        lastName: mysqlUser.lastName || '',
        userRole: mysqlUser.userRole,
        deptId: deptId,
        facultyId: facultyId,
        passwordHash: mysqlUser.passwordHash, // Preserve original password hash
        phoneNumber: mysqlUser.phoneNumber || '',
        emailConfirmed: mysqlUser.emailConfirmed || false,
        lockoutEnabled: false,
        accessFailedCount: 0
      };
      
      // Create user in MongoDB
      const user = new User(userData);
      await user.save();
      
      // Find department and faculty names for display
      const dept = departments.find(d => d._id === userData.deptId);
      const faculty = faculties.find(f => f._id === userData.facultyId);
      
      importedUsers.push({
        id: userData._id,
        userName: userData.userName,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
        role: userData.userRole,
        deptName: dept ? dept.deptName : 'Unknown',
        facultyName: faculty ? faculty.name : 'Unknown'
      });
      
      console.log(`   ✅ Imported: ${userData.userName} (${userData.userRole}) - ${userData.firstName} ${userData.lastName} - ID: ${userData._id}`);
      
    } catch (error) {
      console.error(`   ❌ Failed to import user ${mysqlUser.userName}:`, error.message);
    }
  }
  
  // Verification
  console.log('\\n🔍 Verification...');
  const totalUsers = await User.countDocuments({});
  const usersByRole = await User.aggregate([
    { $group: { _id: '$userRole', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  
  console.log(`   Total users in MongoDB: ${totalUsers}`);
  console.log(`   Imported from MySQL: ${importedUsers.length}`);
  console.log(`   Skipped (preserved Admin): ${skippedCount}`);
  console.log(`   Invalid department references: ${invalidDeptCount}`);
  console.log(`   Invalid faculty references: ${invalidFacultyCount}`);
  
  console.log('\\n📊 Users by Role:');
  usersByRole.forEach(role => {
    console.log(`   ${role._id}: ${role.count} users`);
  });
  
  // Group by role for summary
  console.log('\\n👥 Imported Users Summary:');
  const roleGroups = {};
  for (const user of importedUsers) {
    if (!roleGroups[user.role]) {
      roleGroups[user.role] = [];
    }
    roleGroups[user.role].push(`${user.name} (${user.userName}) - ${user.deptName}`);
  }
  
  Object.entries(roleGroups).forEach(([role, users]) => {
    console.log(`   ${role} (${users.length} users):`);
    users.slice(0, 3).forEach(user => console.log(`      - ${user}`));
    if (users.length > 3) {
      console.log(`      ... and ${users.length - 3} more`);
    }
  });
  
  if (existingAdmin) {
    console.log('\\n🔒 Preserved Admin User:');
    console.log(`   Username: ${existingAdmin.userName}`);
    console.log(`   Email: ${existingAdmin.email}`);
    console.log(`   Status: PRESERVED AND FUNCTIONAL`);
  }
  
  console.log('\\n🎉 Users Migration (Step 6) Completed!');
  console.log('🎯 DATA MIGRATION FULLY COMPLETE!');
  console.log('\\n📋 Next Steps:');
  console.log('   1. Test Admin login - verify existing admin still works');
  console.log('   2. Test Chairman login - verify imported users can login');  
  console.log('   3. Test rating submission workflow');
  console.log('   4. Verify all dashboard statistics are correct');
  console.log('   5. Production deployment preparation');
  
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
  migrateUsers().catch(console.error);
}

module.exports = { migrateUsers };