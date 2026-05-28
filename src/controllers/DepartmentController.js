const DepartmentService = require('../services/DepartmentService');

class DepartmentController {
  // GET /api/departments (exact replica)
  async getDepartments(req, res) {
    try {
      const { page = 1, pageSize = 10, search = null, facultyId = null } = req.query;

      const departments = await DepartmentService.getDepartmentsAsync(
        parseInt(page),
        parseInt(pageSize),
        search,
        facultyId
      );

      return res.json({
        Status: true,
        Data: departments.List,
        TotalCount: departments.Count,
        Page: parseInt(page),
        PageSize: parseInt(pageSize),
        Message: "departments Fetched!"
      });

    } catch (error) {
      console.error('Get departments error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/departments/:id (exact replica)
  async getDepartment(req, res) {
    try {
      const { id } = req.params;

      const department = await DepartmentService.getDepartmentAsync(id);

      if (!department) {
        return res.status(404).json({
          Status: false,
          Message: "Department not found"
        });
      }

      return res.json({
        Status: true,
        Data: department
      });

    } catch (error) {
      console.error('Get department error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // POST /api/departments (exact replica)
  async createDepartment(req, res) {
    try {
      const departmentData = req.body;

      const createdDepartment = await DepartmentService.createDepartmentAsync(departmentData);

      return res.json({
        Status: true,
        Data: createdDepartment,
        Message: "Department created successfully!"
      });

    } catch (error) {
      console.error('Create department error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // PUT /api/departments/:id (MISSING - exact replica)
  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const departmentData = req.body;

      const department = await DepartmentService.getDepartmentAsync(id);
      if (!department) {
        return res.status(404).json({
          Status: false,
          Message: "Department not found"
        });
      }

      const updatedDepartment = await DepartmentService.updateDepartmentAsync(department, departmentData);

      return res.json({
        Status: true,
        Data: updatedDepartment,
        Message: "Department updated successfully!"
      });

    } catch (error) {
      console.error('Update department error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // DELETE /api/departments/:id (exact replica)
  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;

      const department = await DepartmentService.getDepartmentAsync(id);
      if (!department) {
        return res.status(404).json({
          Status: false,
          Message: "Department not found"
        });
      }

      const deleted = await DepartmentService.deleteDepartmentAsync(department);
      
      if (deleted) {
        return res.status(204).send(); // No content
      } else {
        return res.status(500).json({
          Status: false,
          Message: "Failed to delete department"
        });
      }

    } catch (error) {
      console.error('Delete department error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }
}

module.exports = new DepartmentController();