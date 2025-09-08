const FacultyService = require('../services/FacultyService');

class FacultyController {
  // GET /api/faculty (exact replica)
  async getFaculties(req, res) {
    try {
      const { page = 1, pageSize = 10, search = null } = req.query;

      const faculties = await FacultyService.getFacultiesAsync(
        parseInt(page), 
        parseInt(pageSize), 
        search
      );

      return res.json({
        Status: true,
        Data: faculties.List,
        TotalCount: faculties.Count,
        Page: parseInt(page),
        PageSize: parseInt(pageSize),
        Message: "faculties Fetched!"
      });

    } catch (error) {
      console.error('Get faculties error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // GET /api/faculty/:id (exact replica)
  async getFaculty(req, res) {
    try {
      const { id } = req.params;

      const faculty = await FacultyService.getFacultyAsync(id);

      if (!faculty) {
        return res.status(404).json({
          Status: false,
          Message: "Faculty not found"
        });
      }

      return res.json({
        Status: true,
        Data: faculty
      });

    } catch (error) {
      console.error('Get faculty error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // POST /api/faculty (exact replica)
  async createFaculty(req, res) {
    try {
      const facultyData = req.body;

      const createdFaculty = await FacultyService.createFacultyAsync(facultyData);

      return res.json({
        Status: true,
        Data: createdFaculty,
        Message: "Faculty created successfully!"
      });

    } catch (error) {
      console.error('Create faculty error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // PUT /api/faculty/:id (MISSING - exact replica)
  async updateFaculty(req, res) {
    try {
      const { id } = req.params;
      const facultyData = req.body;

      const faculty = await FacultyService.getFacultyAsync(id);
      if (!faculty) {
        return res.status(404).json({
          Status: false,
          Message: "Faculty not found"
        });
      }

      const updatedFaculty = await FacultyService.updateFacultyAsync(faculty, facultyData);

      return res.json({
        Status: true,
        Data: updatedFaculty,
        Message: "Faculty updated successfully!"
      });

    } catch (error) {
      console.error('Update faculty error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }

  // DELETE /api/faculty/:id (exact replica)
  async deleteFaculty(req, res) {
    try {
      const { id } = req.params;

      const faculty = await FacultyService.getFacultyAsync(id);
      if (!faculty) {
        return res.status(404).json({
          Status: false,
          Message: "Faculty not found"
        });
      }

      const deleted = await FacultyService.deleteFacultyAsync(faculty);
      
      if (deleted) {
        return res.status(204).send(); // No content
      } else {
        return res.status(500).json({
          Status: false,
          Message: "Failed to delete Faculty"
        });
      }

    } catch (error) {
      console.error('Delete faculty error:', error);
      return res.status(500).json({
        Status: false,
        Message: `Internal server error: ${error.message}`
      });
    }
  }
}

module.exports = new FacultyController();