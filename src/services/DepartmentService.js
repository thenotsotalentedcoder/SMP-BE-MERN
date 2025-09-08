const Department = require('../models/Department');
const Faculty = require('../models/Faculty');
const Counter = require('../models/Counter');

class DepartmentService {
  // Get departments with pagination and search (exact replica)
  async getDepartmentsAsync(page = 1, pageSize = 10, search = null) {
    try {
      const skip = (page - 1) * pageSize;
      
      // Build query
      let query = { deletedAt: null };
      
      if (search && search.trim()) {
        query.$or = [
          { deptName: { $regex: search, $options: 'i' } },
          { deptCode: { $regex: search, $options: 'i' } }
        ];
      }

      // Get total count
      const totalCount = await Department.countDocuments(query);
      
      // Get departments with pagination and populate faculty
      const departments = await Department.find(query)
        .populate({
          path: 'faculty',
          match: { deletedAt: null } // Only active faculties
        })
        .sort({ deptName: 1 })
        .skip(skip)
        .limit(pageSize);

      return {
        List: departments,
        Count: totalCount
      };
    } catch (error) {
      console.error('Error getting departments:', error);
      throw error;
    }
  }

  // Get single department by ID (exact replica)
  async getDepartmentAsync(id) {
    try {
      const department = await Department.findOne({
        _id: id,
        deletedAt: null
      }).populate({
        path: 'faculty',
        match: { deletedAt: null }
      });

      return department;
    } catch (error) {
      console.error('Error getting department:', error);
      throw error;
    }
  }

  // Create department (exact replica with auto-increment ID)
  async createDepartmentAsync(departmentData) {
    try {
      // Validate faculty exists
      if (departmentData.Faculty || departmentData.faculty) {
        const facultyId = departmentData.Faculty || departmentData.faculty;
        const faculty = await Faculty.findOne({
          _id: facultyId,
          deletedAt: null
        });
        
        if (!faculty) {
          throw new Error('Faculty not found');
        }
      }

      // Generate auto-increment ID
      const departmentId = await Counter.getNextSequence('department');

      const newDepartment = new Department({
        _id: departmentId,
        deptCode: departmentData.DeptCode || departmentData.deptCode,
        deptName: departmentData.DeptName || departmentData.deptName,
        faculty: departmentData.Faculty || departmentData.faculty
      });

      const savedDepartment = await newDepartment.save();
      await savedDepartment.populate({
        path: 'faculty',
        match: { deletedAt: null }
      });
      
      return savedDepartment;
    } catch (error) {
      console.error('Error creating department:', error);
      throw error;
    }
  }

  // Update department (exact replica)
  async updateDepartmentAsync(department, departmentData) {
    try {
      if (!department) {
        throw new Error('Department not found');
      }

      // Validate faculty exists if being updated
      if (departmentData.Faculty || departmentData.faculty) {
        const facultyId = departmentData.Faculty || departmentData.faculty;
        const faculty = await Faculty.findOne({
          _id: facultyId,
          deletedAt: null
        });
        
        if (!faculty) {
          throw new Error('Faculty not found');
        }
      }

      // Update fields
      department.deptCode = departmentData.DeptCode || departmentData.deptCode || department.deptCode;
      department.deptName = departmentData.DeptName || departmentData.deptName || department.deptName;
      if (departmentData.Faculty || departmentData.faculty) {
        department.faculty = departmentData.Faculty || departmentData.faculty;
      }
      department.updatedAt = new Date();

      const updatedDepartment = await department.save();
      await updatedDepartment.populate({
        path: 'faculty',
        match: { deletedAt: null }
      });
      
      return updatedDepartment;
    } catch (error) {
      console.error('Error updating department:', error);
      throw error;
    }
  }

  // Delete department (soft delete - exact replica)
  async deleteDepartmentAsync(department) {
    try {
      if (!department) {
        return false;
      }

      // Soft delete
      department.deletedAt = new Date();
      await department.save();
      
      return true;
    } catch (error) {
      console.error('Error deleting department:', error);
      return false;
    }
  }

  // Get departments by faculty (helper method)
  async getDepartmentsByFaculty(facultyId) {
    try {
      const departments = await Department.find({ 
        faculty: facultyId,
        deletedAt: null 
      })
      .populate({
        path: 'faculty',
        match: { deletedAt: null }
      })
      .sort({ deptName: 1 });

      return departments;
    } catch (error) {
      console.error('Error getting departments by faculty:', error);
      throw error;
    }
  }

  // Check if department code exists (helper method)
  async departmentCodeExists(deptCode, excludeId = null) {
    try {
      let query = { 
        deptCode: { $regex: new RegExp(`^${deptCode}$`, 'i') },
        deletedAt: null 
      };

      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const existing = await Department.findOne(query);
      return !!existing;
    } catch (error) {
      console.error('Error checking department code:', error);
      return false;
    }
  }
}

module.exports = new DepartmentService();