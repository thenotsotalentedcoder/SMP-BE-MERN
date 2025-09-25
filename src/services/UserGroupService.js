// User Group Detection Service
// Maps users to their appropriate access groups based on department

class UserGroupService {

  // Department ID to Group mapping
  static DEPARTMENT_GROUP_MAP = {
    // Academic Departments (all departments with "Department of..." names)
    56: 'Academic Departments',  // Department of Civil Engineering
    57: 'Academic Departments',  // Department of Urban and Infrastructure Engineering
    58: 'Academic Departments',  // Department of Petroleum Engineering
    59: 'Academic Departments',  // Department of Earthquake Engineering
    60: 'Academic Departments',  // Department of Environmental Engineering
    61: 'Academic Departments',  // Department of Electrical Engineering
    62: 'Academic Departments',  // Department of Electronic Engineering
    63: 'Academic Departments',  // Department of Telecommunications Engineering
    64: 'Academic Departments',  // Department of Computer and Information Systems Engineering
    65: 'Academic Departments',  // Department of Bio-Medical Engineering
    66: 'Academic Departments',  // Department of Computer Science & Information Technology
    67: 'Academic Departments',  // Department of Software Engineering
    68: 'Academic Departments',  // Department of Mechanical Engineering
    69: 'Academic Departments',  // Department of Industrial and Manufacturing Engineering
    70: 'Academic Departments',  // Department of Textile Engineering
    71: 'Academic Departments',  // Department of Automotive and Marine Engineering
    72: 'Academic Departments',  // Department of Chemical Engineering
    73: 'Academic Departments',  // Department of Polymer and Petrochemical Engineering
    75: 'Academic Departments',  // Department of Materials Engineering
    76: 'Academic Departments',  // Department of Metallurgical Engineering
    77: 'Academic Departments',  // Department of Food Engineering
    78: 'Academic Departments',  // Department of Architecture and Planning
    79: 'Academic Departments',  // Department of Economics and Management Sciences
    80: 'Academic Departments',  // Department of Physics
    81: 'Academic Departments',  // Department of Chemistry
    82: 'Academic Departments',  // Department of Mathematics
    83: 'Academic Departments',  // Department of English Linguistics & Allied Studies
    84: 'Academic Departments',  // Department of Essential Studies
    85: 'Academic Departments',  // Department of Civil Engineering [TIEST]
    86: 'Academic Departments',  // Department of Computer Science and Technology [TIEST]

    // Administrative Groups (individual mapping)
    87: 'Directorate of Finance', // Directorate of Finance
    89: 'ORIC',                  // Offices of Research, Innovation and Commercialization
    90: 'CSA',                   // Controller Students Affairs
    91: 'DWS',                   // Directorate of Works and Services
    92: 'Registrar Office',      // Registrar Office
    93: 'Library',               // Library
    94: 'Medical Center',        // Medical Center
    95: 'QEC',                   // Quality Enhancement Cell
    96: 'ITD',                   // Information Technology Department
    97: 'UAFA',                  // Directorate of University Advancement & Financial Assistance
    98: 'NED Academy',           // NED Academy
    99: 'DIL'                    // Directorate of Industrial Liaison
  };

  // Available user groups for dropdown/selection
  static AVAILABLE_GROUPS = [
    { value: 'Academic Departments', label: 'Academic Departments (All Engineering/Science)' },
    { value: 'ORIC', label: 'ORIC - Research & Innovation' },
    { value: 'QEC', label: 'QEC - Quality Enhancement' },
    { value: 'CSA', label: 'CSA - Student Affairs' },
    { value: 'Directorate of Finance', label: 'Directorate of Finance' },
    { value: 'DIL', label: 'DIL - Industrial Liaison' },
    { value: 'UAFA', label: 'UAFA - University Advancement' },
    { value: 'DWS', label: 'DWS - Works & Services' },
    { value: 'ITD', label: 'ITD - Information Technology' },
    { value: 'Library', label: 'Library Services' },
    { value: 'Medical Center', label: 'Medical Center' },
    { value: 'NED Academy', label: 'NED Academy' },
    { value: 'Registrar Office', label: 'Registrar Office' }
  ];

  /**
   * Determine user's group based on their role and department
   * @param {Object} user - User object with userRole and deptId
   * @returns {string} - User's group name
   */
  static getUserGroup(user) {
    // Admin users always see everything (special handling)
    if (user.userRole === 'Admin') {
      return 'Admin'; // Special group for admin override
    }

    const deptId = user.deptId;

    // Map department ID to group
    const userGroup = this.DEPARTMENT_GROUP_MAP[deptId];

    // Default to Academic Departments if department not found
    return userGroup || 'Academic Departments';
  }

  /**
   * Check if user is admin (has access to all parameters)
   * @param {Object} user - User object
   * @returns {boolean}
   */
  static isAdmin(user) {
    return user.userRole === 'Admin';
  }

  /**
   * Get all available groups for dropdown selection
   * @returns {Array} - Array of group objects with value and label
   */
  static getAvailableGroups() {
    return this.AVAILABLE_GROUPS;
  }

  /**
   * Validate if a group exists in available groups
   * @param {string} groupName - Group name to validate
   * @returns {boolean}
   */
  static isValidGroup(groupName) {
    return this.AVAILABLE_GROUPS.some(group => group.value === groupName);
  }

  /**
   * Filter parameters based on user's group access
   * @param {Array} parameters - Array of parameter objects
   * @param {Object} user - User object
   * @returns {Array} - Filtered parameters
   */
  static filterParametersForUser(parameters, user) {
    // Admin sees all parameters
    if (this.isAdmin(user)) {
      return parameters;
    }

    const userGroup = this.getUserGroup(user);

    // Filter parameters based on access rules
    return parameters.filter(parameter => {
      // If parameter has no access restrictions, show to all
      if (!parameter.restrictedAccess) {
        return true;
      }

      // If parameter has access restrictions, check if user's group is in the list
      if (parameter.accessibleToGroups && parameter.accessibleToGroups.length > 0) {
        return parameter.accessibleToGroups.includes(userGroup);
      }

      // Default: if no specific groups defined, show to all
      return true;
    });
  }
}

module.exports = UserGroupService;