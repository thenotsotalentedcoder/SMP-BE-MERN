const { body, param, query, validationResult } = require('express-validator');

// Comprehensive API Validation Middleware
// 🎯 PURPOSE: Input validation and sanitization for all API endpoints

class ValidationMiddleware {
  // Generic validation result handler
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path || error.param,
          message: error.msg,
          value: error.value,
          location: error.location
        }))
      });
    }
    next();
  }

  // Cycle validation rules
  static validateCreateCycle() {
    return [
      body('name')
        .notEmpty()
        .withMessage('Cycle name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Cycle name must be between 3 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-\.]+$/)
        .withMessage('Cycle name contains invalid characters'),

      body('startYear')
        .notEmpty()
        .withMessage('Start year is required')
        .isISO8601()
        .withMessage('Start year must be a valid date')
        .custom((value) => {
          const date = new Date(value);
          const year = date.getFullYear();
          if (year < 2020 || year > 2050) {
            throw new Error('Start year must be between 2020 and 2050');
          }
          return true;
        }),

      body('endYear')
        .notEmpty()
        .withMessage('End year is required')
        .isISO8601()
        .withMessage('End year must be a valid date')
        .custom((value, { req }) => {
          const startDate = new Date(req.body.startYear);
          const endDate = new Date(value);
          if (endDate <= startDate) {
            throw new Error('End year must be after start year');
          }
          const yearDiff = endDate.getFullYear() - startDate.getFullYear();
          if (yearDiff > 10) {
            throw new Error('Cycle cannot exceed 10 years');
          }
          return true;
        }),

      body('cycleName')
        .optional()
        .isLength({ min: 3, max: 150 })
        .withMessage('Cycle name must be between 3 and 150 characters'),

      body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),

      body('targetYear')
        .optional()
        .isInt({ min: 2020, max: 2050 })
        .withMessage('Target year must be between 2020 and 2050'),

      body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean value')
    ];
  }

  static validateUpdateCycle() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('Cycle ID must be a positive integer'),

      body('name')
        .optional()
        .isLength({ min: 3, max: 100 })
        .withMessage('Cycle name must be between 3 and 100 characters'),

      body('startYear')
        .optional()
        .isISO8601()
        .withMessage('Start year must be a valid date'),

      body('endYear')
        .optional()
        .isISO8601()
        .withMessage('End year must be a valid date'),

      body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean value'),

      body('status')
        .optional()
        .isIn(['draft', 'active', 'completed', 'archived'])
        .withMessage('Status must be one of: draft, active, completed, archived')
    ];
  }

  static validateActivateYear() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('Cycle ID must be a positive integer'),

      body('year')
        .notEmpty()
        .withMessage('Year is required')
        .isInt({ min: 2020, max: 2050 })
        .withMessage('Year must be between 2020 and 2050'),

      body('reason')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Reason cannot exceed 200 characters')
    ];
  }

  // Parameter-Cycle validation rules
  static validateCreateParameterCycle() {
    return [
      body('parameterId')
        .notEmpty()
        .withMessage('Parameter ID is required')
        .isInt({ min: 1 })
        .withMessage('Parameter ID must be a positive integer'),

      body('cycleId')
        .notEmpty()
        .withMessage('Cycle ID is required')
        .isInt({ min: 1 })
        .withMessage('Cycle ID must be a positive integer'),

      body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean value'),

      body('cycleSpecificSettings.targetValue')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Target value must be a positive number'),

      body('cycleSpecificSettings.weightInCycle')
        .optional()
        .isFloat({ min: 0, max: 10 })
        .withMessage('Weight must be between 0 and 10'),

      body('cycleSpecificSettings.priorityLevel')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Priority level must be one of: low, medium, high, critical')
    ];
  }

  static validateYearlyOverride() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('Parameter-Cycle ID must be a positive integer'),

      body('year')
        .notEmpty()
        .withMessage('Year is required')
        .isInt({ min: 2020, max: 2050 })
        .withMessage('Year must be between 2020 and 2050'),

      body('overrides')
        .notEmpty()
        .withMessage('Overrides object is required')
        .isObject()
        .withMessage('Overrides must be an object'),

      body('overrides.targetValue')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Override target value must be a positive number'),

      body('overrides.isRequired')
        .optional()
        .isBoolean()
        .withMessage('Override isRequired must be a boolean')
    ];
  }

  // Parameter Submission validation rules
  static validateCreateSubmission() {
    return [
      body('parameterId')
        .notEmpty()
        .withMessage('Parameter ID is required')
        .isInt({ min: 1 })
        .withMessage('Parameter ID must be a positive integer'),

      body('cycleId')
        .notEmpty()
        .withMessage('Cycle ID is required')
        .isInt({ min: 1 })
        .withMessage('Cycle ID must be a positive integer'),

      body('submissionYear')
        .notEmpty()
        .withMessage('Submission year is required')
        .isInt({ min: 2020, max: 2050 })
        .withMessage('Submission year must be between 2020 and 2050'),

      body('submissionType')
        .notEmpty()
        .withMessage('Submission type is required')
        .isIn(['projected', 'actual'])
        .withMessage('Submission type must be either projected or actual'),

      body('submittedValue')
        .notEmpty()
        .withMessage('Submitted value is required')
        .isFloat()
        .withMessage('Submitted value must be a number'),

      body('evidence')
        .optional()
        .isArray()
        .withMessage('Evidence must be an array'),

      body('evidence.*.type')
        .optional()
        .isIn(['document', 'image', 'url', 'text'])
        .withMessage('Evidence type must be one of: document, image, url, text'),

      body('evidence.*.title')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Evidence title must be between 1 and 100 characters'),

      body('remarks')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Remarks cannot exceed 1000 characters'),

      body('submissionNotes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Submission notes cannot exceed 500 characters')
    ];
  }

  static validateUpdateSubmission() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('Submission ID must be a positive integer'),

      body('submittedValue')
        .optional()
        .isFloat()
        .withMessage('Submitted value must be a number'),

      body('evidence')
        .optional()
        .isArray()
        .withMessage('Evidence must be an array'),

      body('remarks')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Remarks cannot exceed 1000 characters')
    ];
  }

  static validateApprovalAction() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('Submission ID must be a positive integer'),

      body('reason')
        .optional()
        .isLength({ min: 1, max: 500 })
        .withMessage('Reason must be between 1 and 500 characters'),

      body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes cannot exceed 500 characters')
    ];
  }

  static validateRevisionRequest() {
    return [
      param('id')
        .isInt({ min: 1 })
        .withMessage('Submission ID must be a positive integer'),

      body('revisionNotes')
        .notEmpty()
        .withMessage('Revision notes are required')
        .isLength({ min: 10, max: 500 })
        .withMessage('Revision notes must be between 10 and 500 characters')
    ];
  }

  // User Cycle Access validation rules
  static validateGrantCycleAccess() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer'),

      body('cycleId')
        .notEmpty()
        .withMessage('Cycle ID is required')
        .isInt({ min: 1 })
        .withMessage('Cycle ID must be a positive integer'),

      body('year')
        .optional()
        .isInt({ min: 2020, max: 2050 })
        .withMessage('Year must be between 2020 and 2050'),

      body('accessLevel')
        .optional()
        .isIn(['read', 'write', 'admin'])
        .withMessage('Access level must be one of: read, write, admin'),

      body('permissions')
        .optional()
        .isObject()
        .withMessage('Permissions must be an object')
    ];
  }

  static validateUpdatePermissions() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer'),

      body('permissions')
        .notEmpty()
        .withMessage('Permissions object is required')
        .isObject()
        .withMessage('Permissions must be an object'),

      body('permissions.canViewAllCycles')
        .optional()
        .isBoolean()
        .withMessage('canViewAllCycles must be a boolean'),

      body('permissions.canEditActiveYear')
        .optional()
        .isBoolean()
        .withMessage('canEditActiveYear must be a boolean'),

      body('permissions.canViewPreviousYears')
        .optional()
        .isBoolean()
        .withMessage('canViewPreviousYears must be a boolean'),

      body('permissions.canAccessTargetYear')
        .optional()
        .isBoolean()
        .withMessage('canAccessTargetYear must be a boolean')
    ];
  }

  static validateBulkOperation() {
    return [
      body('userIds')
        .notEmpty()
        .withMessage('User IDs array is required')
        .isArray({ min: 1, max: 100 })
        .withMessage('User IDs must be an array with 1-100 items'),

      body('userIds.*')
        .isInt({ min: 1 })
        .withMessage('Each user ID must be a positive integer'),

      body('cycleId')
        .notEmpty()
        .withMessage('Cycle ID is required')
        .isInt({ min: 1 })
        .withMessage('Cycle ID must be a positive integer'),

      body('action')
        .notEmpty()
        .withMessage('Action is required')
        .isIn(['grant', 'revoke'])
        .withMessage('Action must be either grant or revoke')
    ];
  }

  // Query parameter validation
  static validatePaginationParams() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be between 1 and 1000'),

      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

      query('sortBy')
        .optional()
        .matches(/^[a-zA-Z_][a-zA-Z0-9_.]*$/)
        .withMessage('Sort field contains invalid characters'),

      query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be either asc or desc')
    ];
  }

  static validateFilterParams() {
    return [
      query('status')
        .optional()
        .isIn(['draft', 'active', 'completed', 'archived', 'pending', 'approved', 'rejected'])
        .withMessage('Invalid status value'),

      query('submissionType')
        .optional()
        .isIn(['projected', 'actual'])
        .withMessage('Submission type must be either projected or actual'),

      query('year')
        .optional()
        .isInt({ min: 2020, max: 2050 })
        .withMessage('Year must be between 2020 and 2050'),

      query('cycleId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Cycle ID must be a positive integer'),

      query('parameterId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Parameter ID must be a positive integer'),

      query('userId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer')
    ];
  }

  // Date range validation
  static validateDateRange() {
    return [
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO date'),

      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO date')
        .custom((value, { req }) => {
          if (req.query.startDate && value) {
            const start = new Date(req.query.startDate);
            const end = new Date(value);
            if (end <= start) {
              throw new Error('End date must be after start date');
            }
            // Limit date range to prevent performance issues
            const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
            if (daysDiff > 365) {
              throw new Error('Date range cannot exceed 365 days');
            }
          }
          return true;
        })
    ];
  }

  // Analytics validation
  static validateAnalyticsParams() {
    return [
      query('timeframe')
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage('Timeframe must be between 1 and 365 days'),

      query('includeComparisons')
        .optional()
        .isBoolean()
        .withMessage('includeComparisons must be a boolean'),

      query('includeHistory')
        .optional()
        .isBoolean()
        .withMessage('includeHistory must be a boolean'),

      query('groupBy')
        .optional()
        .isIn(['year', 'month', 'quarter', 'department', 'faculty', 'parameter', 'user'])
        .withMessage('Invalid groupBy value'),

      query('format')
        .optional()
        .isIn(['json', 'csv', 'excel'])
        .withMessage('Format must be one of: json, csv, excel')
    ];
  }

  // Export validation
  static validateExportParams() {
    return [
      query('type')
        .notEmpty()
        .withMessage('Export type is required')
        .isIn(['dashboard', 'cycle', 'parameter', 'submission', 'user'])
        .withMessage('Invalid export type'),

      query('format')
        .optional()
        .isIn(['json', 'csv'])
        .withMessage('Format must be either json or csv'),

      query('filters')
        .optional()
        .isJSON()
        .withMessage('Filters must be valid JSON')
    ];
  }

  // Sanitization middleware
  static sanitizeInput() {
    return [
      body('*')
        .escape() // Escape HTML entities
        .trim(), // Remove leading/trailing whitespace

      query('*')
        .escape()
        .trim()
    ];
  }

  // File upload validation
  static validateFileUpload(allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'], maxSize = 5 * 1024 * 1024) {
    return (req, res, next) => {
      if (!req.file) {
        return next();
      }

      // Check file type
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
          uploadedType: req.file.mimetype
        });
      }

      // Check file size
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`,
          uploadedSize: Math.round(req.file.size / 1024 / 1024) + 'MB'
        });
      }

      next();
    };
  }

  // Rate limiting validation helper
  static validateRateLimit(action) {
    return (req, res, next) => {
      // This would integrate with rate limiting middleware
      // For now, just pass through
      next();
    };
  }

  // Custom validation chains for complex scenarios
  static validateComplexSubmission() {
    return [
      ...this.validateCreateSubmission(),
      body().custom((body, { req }) => {
        // Custom validation logic for complex business rules
        if (body.submissionType === 'actual' && !body.evidence?.length) {
          throw new Error('Actual submissions require at least one piece of evidence');
        }

        if (body.submittedValue < 0 && !body.remarks) {
          throw new Error('Negative values require explanation in remarks');
        }

        return true;
      })
    ];
  }

  // Validation chain builder for dynamic validation
  static buildValidationChain(rules) {
    const chain = [];

    if (rules.includes('pagination')) {
      chain.push(...this.validatePaginationParams());
    }

    if (rules.includes('filters')) {
      chain.push(...this.validateFilterParams());
    }

    if (rules.includes('dateRange')) {
      chain.push(...this.validateDateRange());
    }

    if (rules.includes('sanitize')) {
      chain.push(...this.sanitizeInput());
    }

    chain.push(this.handleValidationErrors);

    return chain;
  }
}

module.exports = ValidationMiddleware;