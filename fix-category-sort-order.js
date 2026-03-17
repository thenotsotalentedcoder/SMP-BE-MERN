/**
 * One-time fix: update sortOrder for all categories from 2024 to 1-12
 * Categories are sorted by _id ascending, then assigned sortOrder 1, 2, 3...
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./src/models/Category');

async function fixSortOrder() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const categories = await Category.find({ deletedAt: null }).sort({ _id: 1 });
  console.log(`Found ${categories.length} categories`);

  for (let i = 0; i < categories.length; i++) {
    const newOrder = i + 1;
    await Category.updateOne({ _id: categories[i]._id }, { $set: { sortOrder: newOrder } });
    console.log(`  Updated "${categories[i].name}" (_id: ${categories[i]._id}) → sortOrder: ${newOrder}`);
  }

  console.log('\nDone!');
  await mongoose.disconnect();
}

fixSortOrder().catch(err => {
  console.error(err);
  process.exit(1);
});
