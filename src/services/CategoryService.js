const Category = require('../models/Category');
const Counter = require('../models/Counter');
const HelperService = require('./HelperService');

class CategoryService {
  // Get categories with pagination and search (exact replica with complex logic)
  async getCategoriesAsync(page = 1, pageSize = 10, search = null, context) {
    try {
      const currentUser = await HelperService.getLoggedUser(context);
      const skip = (page - 1) * pageSize;
      
      // Build base query
      let query = { deletedAt: null };
      if (search && search.trim()) {
        query.name = { $regex: search, $options: 'i' };
      }

      // Complex aggregation to match .NET logic exactly
      const Parameter = require('../models/Parameter');
      const YearlyRating = require('../models/YearlyRating');

      const categories = await Category.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'Parameters',
            let: { categoryName: '$name' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$category', '$$categoryName'] },
                  deletedAt: null,
                  isActive: true
                }
              }
            ],
            as: 'parameters'
          }
        },
        {
          $lookup: {
            from: 'YearlyRatings',
            let: { categoryId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$categoryId', '$$categoryId'] },
                  userId: currentUser ? currentUser._id.toString() : null,
                  deletedAt: null
                }
              },
              {
                $match: {
                  $or: [
                    { 'ratingValues.0.projectedValue': { $gt: 0 } },
                    { 'ratingValues.0.actualValue': { $gt: 0 } }
                  ]
                }
              }
            ],
            as: 'submittedRatings'
          }
        },
        {
          $project: {
            Id: '$_id',
            Name: '$name',
            Desc: { $ifNull: ['$description', ''] },
            SortOrder: '$sortOrder',
            TotalCount: { $size: '$parameters' },
            SubmittedCount: { $size: '$submittedRatings' },
            createdAt: 1
          }
        },
        { $sort: { SortOrder: -1 } },
        { $skip: skip },
        { $limit: pageSize },
        { $sort: { Id: 1 } }
      ]);

      // Get total count
      const totalCount = await Category.countDocuments(query);

      return {
        List: categories,
        Count: totalCount
      };
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  // Get single category by ID (exact replica)
  async getCategoryAsync(id) {
    try {
      const category = await Category.findOne({
        _id: id,
        deletedAt: null
      });

      return category;
    } catch (error) {
      console.error('Error getting category:', error);
      throw error;
    }
  }

  // Create category (exact replica with auto-increment ID)
  async createCategoryAsync(categoryData) {
    try {
      // Generate auto-increment ID
      const categoryId = await Counter.getNextSequence('category');
      
      const newCategory = new Category({
        _id: categoryId,
        name: categoryData.Name || categoryData.name,
        description: categoryData.Description || categoryData.description,
        sortOrder: categoryData.SortOrder || categoryData.sortOrder || 0
      });

      const savedCategory = await newCategory.save();
      return savedCategory;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  // Update category (exact replica)
  async updateCategoryAsync(category, categoryData) {
    try {
      if (!category) {
        throw new Error('Category not found');
      }

      // Update fields
      category.name = categoryData.Name || categoryData.name || category.name;
      category.description = categoryData.Description || categoryData.description || category.description;
      category.sortOrder = categoryData.SortOrder !== undefined ? 
        (categoryData.SortOrder || categoryData.sortOrder) : category.sortOrder;
      category.updatedAt = new Date();

      const updatedCategory = await category.save();
      return updatedCategory;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  // Delete category (soft delete - exact replica)
  async deleteCategoryAsync(category) {
    try {
      if (!category) {
        return false;
      }

      // Soft delete
      category.deletedAt = new Date();
      await category.save();
      
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      return false;
    }
  }

  // Get all active categories (helper method)
  async getAllActiveCategories() {
    try {
      const categories = await Category.find({ deletedAt: null })
        .sort({ sortOrder: 1, name: 1 });

      return categories;
    } catch (error) {
      console.error('Error getting all active categories:', error);
      throw error;
    }
  }

  // Check if category name exists (helper method)
  async categoryNameExists(name, excludeId = null) {
    try {
      let query = { 
        name: { $regex: new RegExp(`^${name}$`, 'i') }, // Case-insensitive exact match
        deletedAt: null 
      };

      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const existing = await Category.findOne(query);
      return !!existing;
    } catch (error) {
      console.error('Error checking category name:', error);
      return false;
    }
  }
}

module.exports = new CategoryService();