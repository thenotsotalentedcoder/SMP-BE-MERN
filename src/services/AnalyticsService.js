const YearlyRating = require('../models/YearlyRating');
const Cycle = require('../models/Cycle');
const Parameter = require('../models/Parameter');
const User = require('../models/User');
const Department = require('../models/Department');
const Faculty = require('../models/Faculty');
const Category = require('../models/Category');

// ─────────────────────────────────────────────────────────────────────────────
// AnalyticsService — Real data aggregations for the VC/Dean Analytics Dashboard
// Source of truth: YearlyRatings collection (one doc per user×parameter)
// ratingValues: [{ year, projectedValue (cumulative target), actualValue }]
// overallTarget: the final end-goal value (same as last year's projectedValue)
// ─────────────────────────────────────────────────────────────────────────────

class AnalyticsService {

  // ─── MAIN ENTRY: Scorecard ──────────────────────────────────────────────────
  // Returns everything needed for the University Pulse + 12 Pillar Scorecard
  // GET /api/analytics/scorecard?cycleId=X&year=Y
  async getScorecard(cycleId, selectedYear) {
    // 1. Load cycle metadata
    const cycle = await Cycle.findOne({ _id: parseInt(cycleId), deletedAt: null });
    if (!cycle) throw new Error('Cycle not found');

    const activeYear = selectedYear ? parseInt(selectedYear) : cycle.currentActiveYear;
    const targetYear = cycle.targetYear;
    const firstYear  = cycle.cycleYears ? Math.min(...cycle.cycleYears) : null;

    // 2. Load all non-deleted YearlyRatings with user→dept→faculty→category joins
    const ratings = await this._loadAllRatingsWithContext(cycleId, cycle);

    // 3. Load parameter metadata (for isDecreasing flag)
    const paramMeta = await this._loadParameterMeta(ratings);

    // 4. Compute per-parameter scores for the selected year
    const paramScores = this._computeParamScores(ratings, paramMeta, activeYear, firstYear, targetYear);

    // 5. University-level pulse
    const universityPulse = this._aggregatePulse(paramScores);

    // 6. Per-pillar scorecard (12 pillars)
    const pillarScores = await this._aggregateByPillar(paramScores, ratings);

    // 7. Year-timeline (for the year progress strip)
    const yearTimeline = this._buildYearTimeline(ratings, paramMeta, cycle, firstYear, targetYear);

    return {
      cycle: {
        id: cycle._id,
        name: cycle.name,
        cycleName: cycle.cycleName || cycle.name,
        yearRange: `${firstYear}–${targetYear}`,
        cycleYears: cycle.cycleYears || [],
        activatedYears: cycle.activatedYears || [],
        currentActiveYear: cycle.currentActiveYear,
        targetYear,
        selectedYear: activeYear,
      },
      universityPulse,
      pillarScores,
      yearTimeline,
    };
  }

  // ─── DRILL DOWN ─────────────────────────────────────────────────────────────
  // Returns parameter-level rows + department league table
  // GET /api/analytics/drill?cycleId=X&year=Y&categoryId=Z&deptId=W
  async getDrillDown(cycleId, selectedYear, categoryId, deptId) {
    const cycle = await Cycle.findOne({ _id: parseInt(cycleId), deletedAt: null });
    if (!cycle) throw new Error('Cycle not found');

    const activeYear = selectedYear ? parseInt(selectedYear) : cycle.currentActiveYear;
    const targetYear = cycle.targetYear;
    const firstYear  = cycle.cycleYears ? Math.min(...cycle.cycleYears) : null;

    const ratings = await this._loadAllRatingsWithContext(cycleId, cycle);
    const paramMeta = await this._loadParameterMeta(ratings);

    // Filter by category if provided
    let filtered = ratings;
    if (categoryId && parseInt(categoryId) !== 0) {
      filtered = ratings.filter(r => r.categoryId === parseInt(categoryId));
    }

    // Filter by department if provided
    if (deptId && parseInt(deptId) !== 0) {
      filtered = filtered.filter(r => r.departmentId === parseInt(deptId));
    }

    const paramScores = this._computeParamScores(filtered, paramMeta, activeYear, firstYear, targetYear);

    // Parameter detail rows
    const parameterRows = this._buildParameterRows(filtered, paramMeta, paramScores, activeYear, firstYear, targetYear, cycle);

    // Department league table (computed from ALL ratings if no deptId filter, otherwise all depts in category)
    const sourceForDepts = categoryId && parseInt(categoryId) !== 0
      ? ratings.filter(r => r.categoryId === parseInt(categoryId))
      : ratings;
    const deptLeague = this._buildDeptLeague(sourceForDepts, paramMeta, activeYear, firstYear, targetYear);

    return {
      cycle: {
        id: cycle._id,
        name: cycle.name,
        selectedYear: activeYear,
        targetYear,
        activatedYears: cycle.activatedYears || [],
        cycleYears: cycle.cycleYears || [],
      },
      parameterRows,
      deptLeague,
      totalParams: parameterRows.length,
    };
  }

  // ─── HELPER: Load all ratings with dept/faculty/category context ─────────────
  async _loadAllRatingsWithContext(cycleId, cycle) {
    const cycleYears = cycle.cycleYears || [];
    const activatedYears = [...(cycle.activatedYears || [])];
    if (cycle.targetYear && !activatedYears.includes(cycle.targetYear)) {
      activatedYears.push(cycle.targetYear);
    }

    const rawRatings = await YearlyRating.aggregate([
      { $match: { deletedAt: null } },
      // Convert userId string→int for lookup
      { $addFields: { userIdNumeric: { $toInt: '$userId' } } },
      {
        $lookup: {
          from: 'Users',
          localField: 'userIdNumeric',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: 'Departments',
          let: { deptId: '$user.deptId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$deptId'] }, deletedAt: null } }
          ],
          as: 'department'
        }
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'Faculties',
          let: { facId: '$user.facultyId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$facId'] }, deletedAt: null } }
          ],
          as: 'faculty'
        }
      },
      { $unwind: { path: '$faculty', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'Categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          parameterId: 1,
          parameterName: 1,
          categoryId: { $ifNull: ['$category._id', '$categoryId'] },
          categoryName: { $ifNull: ['$category.name', 'Unknown'] },
          overallTarget: 1,
          targetValuesLocked: 1,
          ratingValues: 1,
          departmentId: { $ifNull: ['$department._id', null] },
          departmentName: { $ifNull: ['$department.deptName', 'Unknown'] },
          deptCode: { $ifNull: ['$department.deptCode', null] },
          facultyId: { $ifNull: ['$faculty._id', null] },
          facultyName: { $ifNull: ['$faculty.name', 'Unknown'] },
          userId: '$userIdNumeric',
        }
      }
    ]);

    // Filter ratingValues to only cycle years & group by user+parameter
    const grouped = {};
    rawRatings.forEach(r => {
      const key = `${r.userId}_${r.parameterId}_${r.departmentId}`;
      if (!grouped[key]) {
        grouped[key] = { ...r, ratingValues: [] };
      }
      const relevant = (r.ratingValues || []).filter(rv =>
        activatedYears.includes(rv.year) || cycleYears.includes(rv.year)
      );
      grouped[key].ratingValues.push(...relevant);
      // Keep the most-locked version's overallTarget
      if (r.targetValuesLocked) {
        grouped[key].targetValuesLocked = true;
        grouped[key].overallTarget = r.overallTarget;
      }
    });

    // De-duplicate ratingValues per year (keep latest)
    return Object.values(grouped).map(r => ({
      ...r,
      ratingValues: this._dedupeByYear(r.ratingValues),
    }));
  }

  // ─── HELPER: Load parameter metadata (isDecreasing, parameterType) ───────────
  async _loadParameterMeta(ratings) {
    const ids = [...new Set(ratings.map(r => r.parameterId).filter(Boolean))];
    const params = await Parameter.find({ _id: { $in: ids }, deletedAt: null })
      .select('_id isDecreasing parameterType maxValue')
      .lean();
    const map = {};
    params.forEach(p => { map[p._id] = p; });
    return map;
  }

  // ─── HELPER: Compute normalized 0–100 score for each rating entry ────────────
  // yearScore  = how well the year's cumulative target was met
  // journeyPct = how far along toward the overallTarget (end goal)
  // status     = exceeding | on_track | behind | pending
  _computeParamScores(ratings, paramMeta, activeYear, firstYear, targetYear) {
    return ratings.map(r => {
      const meta = paramMeta[r.parameterId] || {};
      const isDecreasing = meta.isDecreasing === true;
      const isText = meta.parameterType === 'Text';

      if (isText) {
        return { key: `${r.userId}_${r.parameterId}`, status: 'text', yearScore: null, journeyPct: null, rating: r };
      }

      // Get baseline (first year value = starting point)
      const baselineRv = r.ratingValues.find(rv => rv.year === firstYear);
      const baseline = baselineRv?.projectedValue ?? baselineRv?.actualValue ?? null;

      // Get selected year target + actual
      const yearRv = r.ratingValues.find(rv => rv.year === activeYear);
      const yearTarget = yearRv?.projectedValue ?? null;
      const yearActual = yearRv?.actualValue ?? null;

      // Get latest actual (most recent year with actual submitted)
      const withActuals = r.ratingValues
        .filter(rv => rv.actualValue !== null && rv.actualValue !== undefined && rv.year !== firstYear)
        .sort((a, b) => b.year - a.year);
      const latestActualRv = withActuals[0] || null;
      const latestActual = latestActualRv?.actualValue ?? null;

      const overallTarget = r.overallTarget ?? null;

      // ── Year score (how well this year's milestone was met) ──
      let yearScore = null;
      let status = 'pending';

      if (yearTarget !== null && yearActual !== null) {
        if (isDecreasing) {
          // Lower is better: score = target/actual × 100
          // Special case: actual = 0 on a decreasing param = perfect (achieved zero of the bad thing)
          if (yearActual === 0) {
            yearScore = 150; // exceeded — achieved zero (best possible)
          } else if (yearTarget === 0) {
            // Target was 0 (none of the bad thing) but some occurred → worse than target
            yearScore = 0; // critical
          } else {
            yearScore = Math.min((yearTarget / yearActual) * 100, 150);
          }
        } else {
          // Higher is better: score = actual/target × 100
          if (yearTarget === 0 && yearActual === 0) {
            yearScore = 100; // target was 0, achieved 0 — exactly met
          } else if (yearTarget === 0 && yearActual > 0) {
            yearScore = 150; // target was 0, achieved more — exceeding
          } else {
            yearScore = Math.min((yearActual / yearTarget) * 100, 150);
          }
        }
        if (yearScore >= 100) status = 'exceeding';
        else if (yearScore >= 85) status = 'on_track';
        else if (yearScore >= 50) status = 'behind';
        else status = 'critical';
      } else if (yearTarget !== null && yearActual === null) {
        status = 'pending'; // target set but no actual yet
      } else if (!r.targetValuesLocked) {
        status = 'no_target'; // targets not submitted at all
      }

      // ── Journey % (progress toward end-of-cycle goal) ──
      let journeyPct = null;
      if (overallTarget !== null && latestActual !== null) {
        if (isDecreasing) {
          // baseline - actual / baseline - overallTarget = how much reduction achieved
          const totalReduction = (baseline ?? latestActual) - overallTarget;
          const achieved = (baseline ?? latestActual) - latestActual;
          journeyPct = totalReduction > 0 ? Math.min(Math.round((achieved / totalReduction) * 100), 200) : 0;
        } else {
          journeyPct = overallTarget > 0
            ? Math.min(Math.round((latestActual / overallTarget) * 100), 200)
            : 0;
        }
      }

      return {
        key: `${r.userId}_${r.parameterId}`,
        categoryId: r.categoryId,
        departmentId: r.departmentId,
        yearScore: yearScore !== null ? Math.round(yearScore) : null,
        yearActual,
        yearTarget,
        latestActual,
        latestActualYear: latestActualRv?.year ?? null,
        overallTarget,
        journeyPct,
        status,
        isDecreasing,
        rating: r,
      };
    });
  }

  // ─── HELPER: Classify each department's overall status ───────────────────────
  // A dept is "on track"  if ≥50% of its submitted params met/exceeded target
  // A dept is "struggling" if <50% of submitted params met target (and has data)
  // A dept is "pending"   if it has targets but zero actuals submitted
  // A dept is "no data"   if no targets set at all
  _buildDeptClassifications(paramScores, categoryId = null) {
    const deptMap = {};

    paramScores.forEach(ps => {
      if (ps.status === 'text') return;
      if (categoryId && ps.categoryId !== categoryId) return;
      const deptId = ps.rating?.departmentId;
      if (!deptId) return;

      if (!deptMap[deptId]) {
        deptMap[deptId] = {
          departmentId: deptId,
          departmentName: ps.rating?.departmentName || 'Unknown',
          facultyId: ps.rating?.facultyId,
          facultyName: ps.rating?.facultyName || 'Unknown',
          met: 0, missed: 0, behind: 0, pending: 0, noTarget: 0, total: 0,
        };
      }
      const d = deptMap[deptId];
      d.total++;
      if (ps.status === 'exceeding' || ps.status === 'on_track') d.met++;
      else if (ps.status === 'critical') d.missed++;
      else if (ps.status === 'behind') d.behind++;
      else if (ps.status === 'pending') d.pending++;
      else d.noTarget++;
    });

    // Classify each dept
    return Object.values(deptMap).map(d => {
      const submitted = d.met + d.missed + d.behind;
      let deptStatus;
      if (submitted === 0 && d.pending > 0) deptStatus = 'pending';
      else if (submitted === 0) deptStatus = 'no_data';
      else if (d.met / submitted >= 0.5) deptStatus = 'on_track';
      else deptStatus = 'struggling';
      return { ...d, submitted, deptStatus };
    });
  }

  // ─── HELPER: University-level pulse summary ──────────────────────────────────
  _aggregatePulse(paramScores) {
    const numeric = paramScores.filter(p => p.status !== 'text');
    const withActuals = numeric.filter(p => p.yearScore !== null);

    const exceeding = withActuals.filter(p => p.status === 'exceeding').length;
    const onTrack   = withActuals.filter(p => p.status === 'on_track').length;
    const behind    = withActuals.filter(p => p.status === 'behind').length;
    const critical  = withActuals.filter(p => p.status === 'critical').length;
    const pending   = numeric.filter(p => p.status === 'pending').length;
    const noTarget  = numeric.filter(p => p.status === 'no_target').length;
    const total     = numeric.length;

    // Unique parameter counts (distinct parameterId — not dept instances)
    const uniqueParamIds        = new Set(numeric.map(p => p.rating?.parameterId).filter(Boolean));
    const uniqueParams          = uniqueParamIds.size;

    // Department-level classifications
    const deptClasses = this._buildDeptClassifications(paramScores);
    const totalDepts      = deptClasses.length;
    const deptsOnTrack    = deptClasses.filter(d => d.deptStatus === 'on_track').length;
    const deptsStruggling = deptClasses.filter(d => d.deptStatus === 'struggling').length;
    const deptsPending    = deptClasses.filter(d => d.deptStatus === 'pending').length;
    const deptsNoData     = deptClasses.filter(d => d.deptStatus === 'no_data').length;

    return {
      // Raw instance counts (secondary detail)
      total,
      uniqueParams,
      exceeding,
      onTrack,
      behind,
      critical,
      pending,
      noTarget,
      withActuals: withActuals.length,
      // Department-level headline counts
      totalDepts,
      deptsOnTrack,
      deptsStruggling,
      deptsPending,
      deptsNoData,
    };
  }

  // ─── HELPER: Per-pillar scorecard ────────────────────────────────────────────
  async _aggregateByPillar(paramScores, ratings) {
    // Get category names from ratings
    const catMap = {};
    ratings.forEach(r => {
      if (r.categoryId && r.categoryName) catMap[r.categoryId] = r.categoryName;
    });

    // Group param scores by categoryId
    const groups = {};
    paramScores.forEach(ps => {
      if (!ps.categoryId) return;
      if (!groups[ps.categoryId]) groups[ps.categoryId] = [];
      groups[ps.categoryId].push(ps);
    });

    return Object.entries(groups).map(([catId, scores]) => {
      const numeric = scores.filter(s => s.status !== 'text');
      const withActuals = numeric.filter(s => s.yearScore !== null);
      const withJourney = numeric.filter(s => s.journeyPct !== null);

      const exceeding = withActuals.filter(s => s.status === 'exceeding').length;
      const onTrack   = withActuals.filter(s => s.status === 'on_track').length;
      const behind    = withActuals.filter(s => s.status === 'behind').length;
      const critical  = withActuals.filter(s => s.status === 'critical').length;
      const pending   = numeric.filter(s => s.status === 'pending').length;
      const noTarget  = numeric.filter(s => s.status === 'no_target').length;

      // Unique parameter counts for this pillar
      const uniqueParamIds       = new Set(numeric.map(s => s.rating?.parameterId).filter(Boolean));
      const uniqueWithActualsIds = new Set(withActuals.map(s => s.rating?.parameterId).filter(Boolean));
      const uniqueParams         = uniqueParamIds.size;
      const uniqueSubmissions    = uniqueWithActualsIds.size;

      // Department-level classifications for this pillar
      const pillarDeptClasses   = this._buildDeptClassifications(scores, parseInt(catId));
      const totalDepts          = pillarDeptClasses.length;
      const deptsOnTrack        = pillarDeptClasses.filter(d => d.deptStatus === 'on_track').length;
      const deptsStruggling     = pillarDeptClasses.filter(d => d.deptStatus === 'struggling').length;
      const deptsPending        = pillarDeptClasses.filter(d => d.deptStatus === 'pending').length;
      const deptsNoData         = pillarDeptClasses.filter(d => d.deptStatus === 'no_data').length;

      const avgYearScore = withActuals.length > 0
        ? Math.round(withActuals.reduce((s, p) => s + p.yearScore, 0) / withActuals.length)
        : 0;
      const avgJourneyPct = withJourney.length > 0
        ? Math.round(withJourney.reduce((s, p) => s + p.journeyPct, 0) / withJourney.length)
        : 0;
      const onTrackRate = withActuals.length > 0
        ? Math.round(((exceeding + onTrack) / withActuals.length) * 100)
        : 0;

      let ragStatus = 'no_data';
      if (withActuals.length > 0) {
        if (onTrackRate >= 75) ragStatus = 'green';
        else if (onTrackRate >= 50) ragStatus = 'amber';
        else ragStatus = 'red';
      } else if (numeric.length > 0) {
        ragStatus = 'pending';
      }

      return {
        categoryId: parseInt(catId),
        categoryName: catMap[catId] || `Category ${catId}`,
        shortName: this._shortenPillarName(catMap[catId] || ''),
        total: numeric.length,
        uniqueParams,
        uniqueSubmissions,
        withActuals: withActuals.length,
        exceeding,
        onTrack,
        behind,
        critical,
        pending,
        noTarget,
        // Department-level counts for this pillar
        totalDepts,
        deptsOnTrack,
        deptsStruggling,
        deptsPending,
        deptsNoData,
        avgYearScore,
        avgJourneyPct,
        onTrackRate,
        ragStatus,
      };
    }).sort((a, b) => a.categoryId - b.categoryId);
  }

  // ─── HELPER: Year timeline strip ────────────────────────────────────────────
  _buildYearTimeline(ratings, paramMeta, cycle, firstYear, targetYear) {
    const cycleYears = cycle.cycleYears || [];

    return cycleYears.map(year => {
      if (year === firstYear) {
        return { year, label: `${year}`, isBaseline: true, isActive: false, score: null, withActuals: 0, total: 0 };
      }

      const isCurrentActive = year === cycle.currentActiveYear;
      const isActivated = (cycle.activatedYears || []).includes(year);
      const isFuture = !isActivated && year !== targetYear;

      const numericRatings = ratings.filter(r => {
        const meta = paramMeta[r.parameterId] || {};
        return meta.parameterType !== 'Text';
      });

      const withTarget = numericRatings.filter(r =>
        r.ratingValues.some(rv => rv.year === year && rv.projectedValue !== null)
      );

      // For future/non-activated years: show nothing — year isn't open yet
      if (isFuture) {
        return {
          year,
          label: `${year}`,
          isBaseline: false,
          isCurrentActive: false,
          isActivated: false,
          isFuture: true,
          isTargetYear: false,
          withTargets: 0,
          withActuals: 0,
          total: 0,
          avgScore: null,
          completionPct: 0,
        };
      }

      const withActuals = numericRatings.filter(r =>
        r.ratingValues.some(rv => rv.year === year && rv.actualValue !== null)
      );

      // Avg score for this year (only for activated/target years)
      let scores = [];
      numericRatings.forEach(r => {
        const meta = paramMeta[r.parameterId] || {};
        const isDecreasing = meta.isDecreasing === true;
        const rv = r.ratingValues.find(v => v.year === year);
        if (!rv || rv.projectedValue === null || rv.actualValue === null) return;
        const s = isDecreasing
          ? (rv.actualValue === 0 ? 150 : (rv.projectedValue > 0 ? Math.min((rv.projectedValue / rv.actualValue) * 100, 150) : 0))
          : (rv.projectedValue > 0 ? Math.min((rv.actualValue / rv.projectedValue) * 100, 150) : 0);
        scores.push(Math.round(s));
      });

      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

      return {
        year,
        label: year === targetYear ? `${year} (Target)` : `${year}`,
        isBaseline: false,
        isCurrentActive,
        isActivated,
        isFuture: false,
        isTargetYear: year === targetYear,
        withTargets: withTarget.length,
        withActuals: withActuals.length,
        total: numericRatings.length,
        avgScore,
        completionPct: numericRatings.length > 0
          ? Math.round((withActuals.length / numericRatings.length) * 100)
          : 0,
      };
    });
  }

  // ─── HELPER: Parameter detail rows for drill-down ────────────────────────────
  _buildParameterRows(ratings, paramMeta, paramScores, activeYear, firstYear, targetYear, cycle) {
    // Group by parameterId+departmentId for the table rows
    const rows = paramScores
      .filter(ps => ps.status !== 'text')
      .map(ps => {
        const r = ps.rating;
        const meta = paramMeta[r.parameterId] || {};

        // Build yearly data for all activated years
        const yearlyData = (cycle.activatedYears || [])
          .filter(y => y !== firstYear)
          .map(year => {
            const rv = r.ratingValues.find(v => v.year === year);
            if (!rv) return { year, target: null, actual: null, score: null, status: 'no_data' };
            const target = rv.projectedValue ?? null;
            const actual = rv.actualValue ?? null;
            let score = null, st = 'pending';
            if (target !== null && actual !== null) {
              score = meta.isDecreasing
                ? (actual === 0 ? 150 : (target > 0 ? Math.min(Math.round((target / actual) * 100), 150) : 0))
                : (target > 0 ? Math.min(Math.round((actual / target) * 100), 150) : 0);
              if (score >= 100) st = 'exceeding';
              else if (score >= 85) st = 'on_track';
              else if (score >= 50) st = 'behind';
              else st = 'critical';
            } else if (target !== null) {
              st = 'pending';
            }
            return { year, target, actual, score, status: st };
          });

        // Also include target year
        const targetRv = r.ratingValues.find(v => v.year === targetYear);
        const targetYearData = targetRv
          ? { year: targetYear, projectedValue: targetRv.projectedValue, actualValue: targetRv.actualValue }
          : { year: targetYear, projectedValue: null, actualValue: null };

        const baselineRv = r.ratingValues.find(rv => rv.year === firstYear);

        return {
          parameterId: r.parameterId,
          parameterName: r.parameterName,
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          facultyId: r.facultyId,
          facultyName: r.facultyName,
          isDecreasing: meta.isDecreasing || false,
          parameterType: meta.parameterType || 'Numeric',
          baseline: baselineRv
            ? { year: firstYear, value: baselineRv.projectedValue ?? baselineRv.actualValue }
            : null,
          overallTarget: r.overallTarget,
          targetYearData,
          yearlyData,
          // Summary fields
          yearScore: ps.yearScore,
          journeyPct: ps.journeyPct,
          latestActual: ps.latestActual,
          latestActualYear: ps.latestActualYear,
          status: ps.status,
          targetValuesLocked: r.targetValuesLocked,
        };
      })
      // Sort: critical first, then behind, then on_track, then exceeding, then pending
      .sort((a, b) => {
        const order = { critical: 0, behind: 1, on_track: 2, exceeding: 3, pending: 4, no_target: 5 };
        return (order[a.status] ?? 6) - (order[b.status] ?? 6);
      });

    return rows;
  }

  // ─── HELPER: Department league table ─────────────────────────────────────────
  _buildDeptLeague(ratings, paramMeta, activeYear, firstYear, targetYear) {
    const deptGroups = {};

    ratings.forEach(r => {
      const meta = paramMeta[r.parameterId] || {};
      if (meta.parameterType === 'Text') return;
      if (!r.departmentId) return;

      const key = r.departmentId;
      if (!deptGroups[key]) {
        deptGroups[key] = {
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          deptCode: r.deptCode || null,
          facultyId: r.facultyId,
          facultyName: r.facultyName,
          scores: [],
          journeys: [],
          exceeding: 0, onTrack: 0, behind: 0, critical: 0, pending: 0, total: 0
        };
      }

      const d = deptGroups[key];
      const isDecreasing = meta.isDecreasing === true;
      const rv = r.ratingValues.find(v => v.year === activeYear);

      d.total++;

      if (rv && rv.projectedValue !== null && rv.actualValue !== null) {
        let score;
        if (isDecreasing) {
          if (rv.actualValue === 0)       score = 150; // achieved zero of the bad thing — perfect
          else if (rv.projectedValue === 0) score = 0;  // target 0 but some occurred — critical
          else score = Math.min((rv.projectedValue / rv.actualValue) * 100, 150);
        } else {
          if (rv.projectedValue === 0 && rv.actualValue === 0) score = 100; // hit zero target exactly
          else if (rv.projectedValue === 0 && rv.actualValue > 0) score = 150; // exceeded zero target
          else score = Math.min((rv.actualValue / rv.projectedValue) * 100, 150);
        }
        d.scores.push(Math.round(score));
        if (score >= 100) d.exceeding++;
        else if (score >= 85) d.onTrack++;
        else if (score >= 50) d.behind++;
        else d.critical++;
      } else {
        d.pending++;
      }

      // Journey
      if (r.overallTarget && r.overallTarget > 0) {
        const withActuals = r.ratingValues
          .filter(rv => rv.actualValue !== null && rv.year !== firstYear)
          .sort((a, b) => b.year - a.year);
        if (withActuals.length > 0) {
          const latestActual = withActuals[0].actualValue;
          const baselineRv = r.ratingValues.find(rv => rv.year === firstYear);
          const baseline = baselineRv?.projectedValue ?? latestActual;
          let jp;
          if (isDecreasing) {
            const totalRed = baseline - r.overallTarget;
            const achieved = baseline - latestActual;
            jp = totalRed > 0 ? Math.min(Math.round((achieved / totalRed) * 100), 200) : 0;
          } else {
            jp = Math.min(Math.round((latestActual / r.overallTarget) * 100), 200);
          }
          d.journeys.push(jp);
        }
      }
    });

    return Object.values(deptGroups)
      .map(d => {
        const met      = d.exceeding + d.onTrack;
        const missed   = d.behind + d.critical;
        const submitted = met + missed; // only those with both target + actual
        // metRatio: proportion of submitted params that met target (for ranking)
        const metRatio = submitted > 0 ? met / submitted : 0;
        return {
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          deptCode: d.deptCode || null,
          facultyId: d.facultyId,
          facultyName: d.facultyName,
          total: d.total,
          exceeding: d.exceeding,
          onTrack: d.onTrack,
          behind: d.behind,
          critical: d.critical,
          pending: d.pending,
          submitted,
          metRatio,
        };
      })
      // Sort: highest met ratio first; ties broken by absolute met count
      .sort((a, b) => b.metRatio - a.metRatio || b.exceeding + b.onTrack - (a.exceeding + a.onTrack))
      .map((d, idx) => ({ ...d, rank: idx + 1 }));
  }

  // ─── UTILITY ─────────────────────────────────────────────────────────────────
  _dedupeByYear(ratingValues) {
    const map = {};
    ratingValues.forEach(rv => {
      if (!map[rv.year]) {
        map[rv.year] = rv;
      } else {
        // prefer the one with more data
        if (rv.actualValue !== null && map[rv.year].actualValue === null) map[rv.year] = rv;
      }
    });
    return Object.values(map);
  }

  _shortenPillarName(name) {
    // "Strategic Pillar 3: Student Success" → "Student Success"
    const match = name.match(/:\s*(.+)$/);
    return match ? match[1].trim() : name;
  }
}

module.exports = new AnalyticsService();
