const Faculty = require('../models/Faculty');
const Counter = require('../models/Counter');

class FacultyService {
  // Get faculties with pagination and search (exact replica)
  async getFacultiesAsync(page = 1, pageSize = 10, search = null) {
    try {
      const skip = (page - 1) * pageSize;
      
      // Build query
      let query = { deletedAt: null };
      
      if (search && search.trim()) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { facultyCode: { $regex: search, $options: 'i' } }
        ];
      }

      // Get total count
      const totalCount = await Faculty.countDocuments(query);
      
      // Get faculties with pagination and map fields for frontend compatibility
      const faculties = await Faculty.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(pageSize);

      // Map to include both _id and id for frontend compatibility
      const mappedFaculties = faculties.map(faculty => ({
        ...faculty.toObject(),
        id: faculty._id
      }));

      return {
        List: mappedFaculties,
        Count: totalCount
      };
    } catch (error) {
      console.error('Error getting faculties:', error);
      throw error;
    }
  }

  // Get single faculty by ID (exact replica)
  async getFacultyAsync(id) {
    try {
      const faculty = await Faculty.findOne({
        _id: id,
        deletedAt: null
      });

      return faculty;
    } catch (error) {
      console.error('Error getting faculty:', error);
      throw error;
    }
  }

  // Create faculty (exact replica with auto-increment ID)
  async createFacultyAsync(facultyData) {
    try {
      // Generate auto-increment ID
      const facultyId = await Counter.getNextSequence('faculty');
      
      const newFaculty = new Faculty({
        _id: facultyId,
        name: facultyData.Name || facultyData.name,
        facultyCode: facultyData.FacultyCode || facultyData.facultyCode
      });

      const savedFaculty = await newFaculty.save();
      return savedFaculty;
    } catch (error) {
      console.error('Error creating faculty:', error);
      throw error;
    }
  }

  // Update faculty (exact replica)
  async updateFacultyAsync(faculty, facultyData) {
    try {
      if (!faculty) {
        throw new Error('Faculty not found');
      }

      // Update fields
      faculty.name = facultyData.Name || facultyData.name || faculty.name;
      faculty.facultyCode = facultyData.FacultyCode || facultyData.facultyCode || faculty.facultyCode;
      faculty.updatedAt = new Date();

      const updatedFaculty = await faculty.save();
      return updatedFaculty;
    } catch (error) {
      console.error('Error updating faculty:', error);
      throw error;
    }
  }

  // Delete faculty (soft delete - exact replica)
  async deleteFacultyAsync(faculty) {
    try {
      if (!faculty) {
        return false;
      }

      // Soft delete
      faculty.deletedAt = new Date();
      await faculty.save();
      
      return true;
    } catch (error) {
      console.error('Error deleting faculty:', error);
      return false;
    }
  }

  // Get all active faculties (helper method)
  async getAllActiveFaculties() {
    try {
      const faculties = await Faculty.find({ deletedAt: null })
        .sort({ name: 1 });

      return faculties;
    } catch (error) {
      console.error('Error getting all active faculties:', error);
      throw error;
    }
  }

  // Check if faculty code exists (helper method)
  async facultyCodeExists(facultyCode, excludeId = null) {
    try {
      let query = { 
        facultyCode: { $regex: new RegExp(`^${facultyCode}$`, 'i') },
        deletedAt: null 
      };

      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const existing = await Faculty.findOne(query);
      return !!existing;
    } catch (error) {
      console.error('Error checking faculty code:', error);
      return false;
    }
  }
}

module.exports = new FacultyService();