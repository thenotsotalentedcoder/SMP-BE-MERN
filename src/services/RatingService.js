const YearlyRating = require('../models/YearlyRating');
const Category = require('../models/Category');
const User = require('../models/User');
const Department = require('../models/Department');
const HelperService = require('./HelperService');

class RatingService {
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
          userId: currentUser._id.toString(),
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
            userId: currentUser._id.toString()
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
        userId: currentUser._id.toString(),
        deletedAt: null
      }).sort({ createdAt: -1 });

      return ratings;
    } catch (error) {
      console.error('Error getting past ratings:', error);
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
}

module.exports = new RatingService();