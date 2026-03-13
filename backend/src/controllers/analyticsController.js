const mongoose = require("mongoose");
const Admission = require("../models/Admission");
const Hospital = require("../models/Hospital");

/**
 * @desc   Admissions count by month (last 12 months)
 * @route  GET /api/analytics/admissions-by-month
 * @access Private (HOSPITAL_ADMIN)
 */
const admissionsByMonth = async (req, res) => {
  const hospitalId = new mongoose.Types.ObjectId(req.user.hospitalId);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const data = await Admission.aggregate([
    {
      $match: {
        hospitalId,
        requestDate: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$requestDate" },
          month: { $month: "$requestDate" },
        },
        admissions: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } },
        discharged: { $sum: { $cond: [{ $eq: ["$status", "DISCHARGED"] }, 1, 0] } },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
    {
      $project: {
        _id: 0,
        month: {
          $concat: [
            { $arrayElemAt: [["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], "$_id.month"] },
            " ",
            { $toString: "$_id.year" },
          ],
        },
        admissions: 1,
        approved: 1,
        rejected: 1,
        discharged: 1,
      },
    },
  ]);

  res.status(200).json({ success: true, data: { admissionsByMonth: data } });
};

/**
 * @desc   Admissions grouped by disease / specialization
 * @route  GET /api/analytics/hospital-performance
 * @access Private (HOSPITAL_ADMIN)
 */
const hospitalPerformance = async (req, res) => {
  const hospitalId = new mongoose.Types.ObjectId(req.user.hospitalId);

  const [admissionsByStatus, admissionsByUrgency, avgProcessingTime] = await Promise.all([
    // By status
    Admission.aggregate([
      { $match: { hospitalId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { _id: 0, status: "$_id", count: 1 } },
    ]),

    // By urgency
    Admission.aggregate([
      { $match: { hospitalId } },
      { $group: { _id: "$urgency", count: { $sum: 1 } } },
      { $project: { _id: 0, urgency: "$_id", count: 1 } },
    ]),

    // Avg time from request to review (hours)
    Admission.aggregate([
      { $match: { hospitalId, reviewDate: { $ne: null } } },
      {
        $project: {
          processingHours: {
            $divide: [{ $subtract: ["$reviewDate", "$requestDate"] }, 1000 * 60 * 60],
          },
        },
      },
      { $group: { _id: null, avgHours: { $avg: "$processingHours" } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      admissionsByStatus,
      admissionsByUrgency,
      avgReviewTime: avgProcessingTime[0]
        ? `${Math.round(avgProcessingTime[0].avgHours)} hours`
        : "N/A",
    },
  });
};

/**
 * @desc   Dashboard summary stats
 * @route  GET /api/analytics/summary
 * @access Private (HOSPITAL_ADMIN)
 */
const summary = async (req, res) => {
  const hospitalId = new mongoose.Types.ObjectId(req.user.hospitalId);
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const [
    totalAdmissions,
    pendingAdmissions,
    thisMonthAdmissions,
    thisWeekAdmissions,
    hospital,
  ] = await Promise.all([
    Admission.countDocuments({ hospitalId }),
    Admission.countDocuments({ hospitalId, status: { $in: ["PENDING", "UNDER_REVIEW"] } }),
    Admission.countDocuments({ hospitalId, requestDate: { $gte: startOfMonth } }),
    Admission.countDocuments({ hospitalId, requestDate: { $gte: startOfWeek } }),
    Hospital.findById(hospitalId).select("name rating reviewCount doctorCount"),
  ]);

  res.status(200).json({
    success: true,
    data: {
      hospital,
      stats: {
        totalAdmissions,
        pendingAdmissions,
        thisMonthAdmissions,
        thisWeekAdmissions,
      },
    },
  });
};

module.exports = { admissionsByMonth, hospitalPerformance, summary };
