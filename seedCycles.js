const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Cycle = require('./src/models/Cycle');
const Counter = require('./src/models/Counter');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Seed cycles
async function seedCycles() {
  try {
    console.log('🌱 Starting cycle seeding...');

    // Check if cycles already exist
    const existingCycles = await Cycle.countDocuments({ deletedAt: null });
    if (existingCycles > 0) {
      console.log(`✅ Cycles already exist (${existingCycles} cycles found). Skipping seed.`);
      return;
    }

    // Academic year cycles (2024-2025 through 2029-2030)
    const cyclesToCreate = [];
    for (let startYear = 2024; startYear <= 2029; startYear++) {
      const endYear = startYear + 1;
      cyclesToCreate.push({
        name: `${startYear}-${endYear}`,
        startYear: new Date(`${startYear}-09-01`), // Academic year starts in September
        endYear: new Date(`${endYear}-08-31`)     // Academic year ends in August
      });
    }

    console.log(`📋 Creating ${cyclesToCreate.length} cycles...`);

    // Create cycles with auto-increment IDs
    for (const cycleData of cyclesToCreate) {
      try {
        // Generate auto-increment ID
        const cycleId = await Counter.getNextSequence('cycle');
        
        const cycle = new Cycle({
          _id: cycleId,
          name: cycleData.name,
          startYear: cycleData.startYear,
          endYear: cycleData.endYear
        });

        await cycle.save();
        console.log(`  ✅ Created cycle: ${cycleData.name} (ID: ${cycleId})`);
      } catch (error) {
        console.error(`  ❌ Failed to create cycle '${cycleData.name}':`, error.message);
      }
    }

    console.log('🎉 Cycle seeding completed!');
    
  } catch (error) {
    console.error('❌ Error seeding cycles:', error);
  }
}

// Main execution
async function main() {
  await connectDB();
  await seedCycles();
  
  // Close connection
  await mongoose.connection.close();
  console.log('🔚 Database connection closed');
  process.exit(0);
}

// Run the seeding
main().catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});