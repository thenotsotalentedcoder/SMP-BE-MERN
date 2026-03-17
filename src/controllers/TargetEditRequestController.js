const TargetEditRequest = require('../models/TargetEditRequest');
const YearlyRating = require('../models/YearlyRating');
const User = require('../models/User');
const Parameter = require('../models/Parameter');

class TargetEditRequestController {

  // POST /api/target-edit-requests
  // body: { parameterId, reason, requestType: 'target'|'achieved', year? }
  async createRequest(req, res) {
    try {
      const { parameterId, reason, requestType = 'target', year } = req.body;
      const user = req.user;

      if (!parameterId || !reason || !reason.trim()) {
        return res.status(400).json({ Status: false, Message: 'Parameter ID and reason are required' });
      }

      if (!['target', 'achieved'].includes(requestType)) {
        return res.status(400).json({ Status: false, Message: 'Invalid requestType' });
      }

      if (requestType === 'achieved' && !year) {
        return res.status(400).json({ Status: false, Message: 'Year is required for achieved edit requests' });
      }

      // Must have locked targets
      const yearlyRating = await YearlyRating.findOne({
        parameterId: parseInt(parameterId),
        userId: String(user.id),
        targetValuesLocked: true,
        deletedAt: null
      });

      if (!yearlyRating) {
        return res.status(400).json({ Status: false, Message: 'No locked targets found for this parameter' });
      }

      // Check for existing pending request of same type+year
      const pendingQuery = {
        parameterId: parseInt(parameterId),
        userId: String(user.id),
        requestType,
        status: 'pending'
      };
      if (requestType === 'achieved') pendingQuery.year = parseInt(year);

      const existingPending = await TargetEditRequest.findOne(pendingQuery);
      if (existingPending) {
        return res.status(409).json({ Status: false, Message: 'You already have a pending edit request for this' });
      }

      const request = new TargetEditRequest({
        parameterId: parseInt(parameterId),
        userId: String(user.id),
        yearlyRatingId: yearlyRating._id,
        reason: reason.trim(),
        requestType,
        year: requestType === 'achieved' ? parseInt(year) : null,
        status: 'pending'
      });

      await request.save();

      return res.json({ Status: true, Data: request, Message: 'Edit request submitted successfully' });

    } catch (error) {
      console.error('Create target edit request error:', error);
      return res.status(500).json({ Status: false, Message: `Internal server error: ${error.message}` });
    }
  }

  // GET /api/target-edit-requests — Admin: all requests
  async getAllRequests(req, res) {
    try {
      const requests = await TargetEditRequest.find().sort({ createdAt: -1 }).lean();

      const enriched = await Promise.all(requests.map(async (r) => {
        const user = await User.findOne({ _id: parseInt(r.userId) }).lean();
        const parameter = await Parameter.findOne({ _id: r.parameterId, deletedAt: null }).lean();
        return {
          ...r,
          userName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown',
          userEmail: user ? user.email : '',
          parameterName: parameter ? parameter.parameterName : `Parameter #${r.parameterId}`
        };
      }));

      return res.json({ Status: true, Data: enriched, Message: 'Requests fetched successfully' });

    } catch (error) {
      console.error('Get all target edit requests error:', error);
      return res.status(500).json({ Status: false, Message: `Internal server error: ${error.message}` });
    }
  }

  // GET /api/target-edit-requests/my?parameterId=X — User: their requests for a parameter
  async getMyRequests(req, res) {
    try {
      const { parameterId } = req.query;
      const user = req.user;

      if (!parameterId) {
        return res.status(400).json({ Status: false, Message: 'parameterId is required' });
      }

      const requests = await TargetEditRequest.find({
        parameterId: parseInt(parameterId),
        userId: String(user.id)
      }).sort({ createdAt: -1 }).lean();

      return res.json({ Status: true, Data: requests, Message: 'Requests fetched' });

    } catch (error) {
      console.error('Get my edit requests error:', error);
      return res.status(500).json({ Status: false, Message: `Internal server error: ${error.message}` });
    }
  }

  // PUT /api/target-edit-requests/:id/approve — Admin approves
  async approveRequest(req, res) {
    try {
      const { id } = req.params;
      const admin = req.user;

      const request = await TargetEditRequest.findById(id);
      if (!request) return res.status(404).json({ Status: false, Message: 'Request not found' });
      if (request.status !== 'pending') return res.status(400).json({ Status: false, Message: 'Request is no longer pending' });

      if (request.requestType === 'target') {
        // Unlock all target values
        await YearlyRating.updateOne(
          { parameterId: request.parameterId, userId: request.userId, targetValuesLocked: true, deletedAt: null },
          { $set: { targetValuesLocked: false } }
        );
      } else {
        // achieved: add this year to unlockedAchievedYears array
        await YearlyRating.updateOne(
          { parameterId: request.parameterId, userId: request.userId, targetValuesLocked: true, deletedAt: null },
          { $addToSet: { unlockedAchievedYears: request.year } }
        );
      }

      request.status = 'approved';
      request.resolvedAt = new Date();
      request.resolvedBy = String(admin.id);
      await request.save();

      return res.json({ Status: true, Data: request, Message: 'Request approved' });

    } catch (error) {
      console.error('Approve target edit request error:', error);
      return res.status(500).json({ Status: false, Message: `Internal server error: ${error.message}` });
    }
  }

  // PUT /api/target-edit-requests/:id/reject — Admin rejects
  async rejectRequest(req, res) {
    try {
      const { id } = req.params;
      const admin = req.user;

      const request = await TargetEditRequest.findById(id);
      if (!request) return res.status(404).json({ Status: false, Message: 'Request not found' });
      if (request.status !== 'pending') return res.status(400).json({ Status: false, Message: 'Request is no longer pending' });

      request.status = 'rejected';
      request.resolvedAt = new Date();
      request.resolvedBy = String(admin.id);
      await request.save();

      return res.json({ Status: true, Data: request, Message: 'Request rejected' });

    } catch (error) {
      console.error('Reject target edit request error:', error);
      return res.status(500).json({ Status: false, Message: `Internal server error: ${error.message}` });
    }
  }
}

module.exports = new TargetEditRequestController();
