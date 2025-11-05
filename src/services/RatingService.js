const YearlyRating = require('../models/YearlyRating');
const Category = require('../models/Category');
const User = require('../models/User');
const Department = require('../models/Department');
const Parameter = require('../models/Parameter');
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

  // Get ratings by department (enhanced with cycle and category filtering)
  async getRatingsByDepartment(deptID, cycleId = null, categoryId = null, context) {
    try {
      const currentUser = await HelperService.getLoggedUser(context);
      if (!currentUser) {
        throw new Error('User not found or not logged in');
      }

      console.log(`📊 getRatingsByDepartment - deptID: ${deptID}, cycleId: ${cycleId}, categoryId: ${categoryId}`);

      const currentFacultyId = currentUser.facultyId;
      const isAdmin = currentUser.userRole === 'Admin';

      // Build aggregation pipeline to join data (similar to .NET LINQ joins)
      let matchStage = {
        deletedAt: null
      };

      // Filter by department if provided (0 = all departments)
      if (deptID && deptID !== 0) {
        matchStage.deptId = deptID;
      }

      // Non-admin users see only their faculty (admin sees all)
      if (!isAdmin && currentFacultyId) {
        matchStage.facultyId = currentFacultyId;
      }

      // Aggregate ratings with user and department information
      let ratings = await YearlyRating.aggregate([
        {
          $match: { deletedAt: null }
        },
        // Add field to convert userId string to number for lookup
        {
          $addFields: {
            userIdNumeric: { $toInt: '$userId' }
          }
        },
        {
          $lookup: {
            from: 'Users',
            localField: 'userIdNumeric',
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
          $unwind: { path: '$department', preserveNullAndEmptyArrays: true }
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
        },
        // 🆕 Filter by category if provided
        ...(categoryId && categoryId !== 0 ? [{
          $match: { 'category._id': categoryId }
        }] : []),
        {
          $project: {
            parameterName: 1,
            categoryId: { $ifNull: ['$category._id', null] },
            categoryName: { $ifNull: ['$category.name', 'Unknown Category'] },
            userName: {
              $concat: [
                { $ifNull: ['$user.firstName', ''] },
                ' ',
                { $ifNull: ['$user.lastName', ''] }
              ]
            },
            userEmail: '$user.email',
            departmentId: { $ifNull: ['$department._id', null] },
            departmentName: { $ifNull: ['$department.deptName', 'No Department'] },
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
            },
            createdAt: 1,
            updatedAt: 1
          }
        }
      ]);

      // 🆕 Filter by cycle years if cycleId is provided
      if (cycleId && cycleId !== 0) {
        const Cycle = require('../models/Cycle');
        const cycle = await Cycle.findOne({ _id: cycleId, deletedAt: null });

        if (cycle) {
          console.log(`📅 Filtering by cycle years: ${cycle.activatedYears} + targetYear: ${cycle.targetYear}`);

          // Get all relevant years for this cycle (activated years + target year)
          const cycleYears = [...(cycle.activatedYears || [])];
          if (cycle.targetYear && !cycleYears.includes(cycle.targetYear)) {
            cycleYears.push(cycle.targetYear);
          }

          // Filter each rating's yearlyValues to include only this cycle's years
          ratings = ratings.map(rating => ({
            ...rating,
            yearlyValues: rating.yearlyValues.filter(yv => cycleYears.includes(yv.year))
          })).filter(rating => rating.yearlyValues.length > 0); // Remove ratings with no matching years
        }
      }

      // 🆕 GROUP BY: user + parameter to consolidate multiple year submissions
      // Instead of showing each year as separate row, group them together
      const groupedRatings = {};

      ratings.forEach(rating => {
        // Create unique key: userId + parameterId + departmentId + categoryId
        const key = `${rating.userEmail}_${rating.parameterName}_${rating.departmentId}_${rating.categoryId}`;

        if (!groupedRatings[key]) {
          // First time seeing this combination - create new entry
          groupedRatings[key] = {
            parameterName: rating.parameterName,
            categoryId: rating.categoryId,
            categoryName: rating.categoryName,
            userName: rating.userName,
            userEmail: rating.userEmail,
            departmentId: rating.departmentId,
            departmentName: rating.departmentName,
            yearlyValues: [...rating.yearlyValues],
            createdAt: rating.createdAt,
            updatedAt: rating.updatedAt
          };
        } else {
          // Already have this user+parameter combo - merge yearlyValues
          groupedRatings[key].yearlyValues.push(...rating.yearlyValues);

          // Update timestamps to most recent
          if (new Date(rating.updatedAt) > new Date(groupedRatings[key].updatedAt)) {
            groupedRatings[key].updatedAt = rating.updatedAt;
          }
          if (new Date(rating.createdAt) < new Date(groupedRatings[key].createdAt)) {
            groupedRatings[key].createdAt = rating.createdAt;
          }
        }
      });

      // Convert back to array and sort yearlyValues by year
      const consolidatedRatings = Object.values(groupedRatings).map(rating => ({
        ...rating,
        yearlyValues: rating.yearlyValues.sort((a, b) => a.year - b.year)
      }));

      console.log(`✅ Found ${ratings.length} individual submissions, consolidated to ${consolidatedRatings.length} grouped entries`);
      return consolidatedRatings;
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

      // Get the category ID for this parameter
      let categoryId = 1; // Default fallback
      if (parameter.category) {
        // Parameter stores category name, need to look up ID
        const category = await Category.findOne({
          name: parameter.category,
          deletedAt: null
        });
        if (category) {
          categoryId = category._id;
          console.log(`✅ Found category ID ${categoryId} for "${parameter.category}"`);
        } else {
          console.warn(`⚠️  Category "${parameter.category}" not found, using default ID 1`);
        }
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
          // MERGE with existing values - don't overwrite fields that weren't submitted
          const existingValue = existingRating.ratingValues[ratingValueIndex];
          existingRating.ratingValues[ratingValueIndex] = {
            year: cycle,
            actualValue: values.actualValue !== undefined ? values.actualValue : existingValue.actualValue,
            projectedValue: values.projectedValue !== undefined ? values.projectedValue : existingValue.projectedValue,
            textValue: values.textValue !== undefined ? values.textValue : existingValue.textValue
          };
          console.log(`🔄 Merged values - actual: ${existingRating.ratingValues[ratingValueIndex].actualValue}, projected: ${existingRating.ratingValues[ratingValueIndex].projectedValue}`);
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
          categoryId: categoryId, // Use the looked-up category ID
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