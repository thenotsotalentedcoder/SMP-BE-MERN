const CategoryService = require('../services/CategoryService');

class CategoryController {
  // GET /api/category (exact replica)
  async getCategories(req, res) {
    try {
      const { page = 1, pageSize = 10, search = null } = req.query;

      const categories = await CategoryService.getCategoriesAsync(
        parseInt(page), 
        parseInt(pageSize), 
        search, 
        req // Pass request context
      );

      return res.json({
        Status: true,
        Data: categories.List,
        TotalCount: categories.Count,
        Page: parseInt(page),
        PageSize: parseInt(pageSize),
        Message: "categories Fetched!"
      });

    } catch (error) {
      console.error('Get categories error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/category/:id (exact replica)
  async getCategory(req, res) {
    try {
      const { id } = req.params;

      const category = await CategoryService.getCategoryAsync(id);

      if (!category) {
        return res.status(404).json({
          Status: false,
          Message: "Category not found"
        });
      }

      return res.json({
        Status: true,
        Data: category
      });

    } catch (error) {
      console.error('Get category error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // POST /api/category (exact replica)
  async createCategory(req, res) {
    try {
      const categoryData = req.body;

      const createdCategory = await CategoryService.createCategoryAsync(categoryData);

      return res.json({
        Status: true,
        Data: createdCategory,
        Message: "Category created successfully!"
      });

    } catch (error) {
      console.error('Create category error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // PUT /api/category/:id (exact replica)
  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const categoryData = req.body;

      const category = await CategoryService.getCategoryAsync(id);
      if (!category) {
        return res.status(404).json({
          Status: false,
          Message: "Category not found"
        });
      }

      const updatedCategory = await CategoryService.updateCategoryAsync(category, categoryData);

      return res.json({
        Status: true,
        Data: updatedCategory,
        Message: "Category updated successfully!"
      });

    } catch (error) {
      console.error('Update category error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // DELETE /api/category/:id (exact replica)
  async deleteCategory(req, res) {
    try {
      const { id } = req.params;

      const category = await CategoryService.getCategoryAsync(id);
      if (!category) {
        return res.status(404).json({
          Status: false,
          Message: "Category not found"
        });
      }

      const deleted = await CategoryService.deleteCategoryAsync(category);
      
      if (deleted) {
        return res.status(204).send(); // No content
      } else {
        return res.status(500).json({
          Status: false,
          Message: "Failed to delete category"
        });
      }

    } catch (error) {
      console.error('Delete category error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }
}

module.exports = new CategoryController();