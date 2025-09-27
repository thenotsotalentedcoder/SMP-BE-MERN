const YearlyRating = require('../models/YearlyRating');
const Category = require('../models/Category');
const User = require('../models/User');
const Department = require('../models/Department');
const HelperService = require('./HelperService');

class RatingService {
  // Get all ratings with filtering and pagination (for ratings report)
  async getAllRatings(filters, page = 1, pageSize = 10, context) {
    try {
      const currentUser = await HelperService.getLoggedUser(context);
      if (!currentUser) {
        throw new Error('User not found or not logged in');
      }

      // Build match conditions
      let matchConditions = {
        deletedAt: null
      };

      // Build aggregation pipeline
      const pipeline = [
        {
          $match: matchConditions
        },
        {
          $lookup: {
            from: 'Users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $lookup: {
            from: 'Departments',
            let: { deptId: '$user.deptId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$deptId'] },
                  deletedAt: null
                }
              }
            ],
            as: 'department'
          }
        },
        {
          $unwind: { path: '$department', preserveNullAndEmptyArrays: true }
        },
        {
          $lookup: {
            from: 'Faculties',
            let: { facultyId: '$user.facultyId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$facultyId'] },
                  deletedAt: null
                }
              }
            ],
            as: 'faculty'
          }
        },
        {
          $unwind: { path: '$faculty', preserveNullAndEmptyArrays: true }
        },
        {
          $lookup: {
            from: 'Categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category'
          }
        },
        {
          $unwind: { path: '$category', preserveNullAndEmptyArrays: true }
        }
      ];

      // Add filters
      const filterMatch = {};
      
      if (filters.departmentId && filters.departmentId !== '') {
        filterMatch['department._id'] = filters.departmentId;
      }
      
      if (filters.facultyId && filters.facultyId !== '') {
        filterMatch['faculty._id'] = filters.facultyId;
      }
      
      if (filters.cycle && filters.cycle !== '') {
        filterMatch['ratingValues.year'] = { $regex: filters.cycle, $options: 'i' };
      }
      
      if (filters.category && filters.category !== '') {
        filterMatch['category.name'] = { $regex: filters.category, $options: 'i' };
      }

      if (Object.keys(filterMatch).length > 0) {
        pipeline.push({ $match: filterMatch });
      }

      // Add projection
      pipeline.push({
        $project: {
          id: '$_id',
          _id: '$_id',
          departmentId: '$department._id',
          facultyId: '$faculty._id',
          cycle: { $arrayElemAt: ['$ratingValues.year', 0] }, // Get first year as cycle
          category: '$category.name',
          values: {
            $map: {
              input: '$ratingValues',
              as: 'val',
              in: {
                id: '$$val._id',
                parameterId: '$parameterId',
                value: '$$val.actualValue',
                textValue: '$$val.textValue',
                year: '$$val.year'
              }
            }
          },
          parameterName: 1,
          createdAt: 1,
          updatedAt: 1
        }
      });

      // Add sorting
      pipeline.push({ $sort: { createdAt: -1 } });

      // Get total count
      const totalPipeline = [...pipeline, { $count: 'total' }];
      const totalResult = await YearlyRating.aggregate(totalPipeline);
      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      // Add pagination
      const skip = (page - 1) * pageSize;
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: pageSize });

      const ratings = await YearlyRating.aggregate(pipeline);

      return {
        data: ratings,
        pagination: {
          page: page,
          pageSize: pageSize,
          total: total,
          pages: Math.ceil(total / pageSize)
        }
      };

    } catch (error) {
      console.error('Error getting all ratings:', error);
      throw error;
    }
  }

  // Submit ratings (exact replica of .NET SubmitRatings)
  async submitRatings(ratingsData, context) {
    try {
      const currentUser = await HelperService.getLoggedUser(context);
      if (!currentUser) {
        throw new Error('User not found or not logged in');
      }

      // Find category by name
      const category = await Category.findOne({ 
        name: ratingsData.CategoryName,
        deletedAt: null 
      });

      if (!category) {
        throw new Error('Category not found');
      }

      // Process each rating
      for (const rating of ratingsData.Ratings) {
        // Convert ParameterId to number if it's a string
        const parameterId = typeof rating.ParameterId === 'string' ? 
          parseInt(rating.ParameterId) : rating.ParameterId;

        // Check if rating already exists
        const existingRating = await YearlyRating.findOne({
          parameterId: parameterId,
          userId: currentUser._id,
          deletedAt: null
        });

        if (existingRating) {
          // Update existing rating
          existingRating.ratingValues = rating.RatingValues;
          existingRating.updatedAt = new Date();
          await existingRating.save();
        } else {
          // Create new rating
          const newRating = new YearlyRating({
            ratingValues: rating.RatingValues,
            categoryId: category._id, // Now using integer category ID
            parameterId: parameterId, // Using converted integer parameter ID
            parameterName: rating.ParameterName,
            ratingYear: rating.RatingYear,
            userId: currentUser._id
          });
          await newRating.save();
        }
      }

      return true;
    } catch (error) {
      console.error('Error submitting ratings:', error);
      throw error;
    }
  }

  // Get past ratings by category (exact replica)
  async getPastRatings(categoryName, context) {
    try {
      const currentUser = await HelperService.getLoggedUser(context);
      if (!currentUser) {
        throw new Error('User not found or not logged in');
      }

      // Find category by name
      const category = await Category.findOne({ 
        name: categoryName,
        deletedAt: null 
      });

      if (!category) {
        throw new Error('Category not found');
      }

      // Get ratings for this user and category
      const ratings = await YearlyRating.find({
        categoryId: category._id, // Now using integer category ID
        userId: currentUser._id,
        deletedAt: null
      }).sort({ createdAt: -1 });

      return ratings;
    } catch (error) {
      console.error('Error getting past ratings:', error);
      throw error;
    }
  }

  // Get ratings by parameter
  async getRatingsByParameter(parameterId, category, context) {
    try {
      const currentUser = await HelperService.getLoggedUser(context);
      if (!currentUser) {
        throw new Error('User not found or not logged in');
      }

      // Find ratings for this parameter by current user
      let matchConditions = {
        parameterId: parseInt(parameterId),
        userId: currentUser._id,
        deletedAt: null
      };

      // Add category filter if provided
      if (category) {
        const categoryDoc = await Category.findOne({ 
          name: category,
          deletedAt: null 
        });
        if (categoryDoc) {
          matchConditions.categoryId = categoryDoc._id;
        }
      }

      const ratings = await YearlyRating.find(matchConditions).sort({ createdAt: -1 });

      // Transform to match expected format
      const transformedRatings = ratings.map(rating => {
        return rating.ratingValues || [];
      }).flat();

      return transformedRatings;
    } catch (error) {
      console.error('Error getting ratings by parameter:', error);
      throw error;
    }
  }

  // Get ratings by department (exact replica with faculty filtering)
  async getRatingsByDepartment(deptID, context) {
    try {
      const currentUser = await HelperService.getLoggedUser(context);
      if (!currentUser) {
        throw new Error('User not found or not logged in');
      }

      const currentFacultyId = currentUser.facultyId;

      // Build aggregation pipeline to join data (similar to .NET LINQ joins)
      let matchStage = {
        deletedAt: null
      };

      // Filter by department if provided
      if (deptID && deptID !== 0) {
        matchStage.deptId = deptID;
      }

      // Filter by faculty if user has facultyId
      if (currentFacultyId) {
        matchStage.facultyId = currentFacultyId;
      }

      // Aggregate ratings with user and department information
      const ratings = await YearlyRating.aggregate([
        {
          $match: { deletedAt: null }
        },
        {
          $lookup: {
            from: 'Users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $match: matchStage
        },
        {
          $lookup: {
            from: 'Departments',
            let: { deptId: '$user.deptId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$deptId'] },
                  deletedAt: null
                }
              }
            ],
            as: 'department'
          }
        },
        {
          $unwind: '$department'
        },
        {
          $lookup: {
            from: 'Categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category'
          }
        },
        {
          $unwind: '$category'
        },
        {
          $match: {
            'category.deletedAt': null,
            'department.deletedAt': null
          }
        },
        {
          $project: {
            parameterName: 1,
            categoryName: '$category.name',
            userName: {
              $concat: ['$user.firstName', ' ', '$user.lastName']
            },
            departmentName: '$department.deptName',
            yearlyValues: {
              $map: {
                input: {
                  $sortArray: { input: '$ratingValues', sortBy: { year: 1 } }
                },
                as: 'rv',
                in: {
                  year: '$$rv.year',
                  actualValue: '$$rv.actualValue',
                  projectedValue: '$$rv.projectedValue',
                  textValue: '$$rv.textValue'
                }
              }
            }
          }
        }
      ]);

      return ratings;
    } catch (error) {
      console.error('Error getting ratings by department:', error);
      throw error;
    }
  }

  // ➕ NEW: Submit individual parameter for specific cycle
  async submitIndividualParameter(parameterId, cycle, values, user) {
    try {
      console.log(`📝 Submitting individual parameter: ${parameterId} for cycle ${cycle}`);

      // Get parameter details for validation
      const parameter = await Parameter.findOne({
        _id: parameterId,
        deletedAt: null
      });

      if (!parameter) {
        throw new Error('Parameter not found');
      }

      // Check if user already has a submission for this parameter and cycle
      let existingRating = await YearlyRating.findOne({
        parameterId: parameterId,
        userId: user.id,
        deletedAt: null,
        'ratingValues.year': cycle
      });

      if (existingRating) {
        // Update existing submission
        console.log(`📝 Updating existing submission for parameter ${parameterId}, cycle ${cycle}`);

        const ratingValueIndex = existingRating.ratingValues.findIndex(rv => rv.year === cycle);
        if (ratingValueIndex !== -1) {
          existingRating.ratingValues[ratingValueIndex] = {
            year: cycle,
            actualValue: values.actualValue || null,
            projectedValue: values.projectedValue || null,
            textValue: values.textValue || null
          };
        } else {
          existingRating.ratingValues.push({
            year: cycle,
            actualValue: values.actualValue || null,
            projectedValue: values.projectedValue || null,
            textValue: values.textValue || null
          });
        }

        const updatedRating = await existingRating.save();

        return {
          submissionId: updatedRating._id,
          parameterId: parameterId,
          cycle: cycle,
          submittedAt: updatedRating.updatedAt,
          isReadOnly: true,
          action: 'updated'
        };

      } else {
        // Create new submission
        console.log(`📝 Creating new submission for parameter ${parameterId}, cycle ${cycle}`);

        const newRating = new YearlyRating({
          ratingYear: cycle,
          userId: user.id,
          parameterName: parameter.parameterName,
          parameterId: parameterId,
          categoryId: 1, // Default category ID - will be enhanced later
          ratingValues: [{
            year: cycle,
            actualValue: values.actualValue || null,
            projectedValue: values.projectedValue || null,
            textValue: values.textValue || null
          }]
        });

        const savedRating = await newRating.save();

        return {
          submissionId: savedRating._id,
          parameterId: parameterId,
          cycle: cycle,
          submittedAt: savedRating.createdAt,
          isReadOnly: true,
          action: 'created'
        };
      }

    } catch (error) {
      console.error('Error submitting individual parameter:', error);
      throw error;
    }
  }
}

module.exports = new RatingService();